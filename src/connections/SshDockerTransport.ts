import { Client } from "ssh2";
import * as net from "node:net";
import { lookup } from "node:dns/promises";
import type { SshDockerProfile } from "../models/DockerConnectionProfile";
import type { DockerApiRequest, DockerConnectionTestResult, DockerTransport } from "./DockerTransport";
import { dockerHttpError, DockerConnectionError, HostKeyTrustRequiredError } from "./DockerTransport";
import { ConnectionDiagnostics } from "./ConnectionDiagnostics";
import { HostKeyVerifier } from "../security/HostKeyVerifier";
import { DockerDialStdioTransport } from "./DockerDialStdioTransport";
import { DockerCapabilityProbe } from "./DockerCapabilityProbe";
import type { DockerCapability } from "./DockerCapabilityProbe";
import { loadPrivateKeyFile } from "../security/PrivateKeyFile";

export interface RuntimeSshCredentials { password?: string; privateKeyPassphrase?: string; }
export type CredentialProvider = () => RuntimeSshCredentials;
const TCP_TIMEOUT_MS = 20_000;
const HANDSHAKE_TIMEOUT_MS = 20_000;
const AUTH_TIMEOUT_MS = 30_000;
const DOCKER_PING_TIMEOUT_MS = 15_000;
const DOCKER_RESPONSE_TIMEOUT_MS = 20_000;
const OVERALL_TIMEOUT_MS = 90_000;
type SshTarget = { host: string; port: number; requiresDns: boolean };

/**
 * Password-only SSH transport using one ssh2 client for the complete attempt.
 *
 * Documentation: Docker Connector - SSH Transport.md
 */
export class SshDockerTransport implements DockerTransport {
  private client?: Client;
  private connected = false;
  private connectPromise?: Promise<void>;
  private dialTransport?: DockerDialStdioTransport;
  private dialTransportPromise?: Promise<DockerDialStdioTransport>;
  private capabilityProbe?: Promise<DockerCapability>;
  private readonly activeTests = new Set<AbortController>();
  private privateKeyMaterial?: Buffer;

  constructor(
    readonly profile: SshDockerProfile,
    private readonly credentialProvider: CredentialProvider = () => ({}),
    private readonly verifier = new HostKeyVerifier(),
    private readonly clientFactory: () => Client = () => new Client()
  ) {}

  async connect(diagnostics?: ConnectionDiagnostics, target = normalizeSshTarget(this.profile), signal?: AbortSignal): Promise<void> {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;
    const attempt = this.establishConnection(diagnostics, target, signal);
    this.connectPromise = attempt;
    try { await attempt; }
    finally { if (this.connectPromise === attempt) this.connectPromise = undefined; }
  }

  private async establishConnection(diagnostics: ConnectionDiagnostics | undefined, target: SshTarget, signal?: AbortSignal): Promise<void> {
    const credentials = this.credentialProvider();
    const authentication = await this.authenticationSource(credentials, diagnostics);
    diagnostics?.set("parse", "success", `${target.host}:${target.port}`);
    await this.resolveHost(target, diagnostics);

    const client = this.clientFactory();
    this.client = client;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let hostKeyError: Error | undefined;
      let keyboardInteractiveUsed = false;
      let tcpTimer: ReturnType<typeof setTimeout> | undefined;
      let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
      let authenticationTimer: ReturnType<typeof setTimeout> | undefined;
      const cleanupAttempt = () => {
        if (tcpTimer) clearTimeout(tcpTimer);
        if (handshakeTimer) clearTimeout(handshakeTimer);
        if (authenticationTimer) clearTimeout(authenticationTimer);
        signal?.removeEventListener("abort", onAbort);
      };
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        cleanupAttempt();
        if (error) {
          this.connected = false;
          client.removeAllListeners();
          client.end(); this.clearPrivateKeyMaterial();
          if (this.client === client) this.client = undefined;
          reject(error);
          return;
        }
        this.connected = true;
        resolve();
      };
      const onAbort = () => settle(new DockerConnectionError("SSH_CONNECTION_CANCELLED", "The SSH connection attempt was cancelled."));

