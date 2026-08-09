import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { SshDockerTransport } from "./SshDockerTransport";
import { RuntimeCredentialStore } from "../security/RuntimeCredentialStore";
import { LocalDockerTransport } from "./LocalDockerTransport";
import type { DockerTransport } from "./DockerTransport";
import { DockerContextDialStdioTransport } from "./DockerContextDialStdioTransport";
import { DockerMutualTlsTransport } from "./DockerMutualTlsTransport";

/**
 * Creates and owns one transport per persisted profile ID.
 *
 * The factory is also the only bridge from runtime credentials to transports.
 * Profile settings contain no credentials; disconnectAll first lets transports
 * release sockets/processes and then clears every session-only secret.
 */
export class DockerConnectionFactory {
  private readonly transports = new Map<string, DockerTransport>();
  private readonly credentials = new RuntimeCredentialStore();
  create(profile: DockerConnectionProfile): DockerTransport {
    const current = this.transports.get(profile.id);
    if (current && current.profile === profile) return current;
    if (current) void current.disconnect();
    const transport = createTransport(profile, this.credentials);
    this.transports.set(profile.id, transport);
    return transport;
  }
  setRuntimePassword(profileId: string, password: string): void { this.credentials.setPassword(profileId, password); }
  hasRuntimePassword(profileId: string): boolean { return this.credentials.hasPassword(profileId); }
  clearRuntimePassword(profileId: string): void { this.credentials.clearPassword(profileId); }
  setRuntimePrivateKeyPassphrase(profileId: string, passphrase: string): void { this.credentials.setPrivateKeyPassphrase(profileId, passphrase); }
  setRuntimeTlsClientKeyPassphrase(profileId: string, passphrase: string): void { this.credentials.setTlsClientKeyPassphrase(profileId, passphrase); }
  clearRuntimeCredentials(profileId: string): void { this.credentials.clearProfile(profileId); }
  async disconnect(profileId: string): Promise<void> { const transport = this.transports.get(profileId); this.transports.delete(profileId); await transport?.disconnect(); }
  async disconnectAll(): Promise<void> { await Promise.all([...this.transports.values()].map((transport) => transport.disconnect())); this.transports.clear(); this.credentials.clearAll(); }
}
function createTransport(profile: DockerConnectionProfile, credentials: RuntimeCredentialStore): DockerTransport { switch (profile.connectionType) { case "local": return new LocalDockerTransport(profile); case "ssh": return new SshDockerTransport(profile, () => ({ password: credentials.getPassword(profile.id), privateKeyPassphrase: credentials.getPrivateKeyPassphrase(profile.id) })); case "docker-context": return new DockerContextDialStdioTransport(profile); case "docker-tls": return new DockerMutualTlsTransport(profile, () => credentials.getTlsClientKeyPassphrase(profile.id)); default: return assertNever(profile); } }
function assertNever(profile: never): never { throw new Error(`UNSUPPORTED_CONNECTION_PROFILE: ${String(profile)}`); }
