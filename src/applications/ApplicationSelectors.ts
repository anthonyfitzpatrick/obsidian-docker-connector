import type { DockerContainerSummary } from "../containers/ContainerModels";
import { getDockerComposeMetadata } from "../containers/DockerComposeMetadata";
import type { DockerNetworkSummary } from "../networks/NetworkModels";
import type { DockerVolumeSummary } from "../volumes/VolumeModels";
import type { ContainerImageUpdateStatus } from "../services/ContainerImageUpdateService";
import type { ApplicationFilters, DockerApplicationServiceSummary, DockerApplicationStatus, DockerApplicationSummary } from "./ApplicationModels";

const UNLABELLED_SERVICE = "Unlabelled Compose container";

/**
 * Builds read-only application summaries from an already-normalized snapshot.
 * Only the official Compose project label creates a group: naming conventions,
 * networks, images, and filesystem paths are never guessed. One-off containers
 * remain in total counts but affect service health only while running.
 */
export function buildDockerApplications(containers: readonly DockerContainerSummary[], updateStatuses: ReadonlyMap<string, ContainerImageUpdateStatus>, _networks: readonly DockerNetworkSummary[] = [], _volumes: readonly DockerVolumeSummary[] = []): DockerApplicationSummary[] {
  const groups = new Map<string, DockerContainerSummary[]>();
  for (const container of containers) { const compose = composeMetadata(container); if (compose) { const id = `${container.hostProfileId}:${compose.project}`; groups.set(id, [...(groups.get(id) ?? []), container]); } }
  return [...groups.values()].map(build).sort((a, b) => a.displayName.localeCompare(b.displayName));

  function build(group: DockerContainerSummary[]): DockerApplicationSummary {
    const first = group[0], compose = composeMetadata(first)!;
    const projectName = compose.project;
    const regular = group.filter((container) => !composeMetadata(container)?.oneOff || container.state === "running");
    const serviceGroups = new Map<string, DockerContainerSummary[]>();
    for (const container of group) { const name = composeMetadata(container)?.service ?? UNLABELLED_SERVICE; serviceGroups.set(name, [...(serviceGroups.get(name) ?? []), container]); }
    const updates = (container: DockerContainerSummary) => updateStatuses.get(key(container))?.state === "available";
    const services = [...serviceGroups.entries()].map(([serviceName, items]): DockerApplicationServiceSummary => ({ serviceName, containerIds: items.map((item) => item.id), containerCount: items.length, runningCount: items.filter((item) => item.state === "running").length, healthyCount: items.filter((item) => item.health === "healthy").length, unhealthyCount: items.filter((item) => item.health === "unhealthy").length, imageReferences: unique(items.map((item) => item.image)), updateAvailableCount: items.filter(updates).length })).sort((a, b) => a.serviceName.localeCompare(b.serviceName));
    const runningCount = group.filter((item) => item.state === "running").length, stoppedCount = group.filter((item) => ["exited", "dead", "created"].includes(item.state)).length, pausedCount = group.filter((item) => item.state === "paused").length, restartingCount = group.filter((item) => item.state === "restarting").length, unhealthyCount = group.filter((item) => item.health === "unhealthy").length, healthyCount = group.filter((item) => item.health === "healthy").length;
    const statusCounts = { runningCount: regular.filter((item) => item.state === "running").length, stoppedCount: regular.filter((item) => ["exited", "dead", "created"].includes(item.state)).length, pausedCount: regular.filter((item) => item.state === "paused").length, restartingCount: regular.filter((item) => item.state === "restarting").length, unhealthyCount: regular.filter((item) => item.health === "unhealthy").length };
    return { profileId: first.hostProfileId, projectName, displayName: projectName, containerIds: group.map((item) => item.id), containerCount: group.length, runningCount, stoppedCount, pausedCount, restartingCount, unhealthyCount, healthyCount, updateAvailableCount: group.filter(updates).length, serviceCount: services.length, services, networkNames: unique(group.flatMap((item) => item.networks.map((network) => network.name))), volumeNames: unique(group.flatMap((item) => item.mounts.filter((mount) => mount.type === "volume").map((mount) => mount.name).filter((name): name is string => Boolean(name)))), imageReferences: unique(group.map((item) => item.image)), composeVersion: compose.version, workingDirectory: compose.workingDirectory, configFiles: compose.configFiles.length ? compose.configFiles : undefined, status: applicationStatus(regular, statusCounts) };
  }
}

/** Pure search, status, and update filter without re-parsing Compose labels. */
export function filterDockerApplications(applications: readonly DockerApplicationSummary[], filters: ApplicationFilters): DockerApplicationSummary[] { const query = filters.search.trim().toLowerCase(); return applications.filter((app) => (!query || [app.displayName, app.projectName, ...app.services.map((service) => service.serviceName)].some((value) => value.toLowerCase().includes(query))) && (filters.status === "all" || app.status === filters.status) && (!filters.updatesOnly || app.updateAvailableCount > 0)); }
/** Stable application list ordering used by the renderer and tests. */
export function sortDockerApplications(applications: readonly DockerApplicationSummary[], sort: ApplicationFilters["sort"]): DockerApplicationSummary[] { return [...applications].sort((a, b) => sort === "name-desc" ? b.displayName.localeCompare(a.displayName) : sort === "container-count" ? b.containerCount - a.containerCount || a.displayName.localeCompare(b.displayName) : sort === "updates" ? b.updateAvailableCount - a.updateAvailableCount || a.displayName.localeCompare(b.displayName) : sort === "status" ? a.status.localeCompare(b.status) || a.displayName.localeCompare(b.displayName) : a.displayName.localeCompare(b.displayName)); }
function applicationStatus(containers: readonly DockerContainerSummary[], counts: { runningCount: number; stoppedCount: number; pausedCount: number; restartingCount: number; unhealthyCount: number }): DockerApplicationStatus { if (!containers.length) return "unknown"; if (counts.unhealthyCount || counts.restartingCount) return "degraded"; if (containers.every((item) => ["exited", "dead", "created"].includes(item.state))) return "stopped"; if (counts.runningCount && (counts.stoppedCount || counts.pausedCount)) return "mixed"; return counts.runningCount ? "healthy" : "unknown"; }
function unique(values: Array<string | undefined>): string[] { return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)); }
/** Always read Compose identity from labels so hand-built test fixtures cannot bypass the authoritative source. */
function composeMetadata(container: DockerContainerSummary) { return getDockerComposeMetadata(container.labels); }
export function applicationContainer(container: DockerContainerSummary, updateStatuses: ReadonlyMap<string, ContainerImageUpdateStatus>) { const compose = composeMetadata(container); return { id: container.id, displayName: container.displayName, serviceName: compose?.service ?? UNLABELLED_SERVICE, state: container.state, health: container.health, image: container.image, oneOff: compose?.oneOff ?? false, updateAvailable: updateStatuses.get(key(container))?.state === "available" }; }
function key(container: DockerContainerSummary): string { return `${container.hostProfileId}:${container.id}`; }
