import type { DockerContainerSummary } from "../containers/ContainerModels";
import type { DockerConnectionProfile, DockerHostSnapshot } from "../models/DockerConnectionProfile";
import type { PublicImageRelease } from "../services/PublicImageReleaseService";
import { profileConnectionStatus } from "../connections/ProfileConnectionState";

export type AttentionSeverity = "danger" | "warning" | "info";
export type AttentionTarget = "host" | "container" | "image";

export interface DashboardAttentionItem {
  id: string;
  target: AttentionTarget;
  severity: AttentionSeverity;
  label: string;
  title: string;
  description: string;
  hostProfileId: string;
  containerId?: string;
}

/** Selects actionable, read-only conditions for the Overview attention panel. */
export function selectAttentionItems(
  profiles: DockerConnectionProfile[],
  snapshots: ReadonlyMap<string, DockerHostSnapshot>,
  containers: DockerContainerSummary[],
  releaseForImage: (image: string) => PublicImageRelease | undefined
): DashboardAttentionItem[] {
  const hosts = profiles.flatMap((profile) => {
    const snapshot = snapshots.get(profile.id);
    const status = profileConnectionStatus(profile.id, snapshots);
    if (!snapshot || status === "online") return [];
    const label = status === "authentication-required" ? "Authentication required" : "Host attention";
    return [{ id: `host:${profile.id}`, target: "host" as const, severity: hostSeverity(snapshot.status), label, title: profile.name, description: snapshot.error ?? "This Docker host requires attention.", hostProfileId: profile.id }];
  });

  const containerItems = containers.flatMap((container) => containerAttention(container));
  return [...hosts, ...containerItems, ...imageReleaseItems(containers, releaseForImage)];
}

function containerAttention(container: DockerContainerSummary): DashboardAttentionItem[] {
  const base = { hostProfileId: container.hostProfileId, containerId: container.id };
  if (container.health === "unhealthy") return [{ id: `container:${container.id}:unhealthy`, target: "container", severity: "danger", label: "Unhealthy", title: container.displayName, description: "Docker reports this container as unhealthy.", ...base }];
  if (container.state === "restarting") return [{ id: `container:${container.id}:restarting`, target: "container", severity: "warning", label: "Restarting", title: container.displayName, description: "This container is repeatedly attempting to restart.", ...base }];
  if (container.state === "dead") return [{ id: `container:${container.id}:dead`, target: "container", severity: "danger", label: "Dead", title: container.displayName, description: "Docker reports this container as dead.", ...base }];
  if (container.state === "exited" && container.exitCode !== undefined && container.exitCode !== 0) return [{ id: `container:${container.id}:exit-${container.exitCode}`, target: "container", severity: "warning", label: `Exited (${container.exitCode})`, title: container.displayName, description: "This container stopped with a non-zero exit code.", ...base }];
  return [];
}

function imageReleaseItems(containers: DockerContainerSummary[], releaseForImage: (image: string) => PublicImageRelease | undefined): DashboardAttentionItem[] {
  const images = new Map<string, DockerContainerSummary[]>();
  containers.forEach((container) => { if (container.image && container.image !== "Unknown image") images.set(container.image, [...(images.get(container.image) ?? []), container]); });
  return [...images.entries()].flatMap(([image, users]) => {
    const release = releaseForImage(image);
    if (release?.state !== "update-available" || !release.availableVersion) return [];
    return [{ id: `image:${image}:${release.availableVersion}`, target: "image" as const, severity: "info" as const, label: "Minor/major update", title: image, description: `Public version ${release.availableVersion} is available. Patch-only releases are intentionally ignored.`, hostProfileId: users[0].hostProfileId }];
  });
}

function hostSeverity(status: DockerHostSnapshot["status"]): AttentionSeverity {
  return status === "offline" ? "danger" : status === "authentication-required" || status === "degraded" ? "warning" : "info";
}
