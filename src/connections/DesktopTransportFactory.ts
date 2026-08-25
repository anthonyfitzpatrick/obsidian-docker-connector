import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { RuntimeCredentialStore } from "../security/RuntimeCredentialStore";
import type { DockerTransport } from "./DockerTransport";
import { LocalDockerTransport } from "./LocalDockerTransport";
import { SshDockerTransport } from "./SshDockerTransport";
import { DockerContextDialStdioTransport } from "./DockerContextDialStdioTransport";
import { DockerMutualTlsTransport } from "./DockerMutualTlsTransport";

/** Loaded from the bundled main artifact only after the desktop capability gate. */
export function createDesktopTransport(profile: DockerConnectionProfile, credentials: RuntimeCredentialStore): DockerTransport {
  switch (profile.connectionType) {
    case "local": return new LocalDockerTransport(profile);
    case "ssh": return new SshDockerTransport(profile, () => ({ password: credentials.getPassword(profile.id), privateKeyPassphrase: credentials.getPrivateKeyPassphrase(profile.id) }));
    case "docker-context": return new DockerContextDialStdioTransport(profile);
    case "docker-tls": return new DockerMutualTlsTransport(profile, () => credentials.getTlsClientKeyPassphrase(profile.id));
  }
}
