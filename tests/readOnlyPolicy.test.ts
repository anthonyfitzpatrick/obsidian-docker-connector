import { describe, expect, it } from "vitest";
import { DockerApiClient } from "../src/services/DockerApiClient";
import type { DockerTransport } from "../src/connections/DockerTransport";
const transport: DockerTransport = { profile: { connectionType: "ssh", id: "p", name: "p", enabled: true, createdAt: "", updatedAt: "", sshHost: "127.0.0.1", sshPort: 22, sshUsername: "user", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock" }, connect: async () => {}, disconnect: async () => {}, isConnected: () => true, request: async <T,>() => ({} as T), testConnection: async () => ({ success: true, steps: [] }) };
describe("Docker read-only API policy", () => {
  it("allows inspection GET routes", async () => { await expect(new DockerApiClient(transport).get("/containers/json?all=true")).resolves.toEqual({}); });
  it("refuses traversal that would reach a route outside the allowlist", async () => {
    // Image identifiers come from Docker, but the allowlist is the boundary and
    // must not depend on that staying true.
    for (const path of ["/images/../../containers/abc/json", "/images/a/../../../json", "/images/../version/json"]) {
      await expect(new DockerApiClient(transport).get(path)).rejects.toThrow("read-only policy");
    }
    await expect(new DockerApiClient(transport).get("/images/repo/app:2/json")).resolves.toEqual({});
    await expect(new DockerApiClient(transport).get("/images/sha256:abc123/json")).resolves.toEqual({});
  });
  it("rejects mutation routes even without a UI", async () => { await expect(new DockerApiClient(transport).get("/containers/abc/start")).rejects.toThrow("read-only policy"); await expect(new DockerApiClient(transport).get("/images/create")).rejects.toThrow("read-only policy"); });
});
