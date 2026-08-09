import type { DockerContainerReference } from "../images/ImageModels";

/**
 * Normalized volume inventory and view-state types.
 *
 * The data model keeps the volume list useful without granting a UI any volume
 * mutation capability.  Detail state is explicit so stale or failed lazy
 * inspection results cannot be mistaken for a loaded volume.
 */
export type VolumeFilter = "all" | "in-use" | "unused";
export interface DockerVolumeSummary { id: string; name: string; driver: string; scope: string; mountpoint?: string; createdAt?: string; createdTimestamp?: number; labels: Record<string, string>; options: Record<string, string>; containersUsingVolume: number; referencingContainers: DockerContainerReference[]; inUse: boolean; dangling: boolean; hostProfileId: string; mapperWarnings: string[]; }
export interface DockerVolumeDetails { name: string; driver: string; scope: string; mountpoint?: string; createdAt?: string; labels: Record<string, string>; options: Record<string, string>; status?: Record<string, string>; containersUsingVolume: DockerContainerReference[]; }
export interface VolumesViewState { search: string; filter: VolumeFilter; driver: string | null; scope: string | null; sort: "name" | "driver" | "created-newest" | "created-oldest" | "usage-count"; selected: string | null; detail: { status: "closed" } | { status: "loading"; name: string } | { status: "ready"; name: string; value: DockerVolumeDetails } | { status: "error"; name: string; message: string }; }
export const DEFAULT_VOLUMES_STATE: VolumesViewState = { search: "", filter: "all", driver: null, scope: null, sort: "name", selected: null, detail: { status: "closed" } };
