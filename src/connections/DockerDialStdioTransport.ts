import type { Client, ClientChannel } from "ssh2";
import { DockerConnectionError } from "./DockerTransport";

const DIAL_COMMAND = "docker system dial-stdio";
const STDERR_LIMIT = 16 * 1024;

/**
 * Persistent Docker HTTP stream backed by a constrained SSH exec channel.
 *
 * Documentation: Docker Connector - SSH Transport.md
 */
export class DockerDialStdioTransport {
  private channel?: ClientChannel;
  private buffer = "";
  private pending?: { resolve: (response: DockerHttpResponse) => void; reject: (error: Error) => void; timer: number };
  private queue: Array<() => void> = [];
  private closed = false;
  private stderr = "";
  private exitCode?: number;
  private exitSignal?: string;

  static async open(client: Client): Promise<DockerDialStdioTransport> {
    const transport = new DockerDialStdioTransport();
    await transport.start(client);
    return transport;
  }

  async request(path: string, timeoutMs: number, method: "GET" | "POST" | "DELETE" = "GET", body?: string): Promise<DockerHttpResponse> {
    if (this.closed || !this.channel) throw new DockerConnectionError("DOCKER_DIAL_STDIO_CLOSED", "Docker dial-stdio is no longer running.");
    return new Promise((resolve, reject) => {
      const run = () => {
        const timer = window.setTimeout(() => this.finishPending(new DockerConnectionError(path === "/_ping" ? "DOCKER_PING_FAILED" : "DOCKER_HTTP_FAILED", `Docker ${path} did not respond within ${timeoutMs / 1000} seconds.`)), timeoutMs);
        this.pending = { resolve, reject, timer };
        this.channel?.write(`${method} ${path} HTTP/1.1\r\nHost: docker\r\nConnection: keep-alive\r\n${body ? `Content-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n` : ""}\r\n${body ?? ""}`);
        this.consumeResponse();
      };
      if (this.pending) this.queue.push(run); else run();
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.finishPending(new DockerConnectionError("DOCKER_DIAL_STDIO_CLOSED", "Docker dial-stdio was closed."));
    this.queue = [];
    this.channel?.destroy();
    this.channel = undefined;
  }

  private async start(client: Client): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (error: Error) => { if (settled) return; settled = true; reject(error); };
      client.exec(DIAL_COMMAND, (error, channel) => {
        if (error || !channel) { fail(mapDialFailure(error?.message ?? "")); return; }
        this.channel = channel;
        channel.setEncoding("utf8");
        channel.on("data", (chunk: string) => { this.buffer += chunk; this.consumeResponse(); });
        channel.stderr?.setEncoding("utf8");
        channel.stderr?.on("data", (chunk: string) => { this.stderr = `${this.stderr}${chunk}`.slice(-STDERR_LIMIT); });
        channel.once("error", (channelError: Error) => this.closeWithError(mapDialFailure(channelError.message || this.stderr)));
        channel.once("close", () => this.closeWithError(mapDialFailure(this.stderr)));
        channel.once("exit", (code: number | undefined, signal: string | undefined) => { this.exitCode = code; this.exitSignal = signal; if (code && code !== 0) this.closeWithError(mapDialFailure(this.stderr, code, signal)); });
        settled = true;
        resolve();
      });
    });
  }

  private consumeResponse(): void {
    if (!this.pending) return;
    const parsed = tryParseHttpResponse(this.buffer);
    if (!parsed) return;
    this.buffer = this.buffer.slice(parsed.consumed);
    const pending = this.pending;
    this.pending = undefined;
    window.clearTimeout(pending.timer);
    pending.resolve(parsed.response);
    this.queue.shift()?.();
  }

  private finishPending(error: Error): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pending.reject(error);
  }

  private closeWithError(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.finishPending(error);
    this.queue = [];
    this.channel = undefined;
  }
}

export interface DockerHttpResponse { status: number; body: string; }

