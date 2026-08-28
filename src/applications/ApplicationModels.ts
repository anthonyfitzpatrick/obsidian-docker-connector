/** Read-only, normalized Docker Compose application models derived from labels. */
export type DockerApplicationStatus = "healthy" | "degraded" | "stopped" | "mixed" | "unknown";
export type ApplicationSort = "name-asc" | "name-desc" | "container-count" | "updates" | "status";
export interface DockerApplicationServiceSummary {
  /** Exact Compose service label used both for grouping and display. */
  serviceName: string; containerIds: string[]; containerCount: number; runningCount: number;
  healthyCount: number; unhealthyCount: number; imageReferences: string[]; updateAvailableCount: number;
}
export interface DockerApplicationSummary {
  profileId: string; projectName: string; displayName: string; containerIds: string[]; containerCount: number;
  runningCount: number; stoppedCount: number; pausedCount: number; restartingCount: number; unhealthyCount: number; healthyCount: number; updateAvailableCount: number;
  serviceCount: number; services: DockerApplicationServiceSummary[]; networkNames: string[]; volumeNames: string[]; imageReferences: string[];
  composeVersion?: string; workingDirectory?: string; configFiles?: string[]; status: DockerApplicationStatus;
}
export interface ApplicationFilters { search: string; status: "all" | DockerApplicationStatus; updatesOnly: boolean; sort: ApplicationSort; }
export const DEFAULT_APPLICATION_FILTERS: ApplicationFilters = { search: "", status: "all", updatesOnly: false, sort: "name-asc" };
