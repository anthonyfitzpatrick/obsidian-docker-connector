import { describe, expect, it } from "vitest";
import { aggregateConnectionStatus, connectionStateSummary, profileConnectionStatus } from "../src/connections/ProfileConnectionState";
import type { DockerConnectionProfile, DockerHostSnapshot } from "../src/models/DockerConnectionProfile";

const ssh = (id: string): DockerConnectionProfile => ({ id, name: id, enabled: true, createdAt: "", updatedAt: "", connectionType: "ssh", sshHost: id, sshPort: 22, sshUsername: "obsidian", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock" });
const tls: DockerConnectionProfile = { id: "zima", name: "zima", enabled: true, createdAt: "", updatedAt: "", connectionType: "docker-tls", host: "zima", port: 2376, serverName: "zima", caCertificatePath: "ca", clientCertificatePath: "cert", clientKeyPath: "key", tlsSnapshot: { serverName: "zima", importedAt: "" } };
const snapshot = (hostId: string, status: DockerHostSnapshot["status"]): DockerHostSnapshot => ({ hostId, status, refreshedAt: "", containers: [], images: [], volumes: [], networks: [] });

describe("profile connection state", () => {
  it("derives the Connections screenshot scenario from profile-ID keyed current snapshots", () => {
    const profiles = [ssh("test"), ssh("zimaboard"), tls];
    const snapshots = new Map([["test", snapshot("test", "authentication-required")], ["zimaboard", snapshot("zimaboard", "authentication-required")], ["zima", { ...snapshot("zima", "online"), containers: Array(16), images: Array(78), volumes: Array(2), networks: Array(7) }]]);

    expect(connectionStateSummary(profiles, snapshots)).toEqual({ configured: 3, online: 1, needsSignIn: 2 });
    expect(profileConnectionStatus("test", snapshots)).toBe("authentication-required");
    expect(profileConnectionStatus("zima", snapshots)).toBe("online");
    expect(aggregateConnectionStatus(profiles, snapshots)).toBe("online");
  });

  it("supersedes an older degraded state with the newer snapshot for the same stable profile ID", () => {
    const snapshots = new Map([["zima", snapshot("zima", "degraded")]]);
    snapshots.set("zima", { ...snapshot("zima", "online"), containers: Array(16) });

    expect(profileConnectionStatus("zima", snapshots)).toBe("online");
    expect(connectionStateSummary([tls], snapshots)).toEqual({ configured: 1, online: 1, needsSignIn: 0 });
  });

  it("does not leak one profile's state into another profile with a different stable ID", () => {
    const snapshots = new Map([["test", snapshot("test", "authentication-required")], ["zima", snapshot("zima", "online")]]);

    expect(profileConnectionStatus("test", snapshots)).toBe("authentication-required");
    expect(profileConnectionStatus("zima", snapshots)).toBe("online");
  });
});
