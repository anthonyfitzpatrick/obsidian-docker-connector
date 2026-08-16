import type { GatewayDockerProfile } from "../models/DockerConnectionProfile";
import { DockerConnectionError, type DockerApiRequest, type DockerConnectionTestResult, type DockerTransport } from "./DockerTransport";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_PATHS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^\/_ping$/, () => "/v1/ping"], [/^\/version$/, () => "/v1/version"], [/^\/info$/, () => "/v1/info"],
  [/^\/containers\/json(?:\?.*)?$/, () => "/v1/containers"],
  [/^\/containers\/([^/?]+)\/json$/, (m) => `/v1/containers/${encodeURIComponent(m[1])}`],
  [/^\/images\/json(?:\?.*)?$/, () => "/v1/images"],
  [/^\/images\/([^/?]+)\/json$/, (m) => `/v1/images/${encodeURIComponent(m[1])}`],
  [/^\/volumes(?:\?.*)?$/, () => "/v1/volumes"], [/^\/volumes\/([^/?]+)$/, (m) => `/v1/volumes/${encodeURIComponent(m[1])}`],
  [/^\/networks(?:\?.*)?$/, () => "/v1/networks"], [/^\/networks\/([^/?]+)$/, (m) => `/v1/networks/${encodeURIComponent(m[1])}`]
];

/** Browser/WebView transport for the deliberately allowlisted companion gateway. */
export class GatewayDockerTransport implements DockerTransport {
  private connected = false;
  constructor(readonly profile: GatewayDockerProfile, private readonly token: () => string | undefined) {}
  async connect(): Promise<void> { await this.request<string>({ method: "GET", path: "/_ping", responseType: "text" }); this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  isConnected(): boolean { return this.connected; }
  async request<T>(request: DockerApiRequest): Promise<T> {
    if (request.method !== "GET") throw new DockerConnectionError("GATEWAY_READ_ONLY", "The mobile gateway accepts only approved read operations.");
    const token = this.token();
    if (!token) throw new DockerConnectionError("GATEWAY_AUTH_REQUIRED", "Enter the gateway access token for this session.");
    const endpoint = mapPath(request.path);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${this.profile.gatewayUrl.replace(/\/$/, "")}${endpoint}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: controller.signal });
      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) throw new DockerConnectionError("GATEWAY_RESPONSE_TOO_LARGE", "Gateway response exceeded the mobile safety limit.");
      if (!response.ok) throw new DockerConnectionError(response.status === 401 ? "GATEWAY_AUTH_REQUIRED" : "GATEWAY_REQUEST_FAILED", response.status === 401 ? "Gateway authentication was rejected." : `Gateway returned HTTP ${response.status}.`, undefined, response.status);
      return (request.responseType === "text" ? text : request.responseType === "empty" ? undefined : JSON.parse(text)) as T;
    } catch (error) {
      if (error instanceof DockerConnectionError) throw error;
      throw new DockerConnectionError("GATEWAY_UNREACHABLE", error instanceof Error && error.name === "AbortError" ? "Gateway request timed out." : "Could not reach the Docker Connector Gateway.");
    } finally { window.clearTimeout(timer); }
  }
  async testConnection(): Promise<DockerConnectionTestResult> {
    try { await this.connect(); const version = await this.request<{ Version?: string; ApiVersion?: string }>({ method: "GET", path: "/version" }); return { success: true, steps: [{ id: "gateway", label: "Authenticated HTTPS gateway", status: "success" }], dockerVersion: version.Version, apiVersion: version.ApiVersion }; }
    catch (error) { return { success: false, steps: [{ id: "gateway", label: "Authenticated HTTPS gateway", status: "error", message: error instanceof Error ? error.message : "Gateway connection failed." }] }; }
  }
}
function mapPath(path: string): string { for (const [pattern, route] of REQUEST_PATHS) { const match = path.match(pattern); if (match) return route(match); } throw new DockerConnectionError("GATEWAY_ROUTE_NOT_ALLOWED", "This Docker operation is not available through the mobile gateway."); }
