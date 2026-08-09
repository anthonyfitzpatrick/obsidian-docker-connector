import type { DockerComposeMetadata } from "./DockerComposeMetadata";

/** Read-only container view models. Documentation: [[Docker Connector - Container Data Model]] */
export type DockerContainerState = "created" | "running" | "paused" | "restarting" | "removing" | "exited" | "dead" | "unknown";
export type DockerContainerStateFilter = "all" | "running" | "stopped" | DockerContainerState;
export type DockerContainerHealth = "healthy" | "unhealthy" | "starting" | "none" | "unknown";
export type DockerContainerHealthFilter = "all" | DockerContainerHealth;
export type ContainerSortMode = "name-asc" | "name-desc" | "state" | "health" | "created-newest" | "created-oldest" | "image-asc" | "uptime-longest" | "uptime-shortest" | "restart-highest" | "restart-lowest";
export type ContainerDensity = "comfortable" | "compact";

export interface DockerPortSummary { privatePort?: number; publicPort?: number; protocol: string; ip?: string; type: "published" | "exposed"; }
export interface DockerMountSummary { type: string; source?: string; destination: string; readOnly?: boolean; name?: string; }
export interface DockerNetworkAttachmentSummary { name: string; }
export interface DockerContainerSummary {
  id: string; shortId: string; names: string[]; displayName: string; image: string; imageId?: string; command?: string;
  createdAt: string; createdTimestamp: number; state: DockerContainerState; statusText: string; health: DockerContainerHealth;
  exitCode?: number; restartCount?: number; ports: DockerPortSummary[]; mounts: DockerMountSummary[]; networks: DockerNetworkAttachmentSummary[];
  /** Docker labels remain available for safe read-only filtering; Compose identity is normalized separately below. */
  labels: Record<string, string>; compose?: DockerComposeMetadata; hostProfileId: string; mapperWarnings: string[];
}

export interface DockerContainerDetails {
  id: string; name: string; image: string; imageId?: string; createdAt: string; path?: string; args: string[]; command?: string;
  workingDirectory?: string; configuredUser?: string; hostname?: string; domainName?: string; state: DockerContainerStateDetails;
  restartPolicy?: DockerRestartPolicySummary; mounts: DockerMountDetails[]; networks: DockerNetworkAttachmentDetails[];
  portBindings: DockerPortBindingSummary[]; exposedPorts: string[]; labels: Record<string, string>; environmentVariableNames: string[];
  entrypoint: string[]; stopSignal?: string; stopTimeout?: number; tty?: boolean; openStdin?: boolean; readOnlyRootFilesystem?: boolean;
  privileged?: boolean; capAdd: string[]; capDrop: string[]; mapperWarnings: string[];
}
export interface DockerContainerStateDetails { status: DockerContainerState; running?: boolean; paused?: boolean; restarting?: boolean; oomKilled?: boolean; dead?: boolean; pid?: number; exitCode?: number; error?: string; startedAt?: string; finishedAt?: string; restartCount?: number; health?: { status: DockerContainerHealth; failingStreak?: number; latestResults: Array<{ exitCode?: number; output?: string; startedAt?: string; endedAt?: string }> }; }
export interface DockerRestartPolicySummary { name: string; maximumRetryCount?: number; }
export interface DockerMountDetails extends DockerMountSummary { driver?: string; propagation?: string; }
export interface DockerNetworkAttachmentDetails extends DockerNetworkAttachmentSummary { ipAddress?: string; globalIPv6Address?: string; gateway?: string; macAddress?: string; aliases: string[]; }
export interface DockerPortBindingSummary { containerPort: string; bindings: Array<{ hostIp?: string; hostPort?: string }>; }

export interface ContainersViewState {
  searchQuery: string; stateFilter: DockerContainerStateFilter; healthFilter: DockerContainerHealthFilter; networkFilter: string | null;
  updatesOnly: boolean; sortMode: ContainerSortMode; density: ContainerDensity; selectedContainerId: string | null;
  detailState: { status: "closed" } | { status: "loading"; containerId: string } | { status: "ready"; containerId: string; details: DockerContainerDetails } | { status: "error"; containerId: string; error: string };
}

export const DEFAULT_CONTAINERS_VIEW_STATE: ContainersViewState = { searchQuery: "", stateFilter: "all", healthFilter: "all", networkFilter: null, updatesOnly: false, sortMode: "name-asc", density: "comfortable", selectedContainerId: null, detailState: { status: "closed" } };
