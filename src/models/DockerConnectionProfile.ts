import type { DockerContainerSummary } from "../containers/ContainerModels";
import type { DockerImageSummary } from "../images/ImageModels";
import type { DockerVolumeSummary } from "../volumes/VolumeModels";
import type { DockerNetworkSummary } from "../networks/NetworkModels";

export type SshAuthenticationConfig =
  | { type: "password" }
  | { type: "private-key"; privateKeyPath: string };

export interface DockerHostProfileBase {
  id: string;
  name: string;
  description?: string;
  category?: string;
  connectionType: "local" | "ssh" | "docker-context" | "docker-tls";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
/** Non-secret SSH connection profile. Runtime credentials are never persisted. */
export interface SshDockerProfile extends DockerHostProfileBase {
  connectionType: "ssh";
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  authentication: SshAuthenticationConfig;
  remoteSocketPath: string;
  hostKeyFingerprint?: string;
}
export interface LocalDockerProfile extends DockerHostProfileBase {
  connectionType: "local";
  localEndpoint: { type: "unix-socket"; socketPath: string } | { type: "windows-named-pipe"; pipePath: string };
}
export type DockerContextEndpointType = "unix-socket" | "windows-named-pipe" | "ssh" | "tcp-tls" | "tcp-insecure" | "unknown";
export interface DockerContextProfileSnapshot { description?: string; isCurrentWhenSaved: boolean; endpointType: DockerContextEndpointType; endpointDisplay?: string; skipTlsVerify?: boolean; supported: boolean; importedAt: string; lastDiscoveredAt: string; }
export interface DockerContextProfile extends DockerHostProfileBase { connectionType: "docker-context"; contextName: string; contextSnapshot: DockerContextProfileSnapshot; }
export interface DockerTlsProfileSnapshot { caCertificateFingerprint?: string; clientCertificateFingerprint?: string; clientCertificateSubject?: string; clientCertificateIssuer?: string; clientCertificateValidFrom?: string; clientCertificateValidTo?: string; serverName: string; importedAt: string; lastValidatedAt?: string; }
export interface DockerTlsProfile extends DockerHostProfileBase { connectionType: "docker-tls"; host: string; port: number; serverName: string; caCertificatePath: string; clientCertificatePath: string; clientKeyPath: string; tlsSnapshot: DockerTlsProfileSnapshot; }
/**
 * Persisted, non-secret connection metadata. This discriminated union is the
 * routing boundary for every Docker connection. It intentionally contains file
 * paths and host identity metadata but never passwords, passphrases, key data,
 * certificate contents, environment values, or registry credentials.
 */
export type DockerConnectionProfile = SshDockerProfile | LocalDockerProfile | DockerContextProfile | DockerTlsProfile;
export type DockerConnectionType = DockerConnectionProfile["connectionType"];
export function isLocalDockerProfile(profile: DockerConnectionProfile): profile is LocalDockerProfile { return profile.connectionType === "local"; }
export function isSshDockerProfile(profile: DockerConnectionProfile): profile is SshDockerProfile { return profile.connectionType === "ssh"; }
export function isDockerContextProfile(profile: DockerConnectionProfile): profile is DockerContextProfile { return profile.connectionType === "docker-context"; }
export function isDockerTlsProfile(profile: DockerConnectionProfile): profile is DockerTlsProfile { return profile.connectionType === "docker-tls"; }
/** Presentation states used by the dashboard; inspection currently persists online, offline, and authentication-required snapshots. */
export type HostConnectionStatus = "unknown" | "connecting" | "online" | "offline" | "degraded" | "authentication-required";
/** An in-memory refresh result. Snapshots are not persisted and may be discarded on unload. */
export interface DockerHostSnapshot { hostId: string; daemonId?: string; status: HostConnectionStatus; refreshedAt: string; error?: string; stale?: boolean; system?: DockerSystemInfo; containers: DockerContainerSummary[]; images: DockerImageSummary[]; volumes: DockerVolumeSummary[]; networks: DockerNetworkSummary[]; }
export interface DockerSystemInfo { dockerVersion: string; apiVersion: string; operatingSystem: string; architecture: string; kernelVersion: string; cpuCount: number; totalMemory: number; }
