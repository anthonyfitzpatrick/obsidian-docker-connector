/** Stable semantic identities for the seven primary Overview metrics. */
export const OVERVIEW_METRIC_ACCENTS = {
  hosts: "hosts",
  containers: "containers",
  running: "running",
  stopped: "stopped",
  images: "images",
  volumes: "volumes",
  networks: "networks"
} as const;

export type OverviewMetricAccent = typeof OVERVIEW_METRIC_ACCENTS[keyof typeof OVERVIEW_METRIC_ACCENTS];
