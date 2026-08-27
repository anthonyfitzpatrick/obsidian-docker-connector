import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { displayLocalPath } from "./LocalEndpointDiscovery";
import { DockerCliResolver, type DockerCliResolution } from "./DockerCliResolver";

const execute = promisify(execFile);
/**
 * Read-only representation of a Docker CLI Context endpoint. Contexts that
 * imply unencrypted TCP are surfaced as unsupported rather than being coerced
 * into a connection the plugin cannot verify safely.
 */
export type DockerContextEndpointType = "unix-socket" | "windows-named-pipe" | "ssh" | "tcp-tls" | "tcp-insecure" | "unknown";
export interface DockerContextEndpoint { rawHost: string; displayHost: string; type: DockerContextEndpointType; skipTlsVerify: boolean; hasTlsMaterial: boolean; }
export interface DiscoveredDockerContext { name: string; description?: string; isCurrent: boolean; dockerEndpoint?: DockerContextEndpoint; error?: string; supported: boolean; }

/**
 * Read-only Docker CLI Context discovery. The fixed `context ls` argument list
 * has a timeout and bounded output; it never changes the active Context or
 * invokes any Context mutation command.
 */
export class DockerContextDiscoveryService {
  constructor(private readonly resolver = new DockerCliResolver()) {}
  async resolveCli(): Promise<DockerCliResolution> { return this.resolver.resolve(); }
  async discover(resolution?: DockerCliResolution): Promise<DiscoveredDockerContext[]> { const resolved = resolution ?? await this.resolveCli(); if (resolved.availability !== "available" || !resolved.executablePath) throw contextError("DOCKER_CLI_NOT_FOUND", resolved.safeMessage); let output: string; try { ({ stdout: output } = await execute(resolved.executablePath, ["context", "ls", "--format", "{{json .}}"], { shell: false, timeout: 15_000, maxBuffer: 256 * 1024, windowsHide: true })); } catch { throw contextError("DOCKER_CLI_EXECUTION_FAILED", "Docker CLI detected, but Docker Contexts could not be discovered."); }
    return parseDockerContextList(output); }
}
export function parseDockerContextList(output: string): DiscoveredDockerContext[] { const names = new Set<string>(); return output.split(/\r?\n/).filter(Boolean).map((line) => { let parsed: unknown; try { parsed = JSON.parse(line); } catch { throw contextError("DOCKER_CONTEXT_LIST_INVALID", "Docker CLI returned invalid context data."); } if (!parsed || typeof parsed !== "object") throw contextError("DOCKER_CONTEXT_LIST_INVALID", "Docker CLI returned invalid context data."); const value = parsed as { Name?: string; Description?: string; Current?: boolean; DockerEndpoint?: string; Error?: string }; if (!value.Name || names.has(value.Name)) throw contextError("DOCKER_CONTEXT_LIST_INVALID", "Docker CLI returned invalid or duplicate Context names."); names.add(value.Name); const dockerEndpoint = value.DockerEndpoint ? classifyDockerContextEndpoint(value.DockerEndpoint) : undefined; return { name: value.Name, description: value.Description || undefined, isCurrent: Boolean(value.Current), dockerEndpoint, error: value.Error || undefined, supported: Boolean(dockerEndpoint && ["unix-socket", "windows-named-pipe", "ssh"].includes(dockerEndpoint.type)) }; }); }
export function classifyDockerContextEndpoint(rawHost: string): DockerContextEndpoint { if (rawHost.startsWith("unix://")) { const path = rawHost.slice(7); return { rawHost, displayHost: displayLocalPath(path), type: "unix-socket", skipTlsVerify: false, hasTlsMaterial: false }; } if (rawHost.startsWith("npipe://")) return { rawHost, displayHost: rawHost.replace(/^npipe:\/\//, ""), type: "windows-named-pipe", skipTlsVerify: false, hasTlsMaterial: false }; if (rawHost.startsWith("ssh://")) { try { const url = new URL(rawHost); return { rawHost, displayHost: `${url.username ? `${url.username}@` : ""}${url.hostname}${url.port ? `:${url.port}` : ""}`, type: "ssh", skipTlsVerify: false, hasTlsMaterial: false }; } catch { return { rawHost, displayHost: rawHost, type: "unknown", skipTlsVerify: false, hasTlsMaterial: false }; } } if (rawHost.startsWith("tcp://")) return { rawHost, displayHost: rawHost.slice(6), type: "tcp-insecure", skipTlsVerify: false, hasTlsMaterial: false }; return { rawHost, displayHost: rawHost, type: "unknown", skipTlsVerify: false, hasTlsMaterial: false }; }
function contextError(code: string, message: string): Error & { code: string } { return Object.assign(new Error(message), { code }); }
