import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { hasControlCharacter, hasNonAsciiCharacter } from "./text";

/** Canonical profile normalisation used before persistence and connection attempts. */
export function normalizeProfile(profile: DockerConnectionProfile): DockerConnectionProfile {
  const clean = (value: string | undefined) => value?.trim().replace(/[\r\n]+/g, "");
  if (profile.connectionType === "local") { const normalized = { ...profile, name: clean(profile.name) ?? "", description: clean(profile.description) || undefined, category: clean(profile.category) || undefined, localEndpoint: profile.localEndpoint.type === "unix-socket" ? { type: "unix-socket" as const, socketPath: clean(profile.localEndpoint.socketPath) ?? "" } : { type: "windows-named-pipe" as const, pipePath: clean(profile.localEndpoint.pipePath) ?? "" } }; validateProfile(normalized); return normalized; }
  if (profile.connectionType === "docker-context") { const normalized = { ...profile, name: clean(profile.name) ?? "", description: clean(profile.description) || undefined, category: clean(profile.category) || undefined, contextName: clean(profile.contextName) ?? "" }; validateProfile(normalized); return normalized; }
  if (profile.connectionType === "docker-tls") { const normalized = { ...profile, name: clean(profile.name) ?? "", description: clean(profile.description) || undefined, category: clean(profile.category) || undefined, host: clean(profile.host) ?? "", serverName: clean(profile.serverName) ?? "", caCertificatePath: clean(profile.caCertificatePath) ?? "", clientCertificatePath: clean(profile.clientCertificatePath) ?? "", clientKeyPath: clean(profile.clientKeyPath) ?? "" }; validateProfile(normalized); return normalized; }
  const normalized: DockerConnectionProfile = {
    ...profile, connectionType: "ssh",
    name: clean(profile.name) ?? "",
    description: clean(profile.description) || undefined,
    category: clean(profile.category) || undefined,
    sshHost: clean(profile.sshHost) ?? "",
    sshPort: Number(profile.sshPort),
    sshUsername: clean(profile.sshUsername) ?? "",
    authentication: profile.authentication.type === "private-key" ? { type: "private-key", privateKeyPath: clean(profile.authentication.privateKeyPath) ?? "" } : { type: "password" },
    remoteSocketPath: clean(profile.remoteSocketPath) ?? "",
    hostKeyFingerprint: clean(profile.hostKeyFingerprint) || undefined
  };
  validateProfile(normalized);
  return normalized;
}

export function validateProfile(profile: DockerConnectionProfile): void {
  const unsafe = hasControlCharacter;
  if (!profile.name) throw new Error("Friendly name is required.");
  if (profile.connectionType === "docker-tls") { if (!profile.host || hasControlCharacter(profile.host) || /:\/\/|[/?#@]/.test(profile.host)) throw new Error("DOCKER_TLS_HOST_INVALID"); if (!Number.isInteger(profile.port) || profile.port < 1 || profile.port > 65535) throw new Error("DOCKER_TLS_PORT_INVALID"); if (!profile.serverName || hasControlCharacter(profile.serverName) || /:\/\/|[/?#@]/.test(profile.serverName)) throw new Error("DOCKER_TLS_SERVER_NAME_INVALID"); if (!profile.caCertificatePath || !profile.clientCertificatePath || !profile.clientKeyPath) throw new Error("DOCKER_TLS_PROFILE_INVALID"); return; }
  if (profile.connectionType === "docker-context") { if (!profile.contextName || hasControlCharacter(profile.contextName)) throw new Error("DOCKER_CONTEXT_NAME_REQUIRED"); if (["tcp-insecure", "unknown"].includes(profile.contextSnapshot.endpointType) || !profile.contextSnapshot.supported) throw new Error("DOCKER_CONTEXT_UNSUPPORTED"); return; }
  if (profile.connectionType === "local") { if (profile.localEndpoint.type === "unix-socket" && !profile.localEndpoint.socketPath) throw new Error("Local Docker socket is required."); if (profile.localEndpoint.type === "windows-named-pipe" && !profile.localEndpoint.pipePath) throw new Error("Local Docker pipe is required."); return; }
  if (!profile.sshHost) throw new Error("SSH host is required.");
  if (unsafe(profile.sshHost) || unsafe(profile.sshUsername) || unsafe(profile.remoteSocketPath)) throw new Error("Connection fields cannot contain control characters.");
  if (/:\/\//.test(profile.sshHost) || /^[^[]*:\d+$/.test(profile.sshHost)) throw new Error("SSH host must not include a URL scheme or port.");
  const host = profile.sshHost.startsWith("[") && profile.sshHost.endsWith("]") ? profile.sshHost.slice(1, -1) : profile.sshHost;
  if (!isIpLiteral(host) && (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(host) || hasNonAsciiCharacter(host))) throw new Error("SSH host must be a valid IPv4, IPv6, or DNS hostname.");
  if (!Number.isInteger(profile.sshPort) || profile.sshPort < 1 || profile.sshPort > 65535) throw new Error("SSH port must be an integer from 1 to 65535.");
  if (!profile.sshUsername) throw new Error("SSH username is required.");
  if (profile.authentication.type === "private-key" && !profile.authentication.privateKeyPath) throw new Error("Private key file is required.");
  if (!profile.remoteSocketPath.startsWith("/")) throw new Error("Remote Docker socket must be an absolute Unix path.");
  // The remote capability probe runs through a shell, so the socket path must
  // not be able to contribute shell syntax even if quoting were to regress.
  if (/['"`$\\]/.test(profile.remoteSocketPath)) throw new Error("Remote Docker socket path cannot contain quotes, backslashes, or shell expansion characters.");
}
function isIpLiteral(value: string): boolean { return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || /^[0-9a-fA-F:]+$/.test(value) && value.includes(":"); }
