import { describe, expect, it } from "vitest";
import { DockerInspectionService } from "../src/services/DockerInspectionService";
import { DockerConnectionError, type DockerTransport } from "../src/connections/DockerTransport";
import type { SshDockerProfile } from "../src/models/DockerConnectionProfile";
import type { DockerTlsProfile } from "../src/models/DockerConnectionProfile";

const profile: SshDockerProfile = { id: "wolf-359", name: "Wolf 359", enabled: true, createdAt: "", updatedAt: "", sshHost: "46.62.226.180", sshPort: 22, sshUsername: "obsidian", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock" };

describe("DockerInspectionService", () => {
  it("marks a saved host as authentication required when its runtime password is absent", async () => {
    const transport: DockerTransport = {
      profile,
      connect: async () => undefined,
      disconnect: async () => undefined,
      isConnected: () => false,
      request: async () => { throw new DockerConnectionError("SSH_PASSWORD_REQUIRED", "Enter the SSH password for this session."); },
      testConnection: async () => ({ success: false, steps: [] })
    };
    const connections = { create: () => transport };
    const snapshot = await new DockerInspectionService(connections as never).inspectHost(profile);
    expect(snapshot).toMatchObject({ status: "authentication-required", error: "Password required to reconnect." });
  });

  it("marks rejected SSH credentials as authentication required instead of offline", async () => {
    const transport = failingTransport(new DockerConnectionError("SSH_PASSWORD_REJECTED", "The SSH server rejected the username or password."));
    const snapshot = await new DockerInspectionService({ create: () => transport } as never).inspectHost(profile);
    expect(snapshot).toMatchObject({ status: "authentication-required", error: "The SSH server rejected the username or password." });
  });

  it("marks Docker-side failures as degraded instead of offline", async () => {
    const transport = failingTransport(new DockerConnectionError("DOCKER_SOCKET_PERMISSION_DENIED", "The SSH user cannot access Docker."));
    const snapshot = await new DockerInspectionService({ create: () => transport } as never).inspectHost(profile);
    expect(snapshot).toMatchObject({ status: "degraded", error: "The SSH user cannot access Docker." });
  });

  it("reserves offline for failures that prevent reaching the SSH host", async () => {
    const transport = failingTransport(new DockerConnectionError("SSH_CONNECTION_TIMEOUT", "The SSH TCP connection timed out."));
    const snapshot = await new DockerInspectionService({ create: () => transport } as never).inspectHost(profile);
    expect(snapshot).toMatchObject({ status: "offline", error: "The SSH TCP connection timed out." });
  });
  it("loads a complete TLS snapshot through the shared read-only API pipeline", async () => {
    const tls: DockerTlsProfile = { id: "tls", name: "TLS", enabled: true, createdAt: "", updatedAt: "", connectionType: "docker-tls", host: "docker.example.test", port: 2376, serverName: "docker.example.test", caCertificatePath: "/tmp/ca", clientCertificatePath: "/tmp/cert", clientKeyPath: "/tmp/key", tlsSnapshot: { serverName: "docker.example.test", importedAt: "" } };
    const calls: string[] = []; const responses: Record<string, unknown> = { "/version": { Version: "1", ApiVersion: "1.0" }, "/info": { OperatingSystem: "Linux", Architecture: "x86_64", KernelVersion: "k", NCPU: 1, MemTotal: 1 }, "/containers/json?all=true": [], "/images/json": [], "/volumes": { Volumes: [] }, "/networks": [] };
    const transport: DockerTransport = { profile: tls, connect: async () => undefined, disconnect: async () => undefined, isConnected: () => true, request: async (request) => { calls.push(request.path); return responses[request.path] as never; }, testConnection: async () => ({ success: true, steps: [] }) };
    const snapshot = await new DockerInspectionService({ create: () => transport } as never).inspectHost(tls);
    expect(snapshot).toMatchObject({ status: "online", hostId: "tls" }); expect(calls.sort()).toEqual(Object.keys(responses).sort());
  });
});

function failingTransport(error: DockerConnectionError): DockerTransport {
  return {
    profile,
    connect: async () => undefined,
    disconnect: async () => undefined,
    isConnected: () => false,
    request: async () => { throw error; },
    testConnection: async () => ({ success: false, steps: [] })
  };
}
