import type { DockerConnectionProfile, DockerHostSnapshot, DockerSystemInfo } from "../models/DockerConnectionProfile";
import { DockerConnectionFactory } from "../connections/DockerConnectionFactory";
import { DockerApiClient } from "./DockerApiClient";
import { DockerConnectionError } from "../connections/DockerTransport";
import { ContainerMapper } from "../containers/ContainerMapper";
import { ImageMapper } from "../images/ImageMapper";
import { VolumeMapper } from "../volumes/VolumeMapper";
import { NetworkMapper } from "../networks/NetworkMapper";

interface EngineVersion { Version: string; ApiVersion: string; }
interface EngineInfo { ID?: string; OperatingSystem: string; Architecture: string; KernelVersion: string; NCPU: number; MemTotal: number; }
interface EngineContainer { Id: string; Names: string[]; Image: string; ImageID: string; State: string; Status: string; Created: number; Ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>; Mounts: Array<{ Name?: string; Source?: string; Destination: string }>; }
interface EngineImage { Id: string; RepoTags: string[]; Size: number; Created: number; Containers: number; }
interface EngineVolume { Name: string; Driver: string; Mountpoint: string; }
interface EngineNetwork { Id: string; Name: string; Driver: string; Scope: string; Containers?: Record<string, unknown>; }

/** Maps Docker's read-only Engine API responses into UI models. */
export class DockerInspectionService {
  constructor(private readonly connections: DockerConnectionFactory) {}

  async inspectHost(host: DockerConnectionProfile): Promise<DockerHostSnapshot> {
    const refreshedAt = new Date().toISOString();
    const authenticationRequired = this.connections.authenticationRequirement?.(host);
    if (authenticationRequired) {
      return { hostId: host.id, status: "authentication-required", refreshedAt, error: authenticationRequired, containers: [], images: [], volumes: [], networks: [] };
    }
    try {
      const [version, info, containers, images, volumes, networks] = await Promise.all([
        new DockerApiClient(this.connections.create(host)).get<EngineVersion>("/version"),
        new DockerApiClient(this.connections.create(host)).get<EngineInfo>("/info"),
        new DockerApiClient(this.connections.create(host)).get<EngineContainer[]>("/containers/json?all=true"),
        new DockerApiClient(this.connections.create(host)).get<EngineImage[]>("/images/json"),
        new DockerApiClient(this.connections.create(host)).get<{ Volumes: EngineVolume[] }>("/volumes"),
        new DockerApiClient(this.connections.create(host)).get<EngineNetwork[]>("/networks")
      ]);
      const mappedContainers = containers.map((container) => ContainerMapper.summary(container, host.id));
      return {
        hostId: host.id, daemonId: info.ID?.trim() || undefined, status: "online", refreshedAt,
        system: this.mapSystem(version, info),
        containers: mappedContainers, images: images.map((image) => ImageMapper.summary(image, host.id, mappedContainers)),
        volumes: (volumes.Volumes ?? []).map((volume) => VolumeMapper.summary(volume, host.id, mappedContainers)), networks: networks.map((network) => NetworkMapper.summary(network, host.id, mappedContainers))
      };
    } catch (error) {
      const failure = classifyHostFailure(error);
      return {
        hostId: host.id,
        status: failure.status,
        refreshedAt,
        error: failure.error,
        containers: [], images: [], volumes: [], networks: []
      };
    }
  }

  private mapSystem(version: EngineVersion, info: EngineInfo): DockerSystemInfo { return { dockerVersion: version.Version, apiVersion: version.ApiVersion, operatingSystem: info.OperatingSystem, architecture: info.Architecture, kernelVersion: info.KernelVersion, cpuCount: info.NCPU, totalMemory: info.MemTotal }; }
}

/**
 * Keeps an unavailable SSH endpoint distinct from a host that was reached but
 * could not authenticate or complete its Docker inventory request.
 */
export function classifyHostFailure(error: unknown): Pick<DockerHostSnapshot, "status" | "error"> {
  const failure = connectionFailure(error);
  if (!failure) {
    return { status: "degraded", error: error instanceof Error ? error.message : String(error) };
  }

  if (failure.code === "SSH_PASSWORD_REQUIRED") {
    return { status: "authentication-required", error: "Password required to reconnect." };
  }
  if (failure.code === "SSH_HOST_KEY_UNTRUSTED") {
    return { status: "authentication-required", error: "SSH host key verification required. Open Edit to verify and explicitly trust the received fingerprint." };
  }
  if (failure.code === "DOCKER_TLS_CLIENT_KEY_PASSPHRASE_REQUIRED") return { status: "authentication-required", error: "Client Key Passphrase required to reconnect." };
  if (AUTHENTICATION_ERROR_CODES.has(failure.code)) {
    return { status: "authentication-required", error: failure.message };
  }
  if (OFFLINE_ERROR_CODES.has(failure.code)) {
    return { status: "offline", error: failure.message };
  }
  return { status: "degraded", error: failure.message };
}

/**
 * Error codes/messages are the stable internal contract. The structural
 * fallback also handles errors that cross an integration boundary.
 */
function connectionFailure(error: unknown): { code: string; message: string } | undefined {
  if (error instanceof DockerConnectionError) return error;
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; message?: unknown };
  return typeof candidate.code === "string" && typeof candidate.message === "string"
    ? { code: candidate.code, message: candidate.message }
    : undefined;
}

const AUTHENTICATION_ERROR_CODES = new Set([
  "SSH_PASSWORD_REJECTED",
  "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED",
  "SSH_KEYBOARD_INTERACTIVE_REJECTED",
  "SSH_AUTHENTICATION_FAILED",
  "SSH_AUTHENTICATION_METHOD_UNSUPPORTED"
]);

const OFFLINE_ERROR_CODES = new Set([
  "SSH_DNS_LOOKUP_FAILED",
  "SSH_CONNECTION_REFUSED",
  "SSH_CONNECTION_TIMEOUT",
  "SSH_NETWORK_UNREACHABLE",
  "SSH_CONNECTION_RESET",
  "SSH_HANDSHAKE_TIMEOUT",
  "SSH_HANDSHAKE_FAILED"
]);