      diagnostics?.set("tcp", "running", "Opening the SSH client connection.");
      tcpTimer = setTimeout(() => settle(new DockerConnectionError("SSH_CONNECTION_TIMEOUT", `The SSH server did not open a TCP connection within ${TCP_TIMEOUT_MS / 1000} seconds.`)), TCP_TIMEOUT_MS);
      client.once("connect", () => {
        if (tcpTimer) clearTimeout(tcpTimer);
        diagnostics?.set("tcp", "success", `${target.host}:${target.port}`);
        diagnostics?.set("handshake", "running");
        handshakeTimer = setTimeout(() => settle(new DockerConnectionError("SSH_HANDSHAKE_TIMEOUT", "SSH protocol handshake did not complete within 20 seconds.")), HANDSHAKE_TIMEOUT_MS);
      });
      client.once("handshake", () => {
        if (handshakeTimer) clearTimeout(handshakeTimer);
        diagnostics?.set("handshake", "success");
        diagnostics?.set("auth", "running", "Attempting password authentication.");
        authenticationTimer = setTimeout(() => settle(new DockerConnectionError("SSH_AUTHENTICATION_FAILED", "SSH authentication did not complete within 30 seconds.")), AUTH_TIMEOUT_MS);
      });
      client.once("ready", () => {
        diagnostics?.set("auth", "success");
        settle();
      });
      if (authentication.type === "password") client.on("keyboard-interactive", (_name, _instructions, _language, prompts, respond) => {
        keyboardInteractiveUsed = true;
        diagnostics?.set("keyboard-interactive", "running", "Server requested password authentication fallback.");
        if (prompts.length === 1 && /password/i.test(prompts[0]?.prompt ?? "")) {
          respond([authentication.password]);
          diagnostics?.set("keyboard-interactive", "success", "Password response sent.");
          return;
        }
        respond([]);
        settle(new DockerConnectionError("SSH_AUTHENTICATION_METHOD_UNSUPPORTED", "The SSH server requested an unsupported interactive authentication challenge."));
      });
      client.once("error", (error) => settle(hostKeyError ?? mapSshError(error, keyboardInteractiveUsed, authentication.type, this.profile.sshUsername)));
      client.once("close", () => { this.connected = false; });
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener("abort", onAbort, { once: true });
      client.connect({
        host: target.host,
        port: target.port,
        username: this.profile.sshUsername,
        ...(authentication.type === "password" ? { password: authentication.password, tryKeyboard: true, authHandler: ["password", "keyboard-interactive"] } : { privateKey: authentication.privateKey, passphrase: authentication.passphrase }),
        readyTimeout: HANDSHAKE_TIMEOUT_MS,
        hostVerifier: (key: Buffer) => {
          const received = this.verifier.fingerprint(key);
          diagnostics?.set("host-key", "success", received);
          if (!this.profile.hostKeyFingerprint) {
            hostKeyError = new HostKeyTrustRequiredError(received);
            diagnostics?.set("trust", "warning", "Host key is awaiting explicit trust.");
            return false;
          }
          if (!this.verifier.verify(key, this.profile.hostKeyFingerprint)) {
            hostKeyError = new DockerConnectionError("SSH_HOST_KEY_MISMATCH", "SSH host key changed. Verify the server before reconnecting.", `Expected ${this.profile.hostKeyFingerprint}; received ${received}.`);
            diagnostics?.set("trust", "error", "Stored host key does not match the server.");
            return false;
          }
          diagnostics?.set("trust", "success", "Stored host key matches.");
          return true;
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    for (const controller of this.activeTests) controller.abort();
    this.activeTests.clear();
    this.dialTransport?.close();
    this.dialTransport = undefined;
    this.dialTransportPromise = undefined;
    this.capabilityProbe = undefined;
    this.client?.end();
    this.client = undefined;
    this.connected = false;
    this.clearPrivateKeyMaterial();
  }

  private async authenticationSource(credentials: RuntimeSshCredentials, diagnostics?: ConnectionDiagnostics): Promise<{ type: "password"; password: string } | { type: "private-key"; privateKey: Buffer; passphrase?: string }> {
    if (this.profile.authentication.type === "password") {
      if (!credentials.password) {
        const error = new DockerConnectionError("SSH_PASSWORD_REQUIRED", "Enter the SSH password to connect. Passwords are kept only for the current Obsidian session.");
        diagnostics?.set("password", "error", error.message);
        throw error;
      }
      diagnostics?.set("password", "success", "Runtime password is available.");
      return { type: "password", password: credentials.password };
    }
    diagnostics?.set("private-key-path", "running");
    const key = await loadPrivateKeyFile(this.profile.authentication.privateKeyPath, credentials.privateKeyPassphrase);
    diagnostics?.set("private-key-path", "success", "Private-key path resolved.");
    diagnostics?.set("private-key-read", "success", "Private-key file read.");
    diagnostics?.set("private-key-parse", "success", "Private-key authentication source parsed.");
    this.privateKeyMaterial = key.contents;
    return { type: "private-key", privateKey: key.contents, passphrase: credentials.privateKeyPassphrase };
  }

  private clearPrivateKeyMaterial(): void { this.privateKeyMaterial?.fill(0); this.privateKeyMaterial = undefined; }

  isConnected(): boolean { return this.connected; }

  async request<T>(request: DockerApiRequest, diagnostics?: ConnectionDiagnostics, target?: SshTarget, signal?: AbortSignal): Promise<T> {
    const body = await this.requestBody(request, diagnostics, target, signal, DOCKER_RESPONSE_TIMEOUT_MS);
    if (request.responseType === "empty") return undefined as T;
    if (request.responseType === "text") return body as T;
    try { const value = JSON.parse(body) as T; diagnostics?.set("parse-response", "success"); return value; }
    catch { throw new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Docker returned an invalid JSON response."); }
  }

  private async requestBody(request: DockerApiRequest, diagnostics?: ConnectionDiagnostics, target?: SshTarget, signal?: AbortSignal, responseTimeout = DOCKER_RESPONSE_TIMEOUT_MS): Promise<string> {
    await this.connect(diagnostics, target, signal);
    const client = this.client;
    if (!client) throw new DockerConnectionError("UNKNOWN_CONNECTION_ERROR", "SSH connection was closed.");
    if (signal?.aborted) throw new DockerConnectionError("SSH_CONNECTION_CANCELLED", "The Docker request was cancelled.");
    diagnostics?.set("identity", "running");
    const capability = await this.probeDockerCapability(client);
    diagnostics?.set("identity", "success", capability.identity.username);
    diagnostics?.set("groups", "success");
    diagnostics?.set("context", "success", "Docker CLI context resolved.");
    diagnostics?.set("socket-stat", "success");
    diagnostics?.set("daemon", "success", "Docker daemon responded to capability probe.");
    diagnostics?.set("socket", "running", "Starting docker system dial-stdio.");
    try {
      this.dialTransport = await this.openDialTransport(client);
      const requestStage = request.path === "/_ping" ? "ping-request" : "version-request";
      const responseStage = request.path === "/_ping" ? "ping-response" : "version-response";
      diagnostics?.set(requestStage, "running");
      const response = await this.dialTransport.request(request.path, responseTimeout, request.method, request.body);
      diagnostics?.set("socket", "success", "Docker transport accepted the request.");
      diagnostics?.set(responseStage, "success");
      if (response.status < 200 || response.status >= 300) throw response.status === 503 ? new DockerConnectionError("DOCKER_DAEMON_UNAVAILABLE", "Docker daemon is unavailable on the remote host.", response.body, response.status) : dockerHttpError(response.status, response.body, request.path === "/_ping");
      diagnostics?.set(requestStage, "success");
      return response.body;
    } catch (error) {
      if (error instanceof DockerConnectionError) throw error;
      throw new DockerConnectionError("DOCKER_DIAL_STDIO_START_FAILED", "Could not start docker system dial-stdio on the remote host.");
    }
  }

  private async openDialTransport(client: Client): Promise<DockerDialStdioTransport> {
    if (this.dialTransport) return this.dialTransport;
    if (!this.dialTransportPromise) this.dialTransportPromise = DockerDialStdioTransport.open(client);
    try { return await this.dialTransportPromise; }
    finally { this.dialTransportPromise = undefined; }
  }

  private async probeDockerCapability(client: Client): Promise<DockerCapability> {
    if (!this.capabilityProbe) this.capabilityProbe = DockerCapabilityProbe.run(client, this.profile.sshUsername, this.profile.remoteSocketPath);
    try { return await this.capabilityProbe; }
    catch (error) { this.capabilityProbe = undefined; throw error; }
  }

  async testConnection(): Promise<DockerConnectionTestResult> {
    const diagnostics = new ConnectionDiagnostics();
    const controller = new AbortController();
    this.activeTests.add(controller);
    const overallTimer = setTimeout(() => controller.abort(), OVERALL_TIMEOUT_MS);
    try {
      diagnostics.set("input", "running");
      const target = normalizeSshTarget(this.profile);
      diagnostics.set("input", "success");
      const ping = await this.requestBody({ method: "GET", path: "/_ping" }, diagnostics, target, controller.signal, DOCKER_PING_TIMEOUT_MS);
      if (ping.trim() !== "OK") throw new DockerConnectionError("DOCKER_PING_FAILED", "Docker /_ping returned an unexpected response.");
      const body = await this.requestBody({ method: "GET", path: "/version" }, diagnostics, target, controller.signal);
      const version = JSON.parse(body) as { Version: string; ApiVersion: string };
      if (!version.Version || !version.ApiVersion) throw new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Docker /version response was incomplete.");
      diagnostics.set("parse-response", "success");
      return diagnostics.success(version);
    } catch (error) {
      const code = error instanceof HostKeyTrustRequiredError ? "SSH_HOST_KEY_UNTRUSTED" : error instanceof DockerConnectionError ? error.code : "UNKNOWN_CONNECTION_ERROR";
      const message = error instanceof HostKeyTrustRequiredError ? "Verify and explicitly trust this SSH host fingerprint before continuing." : safeMessage(error);
      return diagnostics.failure(code, message, error instanceof DockerConnectionError ? error.details : undefined, error instanceof HostKeyTrustRequiredError ? error.fingerprint : undefined);
    } finally {
      clearTimeout(overallTimer);
      this.activeTests.delete(controller);
      await this.disconnect();
    }
  }

  private async resolveHost(target: SshTarget, diagnostics?: ConnectionDiagnostics): Promise<void> {
    if (!target.requiresDns) { diagnostics?.set("dns", "success", "IP address supplied; DNS not required."); return; }
    diagnostics?.set("dns", "running");
    try {
      const result = await promiseTimeout(lookup(target.host), TCP_TIMEOUT_MS, new DockerConnectionError("SSH_DNS_LOOKUP_FAILED", "DNS lookup timed out."));
      diagnostics?.set("dns", "success", result.address);
    } catch { throw new DockerConnectionError("SSH_DNS_LOOKUP_FAILED", "DNS lookup failed for the SSH host."); }
  }
}

export function normalizeSshTarget(profile: SshDockerProfile): SshTarget {
  const clean = (value: string) => value.trim().replace(/[\r\n]+/g, "");
  const host = clean(profile.sshHost); const user = clean(profile.sshUsername); const socket = clean(profile.remoteSocketPath);
  if (!host || !user || !socket || /[\x00-\x1F\x7F]/.test(host + user + socket) || /:\/\//.test(host) || (/^[^\[]*:\d+$/.test(host)) || !socket.startsWith("/")) throw new DockerConnectionError("PROFILE_INVALID", "SSH host, username, and remote Docker socket path are invalid.");
  const port = Number(profile.sshPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new DockerConnectionError("SSH_PORT_INVALID", "SSH port must be an integer from 1 to 65535.");
  const unbracketed = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const ip = net.isIP(unbracketed);
  if (!ip && (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(unbracketed) || /[^\x00-\x7F]/.test(unbracketed))) throw new DockerConnectionError("SSH_HOST_INVALID", "SSH host must be a valid IPv4, IPv6, or DNS name without a URL scheme or embedded port.");
  return { host: unbracketed, port, requiresDns: !ip };
}

export function mapTcpError(error: NodeJS.ErrnoException): DockerConnectionError {
  switch (error.code) {
    case "ECONNREFUSED": return new DockerConnectionError("SSH_CONNECTION_REFUSED", "The SSH host refused the TCP connection.");
    case "ETIMEDOUT": return new DockerConnectionError("SSH_CONNECTION_TIMEOUT", "The SSH TCP connection timed out.");
    case "EHOSTUNREACH": case "ENETUNREACH": return new DockerConnectionError("SSH_NETWORK_UNREACHABLE", "No network route is available to the SSH host.");
    case "ECONNRESET": return new DockerConnectionError("SSH_CONNECTION_RESET", "The SSH TCP connection was reset.");
    case "ENOTFOUND": case "EAI_AGAIN": return new DockerConnectionError("SSH_DNS_LOOKUP_FAILED", "The SSH host name could not be resolved.");
    default: return new DockerConnectionError("UNKNOWN_CONNECTION_ERROR", "The SSH client could not open its TCP connection.", error.code);
  }
}
function mapSshError(error: Error & NodeJS.ErrnoException, keyboardInteractiveUsed: boolean, authentication: "password" | "private-key", username: string): DockerConnectionError {
  if ((error as Error & { level?: string }).level === "client-socket" || error.code) return mapTcpError(error);
  if (/timed out/i.test(error.message)) return new DockerConnectionError("SSH_HANDSHAKE_TIMEOUT", "SSH protocol handshake timed out.");
  if (/authentication|all configured authentication/i.test(error.message)) return new DockerConnectionError(keyboardInteractiveUsed ? "SSH_KEYBOARD_INTERACTIVE_REJECTED" : authentication === "private-key" ? "SSH_PRIVATE_KEY_REJECTED" : "SSH_PASSWORD_REJECTED", keyboardInteractiveUsed ? "The server rejected the keyboard-interactive password response." : authentication === "private-key" ? `The SSH server rejected the selected private key for user "${username}".` : `The SSH server rejected password authentication for user "${username}".`);
  return new DockerConnectionError("SSH_HANDSHAKE_FAILED", "SSH protocol handshake failed.");
}
function safeMessage(error: unknown): string { return error instanceof DockerConnectionError ? error.message : error instanceof Error ? "SSH connection failed. Open diagnostics for the failing stage." : "SSH connection failed."; }
function promiseTimeout<T>(promise: Promise<T>, timeout: number, error: Error): Promise<T> { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(error), timeout); promise.then((value) => { clearTimeout(timer); resolve(value); }, (reason) => { clearTimeout(timer); reject(reason); }); }); }
