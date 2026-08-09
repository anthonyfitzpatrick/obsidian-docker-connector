import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";

/** Safe, compact metadata for configured-server cards. */
export function configuredServerConnection(profile: DockerConnectionProfile): { label: string; detail?: string } { switch (profile.connectionType) { case "local": return { label: "Local Docker", detail: profile.localEndpoint.type === "unix-socket" ? "Unix Socket" : "Windows Named Pipe" }; case "docker-context": return { label: "Docker Context", detail: `Context: ${profile.contextName}` }; case "ssh": return { label: profile.authentication.type === "password" ? "SSH (Password)" : "SSH (Private Key)", detail: `Host: ${profile.sshHost}` }; case "docker-tls": return { label: "Docker API (Mutual TLS)", detail: `${profile.host}:${profile.port}` }; default: return assertNever(profile); } }
function assertNever(profile: never): never { throw new Error(`Unsupported connection profile: ${String(profile)}`); }
