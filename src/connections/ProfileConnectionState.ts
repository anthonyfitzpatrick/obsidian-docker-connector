import type { DockerConnectionProfile, DockerHostSnapshot, HostConnectionStatus } from "../models/DockerConnectionProfile";

/**
 * The current, profile-scoped connection state consumed by every dashboard
 * surface. A snapshot is keyed only by the persisted profile ID; display
 * names, endpoints, and array positions never participate in the lookup.
 */
export function profileConnectionStatus(profileId: string, snapshots: ReadonlyMap<string, DockerHostSnapshot>): HostConnectionStatus {
  return snapshots.get(profileId)?.status ?? "unknown";
}

export function aggregateConnectionStatus(profiles: readonly DockerConnectionProfile[], snapshots: ReadonlyMap<string, DockerHostSnapshot>): HostConnectionStatus {
  const statuses = profiles.map((profile) => profileConnectionStatus(profile.id, snapshots));
  return statuses.includes("online") ? "online"
    : statuses.includes("authentication-required") ? "authentication-required"
      : statuses.includes("degraded") ? "degraded"
        : statuses.includes("offline") ? "offline"
          : statuses.includes("connecting") ? "connecting"
            : "unknown";
}

export interface ConnectionStateSummary {
  configured: number;
  online: number;
  needsSignIn: number;
}

export function connectionStateSummary(profiles: readonly DockerConnectionProfile[], snapshots: ReadonlyMap<string, DockerHostSnapshot>): ConnectionStateSummary {
  return profiles.reduce<ConnectionStateSummary>((summary, profile) => {
    const status = profileConnectionStatus(profile.id, snapshots);
    return {
      configured: summary.configured + 1,
      online: summary.online + (status === "online" ? 1 : 0),
      needsSignIn: summary.needsSignIn + (status === "authentication-required" ? 1 : 0)
    };
  }, { configured: 0, online: 0, needsSignIn: 0 });
}
