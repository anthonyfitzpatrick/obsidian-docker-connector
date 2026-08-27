import type { DockerConnectionProfile, DockerConnectionType } from "../models/DockerConnectionProfile";

/**
 * Workflow capabilities derived from a profile's transport type. This is
 * descriptive rather than an authorization mechanism: mutation methods
 * independently enforce the session management opt-in at their backend gate.
 */
export interface DockerConnectionCapabilities {
  connectionType: DockerConnectionType;
  supportsAutomaticRefresh: boolean;
  supportsContainerActions: boolean;
}

/** Central capability policy used for the four persisted connection variants. */
export function connectionCapabilities(profile: DockerConnectionProfile): DockerConnectionCapabilities {
  switch (profile.connectionType) {
    case "local":
    case "docker-context":
    case "ssh":
    case "docker-tls":
      return { connectionType: profile.connectionType, supportsAutomaticRefresh: true, supportsContainerActions: true };
    default:
      return assertNever(profile);
  }
}
function assertNever(value: never): never { throw new Error(`Unsupported Docker connection profile: ${String(value)}`); }
