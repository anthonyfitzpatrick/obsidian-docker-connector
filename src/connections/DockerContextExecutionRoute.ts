import type { DockerContextEndpoint } from "./DockerContextDiscovery";
import type { LocalDockerEndpoint } from "./LocalEndpointDiscovery";

/**
 * Selects the physical transport for a freshly discovered Docker Context.
 * A Context remains a Context profile; this only prevents local Docker
 * Desktop Contexts from needlessly going through the CLI byte-stream helper.
 */
export type DockerContextExecutionRoute =
  | { kind: "local"; endpoint: LocalDockerEndpoint }
  | { kind: "context-dial-stdio" }
  | { kind: "unsupported"; reasonCode: string; safeMessage: string };

export function resolveDockerContextExecutionRoute(endpoint: DockerContextEndpoint | undefined): DockerContextExecutionRoute {
  if (!endpoint) return unsupported("DOCKER_CONTEXT_UNSUPPORTED", "The Docker Context does not define a supported Docker endpoint.");
  if (endpoint.type === "unix-socket") return { kind: "local", endpoint: { type: "unix-socket", socketPath: endpoint.rawHost.slice("unix://".length) } };
  if (endpoint.type === "windows-named-pipe") return { kind: "local", endpoint: { type: "windows-named-pipe", pipePath: endpoint.rawHost.slice("npipe://".length) } };
  if (endpoint.type === "ssh") return { kind: "context-dial-stdio" };
  if (endpoint.type === "tcp-insecure") return unsupported("DOCKER_CONTEXT_INSECURE_TCP", "The Docker Context uses insecure TCP and cannot be used.");
  return unsupported("DOCKER_CONTEXT_UNSUPPORTED", "Unsupported Docker Context endpoint. Docker Connector requires a local socket, Windows named pipe, or SSH Context endpoint.");
}

function unsupported(reasonCode: string, safeMessage: string): DockerContextExecutionRoute {
  return { kind: "unsupported", reasonCode, safeMessage };
}
