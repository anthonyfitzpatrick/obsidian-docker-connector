import type { DockerConnectionProfile, DockerConnectionType } from "../models/DockerConnectionProfile";

/**
 * UI and workflow capabilities derived from a profile's safe transport type.
 * This is descriptive rather than an authorization mechanism: mutation methods
 * independently enforce the persisted management opt-in at their backend gate.
 */
export interface DockerConnectionCapabilities { connectionType: DockerConnectionType; requiresRuntimeCredential: boolean; supportsAutomaticRefresh: boolean; supportsDashboard: boolean; supportsTestConnection: boolean; supportsReports: boolean; supportsLazyDetails: boolean; supportsContainerActions: boolean; supportsHostKeyVerification: boolean; supportsCertificateVerification: boolean; }
const BASE = { supportsAutomaticRefresh: true, supportsDashboard: true, supportsTestConnection: true, supportsReports: true, supportsLazyDetails: true, supportsContainerActions: true };
/** Central capability policy used for the four persisted connection variants. */
export function connectionCapabilities(profile: DockerConnectionProfile): DockerConnectionCapabilities {
  switch (profile.connectionType) {
    case "local": return { connectionType: "local", ...BASE, requiresRuntimeCredential: false, supportsHostKeyVerification: false, supportsCertificateVerification: false };
    case "docker-context": return { connectionType: "docker-context", ...BASE, requiresRuntimeCredential: false, supportsHostKeyVerification: false, supportsCertificateVerification: false };
    case "ssh": return { connectionType: "ssh", ...BASE, requiresRuntimeCredential: profile.authentication.type === "password", supportsHostKeyVerification: true, supportsCertificateVerification: false };
    case "docker-tls": return { connectionType: "docker-tls", ...BASE, requiresRuntimeCredential: false, supportsHostKeyVerification: false, supportsCertificateVerification: true };
    case "gateway": return { connectionType: "gateway", ...BASE, requiresRuntimeCredential: true, supportsHostKeyVerification: false, supportsCertificateVerification: true, supportsContainerActions: false };
    default: return assertNever(profile);
  }
}
function assertNever(value: never): never { throw new Error(`Unsupported Docker connection profile: ${String(value)}`); }
