import type { DockerConnectionProfile, DockerHostSnapshot } from "./DockerConnectionProfile";

/** Docker Engine IDs identify inventories; profile IDs continue to identify transports. */
export function logicalDockerHostId(snapshot: DockerHostSnapshot): string {
  return snapshot.daemonId ? `daemon:${snapshot.daemonId}` : `profile:${snapshot.hostId}`;
}

/** A selection key prevents equal Docker object IDs on different daemons colliding. */
export function dockerResourceKey(snapshot: DockerHostSnapshot, resourceId: string): string {
  return `${logicalDockerHostId(snapshot)}\u0000${resourceId}`;
}

export function selectedInventorySnapshots(
  profiles: DockerConnectionProfile[],
  snapshots: ReadonlyMap<string, DockerHostSnapshot>,
  selectedHostId: string,
): DockerHostSnapshot[] {
  const candidates = profiles
    .filter((profile) => selectedHostId === "all" || profile.id === selectedHostId)
    .map((profile) => snapshots.get(profile.id))
    .filter((snapshot): snapshot is DockerHostSnapshot => Boolean(snapshot));
  return selectedHostId === "all" ? representativeDaemonSnapshots(candidates) : candidates;
}

/**
 * Selects one stable read-only inventory per daemon. Online, non-stale results
 * win; every remaining tie is settled by configured profile order.
 */
export function representativeDaemonSnapshots(snapshots: DockerHostSnapshot[]): DockerHostSnapshot[] {
  const representatives = new Map<string, { snapshot: DockerHostSnapshot; index: number }>();
  snapshots.forEach((snapshot, index) => {
    const key = logicalDockerHostId(snapshot);
    const current = representatives.get(key);
    if (!current || compareSnapshots(snapshot, index, current.snapshot, current.index) > 0) {
      representatives.set(key, { snapshot, index });
    }
  });
  return [...representatives.values()].sort((left, right) => left.index - right.index).map(({ snapshot }) => snapshot);
}

function compareSnapshots(candidate: DockerHostSnapshot, candidateIndex: number, current: DockerHostSnapshot, currentIndex: number): number {
  const usability = snapshotUsability(candidate) - snapshotUsability(current);
  if (usability) return usability;
  // Refresh time deliberately does not participate. Profiles that share a
  // daemon complete within the same refresh pass, so preferring the newest
  // result made the representative - and the host name shown beside every
  // resource it owns - change from one refresh to the next.
  return currentIndex - candidateIndex;
}

function snapshotUsability(snapshot: DockerHostSnapshot): number {
  return snapshot.status === "online" ? snapshot.stale ? 1 : 2 : 0;
}

