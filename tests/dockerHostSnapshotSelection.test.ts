import { describe, expect, it } from "vitest";
import type { DockerConnectionProfile, DockerHostSnapshot } from "../src/models/DockerConnectionProfile";
import { dockerResourceKey, logicalDockerHostId, selectedInventorySnapshots } from "../src/models/DockerHostSnapshotSelection";

const profiles = [profile("ssh-a", "ssh"), profile("context-b", "docker-context"), profile("tls-c", "docker-tls")];

describe("Docker host snapshot selection", () => {
  it("uses one deterministic representative inventory for profiles targeting the same daemon", () => {
    const first = snapshot("ssh-a", "daemon-a", "2026-08-26T10:00:00.000Z", "online", { containers: ["same-container", "a-only"], images: ["same-image"], volumes: ["shared-volume"], networks: ["same-network"] });
    const representative = snapshot("context-b", "daemon-a", "2026-08-26T11:00:00.000Z", "online", { containers: ["same-container", "b-only"], images: ["same-image", "b-image"], volumes: ["shared-volume", "b-volume"], networks: ["same-network", "b-network"] });
    const other = snapshot("tls-c", "daemon-c", "2026-08-26T09:00:00.000Z", "online", { containers: ["same-container"], images: ["same-image"], volumes: ["shared-volume"], networks: ["same-network"] });
    const selected = selectedInventorySnapshots(profiles, new Map([[first.hostId, first], [representative.hostId, representative], [other.hostId, other]]), "all");

    expect(selected).toEqual([representative, other]);
    expect(selected.flatMap((item) => item.containers)).toHaveLength(3);
    expect(selected.flatMap((item) => item.images)).toHaveLength(3);
    expect(selected.flatMap((item) => item.volumes)).toHaveLength(3);
    expect(selected.flatMap((item) => item.networks)).toHaveLength(3);
    expect(selected[0].containers[0].hostProfileId).toBe("context-b");
    expect(dockerResourceKey(selected[0], "same-container")).not.toBe(dockerResourceKey(selected[1], "same-container"));
  });

  it("keeps explicit profile selection, missing daemon IDs, and equal names on different daemons separate", () => {
    const first = snapshot("ssh-a", undefined, "2026-08-26T10:00:00.000Z", "online", { volumes: ["data"] });
    const second = snapshot("context-b", undefined, "2026-08-26T11:00:00.000Z", "online", { volumes: ["data"] });
    const sameNameElsewhere = snapshot("tls-c", "daemon-c", "2026-08-26T12:00:00.000Z", "online", { volumes: ["data"] });
    const snapshots = new Map([[first.hostId, first], [second.hostId, second], [sameNameElsewhere.hostId, sameNameElsewhere]]);

    expect(selectedInventorySnapshots(profiles, snapshots, "all")).toEqual([first, second, sameNameElsewhere]);
    expect(selectedInventorySnapshots(profiles, snapshots, "context-b")).toEqual([second]);
    expect(logicalDockerHostId(first)).toBe("profile:ssh-a");
    expect(logicalDockerHostId(sameNameElsewhere)).toBe("daemon:daemon-c");
  });

  it("prefers usable snapshots, then freshness, then configured profile order", () => {
    const stale = snapshot("ssh-a", "daemon-a", "2026-08-26T12:00:00.000Z", "online", {}, true);
    const fresh = snapshot("context-b", "daemon-a", "2026-08-26T11:00:00.000Z", "online");
    const newestTie = snapshot("tls-c", "daemon-a", "2026-08-26T11:00:00.000Z", "online");
    const snapshots = new Map([[stale.hostId, stale], [fresh.hostId, fresh], [newestTie.hostId, newestTie]]);

    expect(selectedInventorySnapshots(profiles, snapshots, "all")).toEqual([fresh]);
  });
});

function profile(id: string, connectionType: DockerConnectionProfile["connectionType"]): DockerConnectionProfile {
  return { id, name: "Repeated display name", enabled: true, createdAt: "", updatedAt: "", connectionType } as DockerConnectionProfile;
}

function snapshot(
  hostId: string,
  daemonId: string | undefined,
  refreshedAt: string,
  status: DockerHostSnapshot["status"],
  resources: Partial<Record<"containers" | "images" | "volumes" | "networks", string[]>> = {},
  stale = false,
): DockerHostSnapshot {
  return {
    hostId, daemonId, refreshedAt, status, stale,
    containers: (resources.containers ?? []).map((id) => ({ id, hostProfileId: hostId })),
    images: (resources.images ?? []).map((id) => ({ id, hostProfileId: hostId })),
    volumes: (resources.volumes ?? []).map((id) => ({ id, name: id, hostProfileId: hostId })),
    networks: (resources.networks ?? []).map((id) => ({ id, hostProfileId: hostId })),
  } as DockerHostSnapshot;
}
