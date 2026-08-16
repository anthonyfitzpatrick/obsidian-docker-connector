import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { getDockerConnectionTypeDisplayName } from "../connections/DockerConnectionTypePresentation";

/** Safe, compact metadata for configured-server cards. */
export function configuredServerConnection(profile: DockerConnectionProfile): { label: string; detail?: string } {
  const label = getDockerConnectionTypeDisplayName(profile.connectionType);
  switch (profile.connectionType) {
    case "local":
      return { label, detail: profile.localEndpoint.type === "unix-socket" ? "Local Docker Unix socket" : "Windows named pipe" };
    case "docker-context":
      return { label, detail: `Docker Context: ${profile.contextName}` };
    case "ssh":
      return { label, detail: `SSH Host: ${profile.sshHost} · ${profile.authentication.type === "password" ? "Password" : "Private Key"}` };
    case "docker-tls":
      return { label, detail: `Docker Host: ${profile.host}:${profile.port}` };
    case "gateway":
      return { label, detail: profile.gatewayUrl };
  }
}
