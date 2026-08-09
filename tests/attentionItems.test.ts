import { describe, expect, it } from "vitest";
import { selectAttentionItems } from "../src/overview/AttentionItems";
import type { DockerContainerSummary } from "../src/containers/ContainerModels";
import type { SshDockerProfile } from "../src/models/DockerConnectionProfile";

const profile: SshDockerProfile = { id: "host", name: "Production", enabled: true, createdAt: "", updatedAt: "", sshHost: "example.test", sshPort: 22, sshUsername: "operator", remoteSocketPath: "/var/run/docker.sock" };
const container = (changes: Partial<DockerContainerSummary> = {}): DockerContainerSummary => ({ id: "container", shortId: "container", names: ["web"], displayName: "web", image: "nginx:1.0", createdAt: "", createdTimestamp: 0, state: "running", statusText: "Up", health: "healthy", ports: [], mounts: [], networks: [], labels: {}, hostProfileId: "host", mapperWarnings: [], ...changes });

describe("overview attention items", () => {
  it("surfaces host connectivity conditions", () => {
    const snapshots = new Map([["host", { hostId: "host", status: "authentication-required" as const, refreshedAt: "", error: "Password required.", containers: [], images: [], volumes: [], networks: [] }]]);
    expect(selectAttentionItems([profile], snapshots, [], () => undefined)).toMatchObject([{ target: "host", label: "Authentication required", title: "Production" }]);
  });

  it("surfaces unhealthy, restarting, dead, and failed containers", () => {
    const items = selectAttentionItems([profile], new Map(), [container({ health: "unhealthy" }), container({ id: "restart", state: "restarting" }), container({ id: "dead", state: "dead" }), container({ id: "failed", state: "exited", exitCode: 137 })], () => undefined);
    expect(items.map((item) => item.label)).toEqual(["Unhealthy", "Restarting", "Dead", "Exited (137)"]);
  });

  it("shows public release advisories only when a major or minor version is available", () => {
    const items = selectAttentionItems([profile], new Map(), [container()], () => ({ state: "update-available", currentVersion: "1.0", availableVersion: "1.1", checkedAt: "" }));
    expect(items).toMatchObject([{ target: "image", label: "Minor/major update", description: expect.stringContaining("1.1") }]);
  });
});
