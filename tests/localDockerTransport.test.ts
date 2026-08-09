import { describe, expect, it } from "vitest";
import { LocalDockerTransport } from "../src/connections/LocalDockerTransport";
import type { LocalDockerProfile } from "../src/models/DockerConnectionProfile";

const profile: LocalDockerProfile = { id: "local", name: "Local", connectionType: "local", localEndpoint: { type: "unix-socket", socketPath: "/tmp/docker-connector-does-not-exist.sock" }, enabled: true, createdAt: "", updatedAt: "" };

describe("LocalDockerTransport endpoint validation", () => {
  it("preserves the specific local validation error in Test Connection diagnostics", async () => {
    await expect(new LocalDockerTransport(profile).testConnection()).resolves.toMatchObject({ success: false, safeErrorCode: "LOCAL_SOCKET_NOT_FOUND", safeErrorMessage: "Docker socket not found. Docker may not be running, or it may use a different socket." });
  });
});
