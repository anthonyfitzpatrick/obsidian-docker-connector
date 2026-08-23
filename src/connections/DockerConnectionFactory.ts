import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { RuntimeCredentialStore } from "../security/RuntimeCredentialStore";
import type { DockerTransport } from "./DockerTransport";
import { DockerConnectionError } from "./DockerTransport";
import { GatewayDockerTransport } from "./GatewayDockerTransport";
import { isProfileSupportedOnPlatform, platformCapabilities } from "../platform/PlatformCapabilities";

type DesktopTransportModule = { createDesktopTransport(profile: Exclude<DockerConnectionProfile, { connectionType: "gateway" }>, credentials: RuntimeCredentialStore): DockerTransport };
type DesktopTransportLoader = () => DesktopTransportModule;

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
  constructor(private readonly loadDesktop: DesktopTransportLoader = loadBundledDesktopTransportModule) {}
  create(profile: DockerConnectionProfile): DockerTransport {
    const current = this.transports.get(profile.id);
    if (current && current.profile === profile) return current;
    if (current) void current.disconnect();
    const transport = profile.connectionType === "gateway"
      ? new GatewayDockerTransport(profile, () => this.credentials.getGatewayToken(profile.id))
      : !isProfileSupportedOnPlatform(profile.connectionType, platformCapabilities())
        ? new UnsupportedDesktopTransport(profile)
        : this.loadDesktop().createDesktopTransport(profile, this.credentials);
    this.transports.set(profile.id, transport);
    return transport;
  }
  setRuntimePassword(profileId: string, password: string): void { this.credentials.setPassword(profileId, password); }
  hasRuntimePassword(profileId: string): boolean { return this.credentials.hasPassword(profileId); }
  /**
   * Password-authenticated SSH profiles can be classified before creating a
   * desktop transport. This prevents a missing session secret from being
   * mistaken for a host or Docker failure during startup refresh.
   */
  authenticationRequirement(profile: DockerConnectionProfile): string | undefined {
    return profile.connectionType === "ssh" && profile.authentication.type === "password" && !this.credentials.hasPassword(profile.id)
      ? "Enter the SSH password to connect. Passwords are kept only for the current Obsidian session."
      : undefined;
  }
  clearRuntimePassword(profileId: string): void { this.credentials.clearPassword(profileId); }
  setRuntimePrivateKeyPassphrase(profileId: string, passphrase: string): void { this.credentials.setPrivateKeyPassphrase(profileId, passphrase); }
  setRuntimeTlsClientKeyPassphrase(profileId: string, passphrase: string): void { this.credentials.setTlsClientKeyPassphrase(profileId, passphrase); }
  setRuntimeGatewayToken(profileId: string, token: string): void { this.credentials.setGatewayToken(profileId, token); }
  clearRuntimeCredentials(profileId: string): void { this.credentials.clearProfile(profileId); }
  async disconnect(profileId: string): Promise<void> { const transport = this.transports.get(profileId); this.transports.delete(profileId); await transport?.disconnect(); }
  async disconnectAll(): Promise<void> { await Promise.all([...this.transports.values()].map((transport) => transport.disconnect())); this.transports.clear(); this.credentials.clearAll(); }
}
export function loadBundledDesktopTransportModule(): DesktopTransportModule {
  // Esbuild includes this module in main.js while delaying its initialization
  // until the desktop capability gate in create() has passed.
  return require("./DesktopTransportFactory") as DesktopTransportModule;
}
class UnsupportedDesktopTransport implements DockerTransport {
  constructor(readonly profile: Exclude<DockerConnectionProfile, { connectionType: "gateway" }>) {}
  async connect(): Promise<void> { throw new DockerConnectionError("DESKTOP_CONNECTION_METHOD", "This connection method is available on desktop Obsidian only. Configure a Docker Connector Gateway to use it on mobile."); }
  async disconnect(): Promise<void> {}
  isConnected(): boolean { return false; }
  async request<T>(): Promise<T> { await this.connect(); throw new Error("unreachable"); }
  async testConnection() { return { success: false, steps: [{ id: "platform", label: "Platform capability", status: "error" as const, message: "This connection method is desktop only." }] }; }
}
