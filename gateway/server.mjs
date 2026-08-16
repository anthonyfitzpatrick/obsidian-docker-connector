import http from "node:http";
import crypto from "node:crypto";

const MAX_BODY = 5 * 1024 * 1024;
const routes = new Map([
  ["/v1/ping", "/_ping"], ["/v1/version", "/version"], ["/v1/info", "/info"],
  ["/v1/containers", "/containers/json?all=1"], ["/v1/images", "/images/json"], ["/v1/volumes", "/volumes"], ["/v1/networks", "/networks"]
]);
const safeId = /^[A-Za-z0-9_.:@+\-=]{1,255}$/;

export function createGateway({ token, dockerRequest, timeoutMs = 10_000, maxResponseBytes = MAX_BODY }) {
  if (typeof token !== "string" || token.length < 32) throw new Error("GATEWAY_TOKEN must be at least 32 characters.");
  const expected = Buffer.from(token);
  return http.createServer(async (request, response) => {
    if (request.method !== "GET") return send(response, 405, { error: "method_not_allowed" });
    if (!authorised(request.headers.authorization, expected)) return send(response, 401, { error: "authentication_required" });
    const target = dockerPath(new URL(request.url ?? "/", "https://gateway.invalid").pathname);
    if (!target) return send(response, 404, { error: "route_not_allowed" });
    try {
      const result = await withTimeout(dockerRequest(target), timeoutMs);
      if (Buffer.byteLength(result.body) > maxResponseBytes) return send(response, 502, { error: "response_too_large" });
      response.writeHead(result.status, { "content-type": result.contentType ?? "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }); response.end(result.body);
    } catch { send(response, 502, { error: "docker_unavailable" }); }
  });
}
export function dockerPath(pathname) {
  if (routes.has(pathname)) return routes.get(pathname);
  const match = pathname.match(/^\/v1\/(containers|images|volumes|networks)\/([^/]+)$/);
  if (!match || !safeId.test(decodeURIComponent(match[2]))) return undefined;
  const [, kind, id] = match;
  if (kind === "containers" || kind === "images") return `/${kind}/${encodeURIComponent(id)}/json`;
  return `/${kind}/${encodeURIComponent(id)}`;
}
function authorised(header, expected) { if (!header?.startsWith("Bearer ")) return false; const candidate = Buffer.from(header.slice(7)); return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected); }
function send(response, status, body) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(body)); }
function withTimeout(promise, milliseconds) { return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), milliseconds))]); }
