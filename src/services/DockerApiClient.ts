import type { DockerTransport } from "../connections/DockerTransport";

/**
 * Read-only Docker Engine API facade.
 *
 * This is deliberately a small path allowlist rather than a generic request
 * wrapper. Every inspection feature must opt into a known GET route here.
 * Docker mutations never pass through this class: they are implemented as
 * route-specific methods in DockerContainerActionService, where the opt-in,
 * input validation, transaction state, and rollback rules are enforced.
 */
const ALLOWED_PATHS = [/^\/version$/, /^\/info$/, /^\/containers\/json\?all=true$/, /^\/containers\/[a-f0-9]{12,64}\/json$/, /^\/images\/json(?:\?all=true)?$/, /^\/images\/(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9:._/@-]*\/json$/, /^\/volumes$/, /^\/volumes\/[a-zA-Z0-9._-]+$/, /^\/networks$/, /^\/networks\/[a-zA-Z0-9._-]+$/];
/** Enforces the read-only Docker API policy independently of all UI controls. */
export class DockerApiClient {
  constructor(private readonly transport: DockerTransport) {}
  /** Performs one explicitly allowlisted Docker inspection request. */
  async get<T>(path: string): Promise<T> { if (!ALLOWED_PATHS.some((pattern) => pattern.test(path))) throw new Error("Docker API request rejected by the read-only policy."); return this.transport.request<T>({ method: "GET", path }); }
  testConnection() { return this.transport.testConnection(); }
}
