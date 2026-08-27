import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { multiHostResourceLabel } from "../src/ui/HostResourceLabel";
import type { DockerConnectionProfile, DockerHostSnapshot } from "../src/models/DockerConnectionProfile";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const snapshot = (hostId: string): DockerHostSnapshot => ({ hostId, status: "online", refreshedAt: "", containers: [], images: [], volumes: [], networks: [] });
const profile = (id: string, name: string): DockerConnectionProfile => ({ id, name, connectionType: "local", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" }, enabled: true, createdAt: "", updatedAt: "" });

describe("multi-host resource labels", () => {
  const profiles = [profile("a", "Remote Docker"), profile("b", "Docker Desktop")];

  it("names the owning connection when several daemons are in view", () => {
    const snapshots = [snapshot("a"), snapshot("b")];
    expect(multiHostResourceLabel(snapshots, profiles, "b")).toBe("Host · Docker Desktop");
  });

  it("stays silent for a single daemon, where every resource has one owner", () => {
    expect(multiHostResourceLabel([snapshot("a")], profiles, "a")).toBeUndefined();
    expect(multiHostResourceLabel([], profiles, "a")).toBeUndefined();
  });

  it("falls back to the profile ID when the profile is gone", () => {
    expect(multiHostResourceLabel([snapshot("a"), snapshot("b")], profiles, "deleted")).toBe("Host · deleted");
  });

  it("labels network, volume, and image cards from the rendered snapshots", () => {
    for (const path of ["src/networks/NetworksTab.ts", "src/volumes/VolumesTab.ts", "src/images/ImagesTab.ts"]) {
      const tab = source(path);
      expect(tab, path).toContain("multiHostResourceLabel(snapshots, this.plugin.settings.profiles");
    }
  });
});