export function tryParseHttpResponse(raw: string): { response: DockerHttpResponse; consumed: number } | undefined {
  const split = raw.indexOf("\r\n\r\n");
  if (split < 0) return undefined;
  const header = raw.slice(0, split);
  const status = Number(/^HTTP\/1\.[01]\s+(\d+)/.exec(header)?.[1]);
  if (!status) throw new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Docker response status was invalid.");
  const bodyStart = split + 4;
  if (/transfer-encoding:\s*chunked/i.test(header)) return tryParseChunked(raw, bodyStart, status);
  if (status === 204 || status === 304) return { response: { status, body: "" }, consumed: bodyStart };
  const length = Number(/content-length:\s*(\d+)/i.exec(header)?.[1]);
  if (!Number.isFinite(length)) throw new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Docker response did not include Content-Length or chunked encoding.");
  if (raw.length < bodyStart + length) return undefined;
  return { response: { status, body: raw.slice(bodyStart, bodyStart + length) }, consumed: bodyStart + length };
}

function tryParseChunked(raw: string, bodyStart: number, status: number): { response: DockerHttpResponse; consumed: number } | undefined {
  let offset = bodyStart;
  let body = "";
  while (true) {
    const lineEnd = raw.indexOf("\r\n", offset);
    if (lineEnd < 0) return undefined;
    const size = Number.parseInt(raw.slice(offset, lineEnd), 16);
    if (!Number.isFinite(size)) throw new DockerConnectionError("DOCKER_RESPONSE_INVALID", "Chunked Docker response was invalid.");
    offset = lineEnd + 2;
    if (raw.length < offset + size + 2) return undefined;
    if (size === 0) return { response: { status, body }, consumed: offset + 2 };
    body += raw.slice(offset, offset + size);
    offset += size + 2;
  }
}

export function mapDialFailure(message: string, exitCode?: number, exitSignal?: string): DockerConnectionError {
  const details = safeTechnicalDetail(message, exitCode, exitSignal);
  if (/command not found|docker:\s*not found|executable file not found/i.test(message)) return new DockerConnectionError("DOCKER_CLI_NOT_FOUND", "Docker CLI is not available for the SSH user.", details);
  if (/permission denied while trying to connect|got permission denied while trying to connect|dial unix .*permission denied|connect:\s*permission denied/i.test(message)) return new DockerConnectionError("DOCKER_SOCKET_PERMISSION_DENIED", "SSH login succeeded, but the SSH user cannot access Docker on the remote server. Ask the server administrator to add the user to the docker group, then fully disconnect and reconnect before retrying.", details);
  if (/cannot connect to the docker daemon|is the docker daemon running|dial unix .*no such file or directory|connection refused/i.test(message)) return new DockerConnectionError("DOCKER_DAEMON_UNAVAILABLE", "Docker daemon is unavailable on the remote host.", details);
  if (/unknown command.*dial-stdio|dial-stdio.*unknown command|not a docker command/i.test(message)) return new DockerConnectionError("DOCKER_DIAL_STDIO_UNSUPPORTED", "The installed Docker CLI does not support docker system dial-stdio.", details);
  if (/permission denied/i.test(message)) return new DockerConnectionError("DOCKER_SOCKET_PERMISSION_DENIED", "SSH login succeeded, but the SSH user cannot access Docker on the remote server. Ask the server administrator to add the user to the docker group, then fully disconnect and reconnect before retrying.", details);
  return new DockerConnectionError("DOCKER_DIAL_STDIO_START_FAILED", "Could not start docker system dial-stdio on the remote host.", details);
}

function safeTechnicalDetail(message: string, exitCode?: number, exitSignal?: string): string | undefined {
  const normalized = message.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(-512);
  const exit = exitCode !== undefined ? `exit ${exitCode}` : exitSignal ? `signal ${exitSignal}` : "";
  return [exit, normalized].filter(Boolean).join("; ") || undefined;
}
