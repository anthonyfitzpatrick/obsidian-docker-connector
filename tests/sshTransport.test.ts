import { EventEmitter } from "node:events";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Client, ConnectConfig } from "ssh2";
import { SshDockerTransport } from "../src/connections/SshDockerTransport";
import { HostKeyVerifier } from "../src/security/HostKeyVerifier";
import type { SshDockerProfile } from "../src/models/DockerConnectionProfile";
class FakeClient extends EventEmitter { ended = false; config?: ConnectConfig; connect(config: ConnectConfig): this { this.config = config; config.hostVerifier?.(Buffer.from("known-key")); queueMicrotask(() => { this.emit("connect"); this.emit("handshake"); this.emit("ready"); }); return this; } end(): this { this.ended = true; return this; } }
class KeyboardInteractiveClient extends EventEmitter {
  responses?: string[];
  connect(config: ConnectConfig): this {
    config.hostVerifier?.(Buffer.from("known-key"));
    queueMicrotask(() => { this.emit("connect"); this.emit("handshake"); });
    queueMicrotask(() => this.emit("keyboard-interactive", "Password", "", "", [{ prompt: "Password: ", echo: false }], (responses: string[]) => { this.responses = responses; this.emit("ready"); }));
    return this;
  }
  end(): this { return this; }
}
class DockerChannel extends EventEmitter {
  stderr = Object.assign(new EventEmitter(), { setEncoding: () => this.stderr });
  setEncoding(): this { return this; }
  destroy(): this { return this; }
  write(request: string): boolean {
    const body = request.includes("GET /_ping") ? "OK" : JSON.stringify({ Version: "28.0", ApiVersion: "1.50" });
    queueMicrotask(() => this.emit("data", `HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n${body}`));
    return true;
  }
}
class ProbeChannel extends EventEmitter {
  stderr = Object.assign(new EventEmitter(), { setEncoding: () => this.stderr });
  setEncoding(): this { return this; }
  destroy(): this { return this; }
  emitResult(): void { queueMicrotask(() => { this.emit("data", "__IDENTITY_USERNAME__\nobsidian\n__IDENTITY_UID__\n1000\n__IDENTITY_PRIMARY_GID__\n1000\n__IDENTITY_ALL_GIDS__\n1000 999\n__IDENTITY_GROUP_NAMES__\nobsidian docker\n__DOCKER_PATH__\n/usr/bin/docker\n__DOCKER_CONTEXT__\ndefault\n__DOCKER_HOST__\n\n__DOCKER_SOCKET_STAT__\n0 999 660 socket\n__DOCKER_SOCKET_GROUP__\ndocker:x:999:obsidian\n__DOCKER_VERSION__\n{}\n__DOCKER_VERSION_EXIT__\n0\n"); this.emit("close"); }); }
}
class DockerClient extends FakeClient {
  command?: string;
  exec(command: string, callback: (error: Error | undefined, stream?: unknown) => void): this { this.command = command; if (command.includes("__IDENTITY_USERNAME__")) { const probe = new ProbeChannel(); callback(undefined, probe); probe.emitResult(); } else callback(undefined, new DockerChannel()); return this; }
}
const profile: SshDockerProfile = { id: "ssh", name: "SSH", enabled: true, createdAt: "", updatedAt: "", sshHost: "127.0.0.1", sshPort: 22, sshUsername: "obsidian", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock", hostKeyFingerprint: new HostKeyVerifier().fingerprint(Buffer.from("known-key")) };
describe("password SSH lifecycle", () => {
  it("passes the normalized target and exact session-only password to ssh2 without a TCP preflight socket", async () => { const clients: FakeClient[] = []; const transport = new SshDockerTransport(profile, () => ({ password: " password is not trimmed " }), undefined, () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; }); await transport.connect(); expect(transport.isConnected()).toBe(true); expect(clients[0].config).toMatchObject({ host: "127.0.0.1", port: 22, username: "obsidian", password: " password is not trimmed ", tryKeyboard: true }); expect(clients[0].config?.privateKey).toBeUndefined(); expect(clients[0].config?.sock).toBeUndefined(); await transport.disconnect(); expect(clients[0].ended).toBe(true); });
  it("uses the supplied password for a single keyboard-interactive prompt", async () => { const client = new KeyboardInteractiveClient(); const transport = new SshDockerTransport(profile, () => ({ password: "session-password" }), undefined, () => client as unknown as Client); await transport.connect(); expect(client.responses).toEqual(["session-password"]); });
  it("shares one in-progress SSH connection across concurrent Docker requests", async () => { let clientCount = 0; const transport = new SshDockerTransport(profile, () => ({ password: "session-password" }), undefined, () => { clientCount += 1; return new FakeClient() as unknown as Client; }); await Promise.all([transport.connect(), transport.connect()]); expect(clientCount).toBe(1); });
  it("reports authentication required when the runtime password is absent", async () => { const transport = new SshDockerTransport(profile, () => ({}), undefined, () => new FakeClient() as unknown as Client); await expect(transport.connect()).rejects.toMatchObject({ code: "SSH_PASSWORD_REQUIRED" }); });
  it("uses the same SSH session to ping Docker before reading its version", async () => { const client = new DockerClient(); const transport = new SshDockerTransport(profile, () => ({ password: "session-password" }), undefined, () => client as unknown as Client); const result = await transport.testConnection(); expect(result).toMatchObject({ success: true, dockerVersion: "28.0", apiVersion: "1.50" }); expect(result.steps.find((step) => step.id === "ping-response")?.status).toBe("success"); expect(client.command).toBe("docker system dial-stdio"); expect(client.ended).toBe(true); });
  it("passes only private-key authentication to ssh2", async () => {
    const directory = await mkdtemp(join(tmpdir(), "docker-connector-transport-"));
    try {
      const path = join(directory, "id_rsa");
      const key = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ type: "pkcs1", format: "pem" }).toString();
      await writeFile(path, key, { mode: 0o600 });
      const client = new FakeClient();
      const transport = new SshDockerTransport({ ...profile, authentication: { type: "private-key", privateKeyPath: path } }, () => ({}), undefined, () => client as unknown as Client);
      await transport.connect();
      expect(client.config?.privateKey).toBeInstanceOf(Buffer);
      expect(client.config?.password).toBeUndefined();
      expect(client.config?.agent).toBeUndefined();
      expect(client.config?.tryKeyboard).toBeUndefined();
      await transport.disconnect();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
