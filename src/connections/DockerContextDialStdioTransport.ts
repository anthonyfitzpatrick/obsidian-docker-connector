import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { DockerContextProfile } from "../models/DockerConnectionProfile";
import { DockerContextDiscoveryService } from "./DockerContextDiscovery";
import { evaluateDockerContextLifecycle } from "./DockerContextLifecycle";
import { dockerHttpError, DockerConnectionError, type ConnectionTestStep, type DockerApiRequest, type DockerConnectionTestResult, type DockerTransport } from "./DockerTransport";
import { tryParseHttpResponse } from "./DockerDialStdioTransport";

const STDERR_LIMIT = 16 * 1024;
const REQUEST_TIMEOUT = 20_000;

/** Docker HTTP transport resolved by the Docker CLI for one explicit saved Context. */
/**
 * Docker Context transport using `docker --context <name> system dial-stdio`.
 *
 * The context name is validated and passed as one fixed argument array with
 * shell execution disabled. This process opens a byte stream only; it never
 * calls Docker Context create/use/remove/import/export commands and therefore
 * cannot mutate the user's globally active Docker Context.
 */
export class DockerContextDialStdioTransport implements DockerTransport {
  private child?: ChildProcessWithoutNullStreams; private buffer = ""; private stderr = ""; private connected = false; private requestQueue = Promise.resolve(); private pending?: { resolve: (body: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
  constructor(readonly profile: DockerContextProfile, private readonly dockerPath = "docker") {}
  async connect(): Promise<void> {
    if (this.connected) return;
    if (!validContextName(this.profile.contextName)) throw new DockerConnectionError("DOCKER_CONTEXT_UNSUPPORTED", "Docker Context name is invalid.");
    let contexts;
    try { contexts = await new DockerContextDiscoveryService(this.dockerPath).discover(); }
    catch (error) { throw discoveryError(error); }
    const lifecycle = evaluateDockerContextLifecycle(this.profile, contexts, new Date().toISOString());
    if (lifecycle.state === "missing") throw new DockerConnectionError("DOCKER_CONTEXT_NOT_FOUND", lifecycle.message!);
    if (lifecycle.state === "changed") throw new DockerConnectionError("DOCKER_CONTEXT_CHANGED", "The Docker Context has changed since this connection was saved. Review and save the updated Context before connecting.");
    if (lifecycle.state === "unsupported") throw new DockerConnectionError(lifecycle.errorCode ?? "DOCKER_CONTEXT_UNSUPPORTED", lifecycle.message!);
    await this.start();
  }
  isConnected(): boolean { return this.connected; }
  async disconnect(): Promise<void> { this.connected = false; this.rejectPending(new DockerConnectionError("DOCKER_CONTEXT_TRANSPORT_CLOSED", "Docker Context transport was closed.")); const child = this.child; this.child = undefined; if (child && !child.killed) { child.stdin.end(); child.kill(); } }
  async request<T>(request: DockerApiRequest): Promise<T> { const body = await this.enqueue(request.path, request.method, request.body); if (request.responseType === "empty") return undefined as T; if (request.responseType === "text") return body as T; try { return JSON.parse(body) as T; } catch { throw new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Docker returned an invalid JSON response."); } }
  async testConnection(): Promise<DockerConnectionTestResult> {
    const steps: ConnectionTestStep[] = ["Validate profile", "Discover Docker Context", "Compare saved Context metadata", "Start Docker Context dial-stdio", "Send Docker GET /_ping", "Receive Docker ping response", "Send Docker GET /version", "Receive Docker version response", "Parse Docker response"].map((label, index) => ({ id: `context-${index}`, label, status: "pending" }));
    try { steps[0].status = "success"; steps[1].status = "running"; await this.connect(); steps[1].status = "success"; steps[2].status = "success"; steps[3].status = "success"; steps[4].status = "success"; const ping = await this.raw("/_ping"); if (ping.trim() !== "OK") throw new DockerConnectionError("DOCKER_PING_FAILED", "Docker /_ping returned an unexpected response."); steps[5].status = "success"; steps[6].status = "success"; const body = await this.raw("/version"); const version = JSON.parse(body) as { Version?: string; ApiVersion?: string }; if (!version.Version || !version.ApiVersion) throw new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Docker /version response was incomplete."); steps[7].status = "success"; steps[8].status = "success"; return { success: true, steps, dockerVersion: version.Version, apiVersion: version.ApiVersion };
    } catch (error) { const active = [...steps].reverse().find((step) => step.status === "running" || step.status === "pending"); if (active) active.status = "error"; steps.filter((step) => step.status === "pending").forEach((step) => step.status = "skipped"); const typed = error instanceof DockerConnectionError ? error : new DockerConnectionError("DOCKER_CONTEXT_TRANSPORT_FAILED", "Docker CLI could not open the selected Docker Context."); return { success: false, steps, safeErrorCode: typed.code, safeErrorMessage: typed.message }; }
    finally { await this.disconnect(); }
  }
  private async start(): Promise<void> { await new Promise<void>((resolve, reject) => { let settled = false; const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } }; let child: ChildProcessWithoutNullStreams; try { child = spawn(this.dockerPath, contextDialStdioArgs(this.profile.contextName), { shell: false, stdio: "pipe", windowsHide: true }); } catch { fail(new DockerConnectionError("DOCKER_CONTEXT_TRANSPORT_START_FAILED", "Docker CLI could not start the selected Docker Context.")); return; } this.child = child; child.stdout.setEncoding("utf8"); child.stdout.on("data", (chunk: string) => { this.buffer += chunk; this.consume(); }); child.stderr.setEncoding("utf8"); child.stderr.on("data", (chunk: string) => { this.stderr = `${this.stderr}${chunk}`.slice(-STDERR_LIMIT); }); child.once("error", (error) => fail(mapTransportError(error.message))); child.once("spawn", () => { if (!settled) { settled = true; this.connected = true; resolve(); } }); child.once("close", () => { this.connected = false; this.rejectPending(mapTransportError(this.stderr)); }); }); }
  private enqueue(path: string, method: DockerApiRequest["method"] = "GET", body?: string): Promise<string> { const next = this.requestQueue.then(() => this.raw(path, method, body)); this.requestQueue = next.then(() => undefined, () => undefined); return next; }
  private async raw(path: string, method: DockerApiRequest["method"] = "GET", body?: string): Promise<string> { if (!this.connected) await this.connect(); if (!this.child) throw new DockerConnectionError("DOCKER_CONTEXT_TRANSPORT_CLOSED", "Docker Context transport is unavailable."); return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.rejectPending(new DockerConnectionError("DOCKER_CONTEXT_TRANSPORT_TIMEOUT", "Docker Context did not respond in time.")); void this.disconnect(); }, REQUEST_TIMEOUT); this.pending = { resolve, reject, timer }; this.child!.stdin.write(`${method} ${path} HTTP/1.1\r\nHost: docker\r\nConnection: keep-alive\r\n${body ? `Content-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n` : ""}\r\n${body ?? ""}`); this.consume(); }); }
  private consume(): void { if (!this.pending) return; let parsed; try { parsed = tryParseHttpResponse(this.buffer); } catch (error) { this.rejectPending(error instanceof Error ? error : new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Docker response was invalid.")); return; } if (!parsed) return; this.buffer = this.buffer.slice(parsed.consumed); const pending = this.pending; this.pending = undefined; clearTimeout(pending.timer); if (parsed.response.status < 200 || parsed.response.status >= 300) pending.reject(parsed.response.status === 503 ? new DockerConnectionError("DOCKER_CONTEXT_TRANSPORT_FAILED", "Docker Context transport is unavailable.", parsed.response.body, parsed.response.status) : dockerHttpError(parsed.response.status, parsed.response.body)); else pending.resolve(parsed.response.body); }
  private rejectPending(error: Error): void { const pending = this.pending; this.pending = undefined; if (pending) { clearTimeout(pending.timer); pending.reject(error); } }
}
/** Returns the only Docker CLI invocation allowed for a saved Context profile. */
export function contextDialStdioArgs(contextName: string): string[] { if (!validContextName(contextName)) throw new DockerConnectionError("DOCKER_CONTEXT_UNSUPPORTED", "Docker Context name is invalid."); return ["--context", contextName, "system", "dial-stdio"]; }
function validContextName(value: string): boolean { return Boolean(value && value.length <= 255 && !/[\x00-\x1F\x7F]/.test(value)); }
function discoveryError(error: unknown): DockerConnectionError { const code = error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "DOCKER_CONTEXT_DISCOVERY_FAILED"; return new DockerConnectionError(code === "DOCKER_CLI_NOT_FOUND" ? code : "DOCKER_CONTEXT_DISCOVERY_FAILED", code === "DOCKER_CLI_NOT_FOUND" ? "Docker CLI was not found on this computer." : "Docker Context discovery failed."); }
function mapTransportError(stderr: string): DockerConnectionError { const safe = stderr.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(-512); if (/tls|certificate/i.test(safe)) return new DockerConnectionError("DOCKER_CONTEXT_TLS_FAILED", "Docker CLI could not validate TLS for the selected Docker Context.", safe); if (/ssh|host key|permission denied/i.test(safe)) return new DockerConnectionError("DOCKER_CONTEXT_SSH_FAILED", "Docker CLI could not open the selected Docker Context. Verify that docker --context <name> version works in a terminal.", safe); return new DockerConnectionError("DOCKER_CONTEXT_TRANSPORT_FAILED", "Docker CLI could not open the selected Docker Context. Verify that docker --context <name> version works in a terminal.", safe || undefined); }
