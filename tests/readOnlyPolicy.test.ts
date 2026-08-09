import { describe, expect, it } from "vitest";
import { DockerApiClient } from "../src/services/DockerApiClient";
import type { DockerTransport } from "../src/connections/DockerTransport";
const transport: DockerTransport = { profile: { id: "p", name: "p", enabled: true, createdAt: "", updatedAt: "", sshHost: "127.0.0.1", sshPort: 22, sshUsername: "user", remoteSocketPath: "/var/run/docker.sock" }, connect: async () => {}, disconnect: async () => {}, isConnected: () => true, request: async () => ({}), testConnection: async () => ({ success: true, steps: [] }) };
describe("Docker read-only API policy", () => {
  it("allows inspection GET routes", async () => { await expect(new DockerApiClient(transport).get("/containers/json?all=true")).resolves.toEqual({}); });
  it("rejects mutation routes even without a UI", async () => { await expect(new DockerApiClient(transport).get("/containers/abc/start")).rejects.toThrow("read-only policy"); await expect(new DockerApiClient(transport).get("/images/create")).rejects.toThrow("read-only policy"); });
});
