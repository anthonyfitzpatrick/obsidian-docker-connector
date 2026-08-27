import type { DockerConnectionProfile, DockerHostSnapshot } from "../models/DockerConnectionProfile";

/**
 * Distinguishes identically named Docker resources when more than one daemon is
 * in view. Every daemon has its own `bridge`, `host`, and `none` network, so an
 * All Docker hosts inventory is ambiguous without the owning connection's name.
 * A single-snapshot view needs no label and returns undefined.
 */
export function multiHostResourceLabel(
  snapshots: readonly DockerHostSnapshot[],
  profiles: readonly DockerConnectionProfile[],
  hostProfileId: string
): string | undefined {
  if (snapshots.length < 2) return undefined;
  const profile = profiles.find((item) => item.id === hostProfileId);
  return `Host · ${profile?.name ?? hostProfileId}`;
}
