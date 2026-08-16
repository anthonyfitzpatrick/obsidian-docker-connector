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

  it("classifies a password profile before creating a transport when the session credential is absent", async () => {
    let created = false;
    const snapshot = await new DockerInspectionService({
      authenticationRequirement: () => "Enter the SSH password to connect. Passwords are kept only for the current Obsidian session.",
      create: () => { created = true; throw new Error("must not create a transport"); }
    } as never).inspectHost(profile);

    expect(created).toBe(false);
    expect(snapshot).toMatchObject({ status: "authentication-required", error: "Enter the SSH password to connect. Passwords are kept only for the current Obsidian session." });
  });

  it("recognizes authentication errors emitted by the separately bundled desktop transport", async () => {
    const desktopBundleError = Object.assign(new Error("Enter the SSH password to connect."), { name: "DockerConnectionError", code: "SSH_PASSWORD_REQUIRED" });
    const snapshot = await new DockerInspectionService({ create: () => failingTransport(desktopBundleError as DockerConnectionError) } as never).inspectHost(profile);

    expect(snapshot).toMatchObject({ status: "authentication-required", error: "Password required to reconnect." });
  });

  it("keeps an encrypted SSH private-key passphrase request actionable across the desktop artifact boundary", async () => {
    const desktopBundleError = Object.assign(new Error("The selected private key requires a passphrase."), { name: "DockerConnectionError", code: "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED" });
    const snapshot = await new DockerInspectionService({ create: () => failingTransport(desktopBundleError as DockerConnectionError) } as never).inspectHost(profile);

    expect(snapshot).toMatchObject({ status: "authentication-required", error: "The selected private key requires a passphrase." });
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
  it("classifies an encrypted TLS key without its session passphrase as authentication required", async () => {
    const tls: DockerTlsProfile = { id: "tls", name: "TLS", enabled: true, createdAt: "", updatedAt: "", connectionType: "docker-tls", host: "docker.example.test", port: 2376, serverName: "docker.example.test", caCertificatePath: "/tmp/ca", clientCertificatePath: "/tmp/cert", clientKeyPath: "/tmp/key", tlsSnapshot: { serverName: "docker.example.test", importedAt: "" } };
    const snapshot = await new DockerInspectionService({ create: () => failingTransport(new DockerConnectionError("DOCKER_TLS_CLIENT_KEY_PASSPHRASE_REQUIRED", "Passphrase required.")) } as never).inspectHost(tls);
    expect(snapshot).toMatchObject({ status: "authentication-required", error: "Client Key Passphrase required to reconnect." });
  });

  it("returns a bounded degraded snapshot when one inventory endpoint fails", async () => {
    const transport = failingAfterVersion(new DockerConnectionError("DOCKER_API_REQUEST_FAILED", "Docker rejected /networks."));
    const snapshot = await new DockerInspectionService({ create: () => transport } as never).inspectHost(profile);

    expect(snapshot).toEqual(expect.objectContaining({ hostId: profile.id, status: "degraded", error: "Docker rejected /networks.", containers: [], images: [], volumes: [], networks: [] }));
  });

  it("contains malformed optional inventory data instead of leaking an exception", async () => {
    const responses: Record<string, unknown> = { "/version": { Version: "1", ApiVersion: "1.0" }, "/info": { OperatingSystem: "Linux", Architecture: "x86_64", KernelVersion: "k", NCPU: 1, MemTotal: 1 }, "/containers/json?all=true": [], "/images/json": [], "/volumes": {}, "/networks": [] };
    const transport: DockerTransport = { profile, connect: async () => undefined, disconnect: async () => undefined, isConnected: () => true, request: async (request) => responses[request.path] as never, testConnection: async () => ({ success: true, steps: [] }) };
    const snapshot = await new DockerInspectionService({ create: () => transport } as never).inspectHost(profile);

    expect(snapshot).toMatchObject({ status: "online", volumes: [] });
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

function failingAfterVersion(error: DockerConnectionError): DockerTransport {
  return {
    profile,
    connect: async () => undefined,
    disconnect: async () => undefined,
    isConnected: () => true,
    request: async (request) => {
      if (request.path === "/networks") throw error;
      if (request.path === "/version") return { Version: "1", ApiVersion: "1.0" } as never;
      if (request.path === "/info") return { OperatingSystem: "Linux", Architecture: "x86_64", KernelVersion: "k", NCPU: 1, MemTotal: 1 } as never;
      if (request.path === "/volumes") return { Volumes: [] } as never;
      return [] as never;
    },
    testConnection: async () => ({ success: false, steps: [] })
  };
}
