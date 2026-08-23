import { describe, expect, it, vi } from "vitest";
import type { Client } from "ssh2";
import { appendPublicKey, containsPublicKey, publicKeyIdentity, SshPublicKeyInstallService } from "../src/security/SshPublicKeyInstallService";
import { HostKeyVerifier } from "../src/security/HostKeyVerifier";
import { HostKeyMismatchError, HostKeyTrustRequiredError } from "../src/connections/DockerTransport";
import type { SshDockerProfile } from "../src/models/DockerConnectionProfile";

const profile: SshDockerProfile = { id: "ssh", name: "SSH", connectionType: "ssh", enabled: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", sshHost: "server.example", sshPort: 22, sshUsername: "docker", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock", hostKeyFingerprint: "SHA256:expected" };
const publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIErD5tPR+6mgsS8Qf62T6UpOrSSuJ9dlVnJgqf+7docker docker-connector";

class FakeSftp {
  readonly directories = new Set<string>(["/home/docker"]);
  readonly files = new Map<string, Buffer>();
  ended = 0;
  fail?: { operation: string; code: number };
  hangRead = false;
  realpath(_path: string, callback: (error: Error | null, path?: string) => void): void { callback(null, "/home/docker"); }
  stat(path: string, callback: (error: Error | null) => void): void { callback(this.directories.has(path) ? null : sftpError(2)); }
  mkdir(path: string, _options: unknown, callback: (error: Error | null) => void): void { if (this.fail?.operation === "mkdir") callback(sftpError(this.fail.code)); else { this.directories.add(path); callback(null); } }
  chmod(_path: string, _mode: number, callback: (error: Error | null) => void): void { callback(this.fail?.operation === "chmod" ? sftpError(this.fail.code) : null); }
  readFile(path: string, callback: (error: Error | null, value?: Buffer) => void): void { if (this.hangRead) return; if (this.fail?.operation === "read") callback(sftpError(this.fail.code)); else { const value = this.files.get(path); callback(value ? null : sftpError(2), value && Buffer.from(value)); } }
  writeFile(path: string, value: Buffer, options: { flag?: string }, callback: (error: Error | null) => void): void { if (this.fail?.operation === "write") callback(sftpError(this.fail.code)); else { const previous = options.flag === "a" ? this.files.get(path) : undefined; this.files.set(path, previous ? Buffer.concat([previous, value]) : Buffer.from(value)); callback(null); } }
  end(): void { this.ended += 1; }
}

class FakeClient {
  readonly handlers = new Map<string, (...args: unknown[]) => void>();
  readonly sftpClient = new FakeSftp();
  config?: { hostVerifier?: (key: Buffer) => boolean; password?: string };
  sftpOpened = 0;
  ended = 0;
  once(event: string, callback: (...args: unknown[]) => void): this { this.handlers.set(event, callback); return this; }
  connect(config: { hostVerifier?: (key: Buffer) => boolean; password?: string }): void { this.config = config; if (config.hostVerifier?.(Buffer.from("server-key"))) this.handlers.get("ready")?.(); else this.handlers.get("error")?.(new Error("host rejected")); }
  sftp(callback: (error: Error | null, sftp?: FakeSftp) => void): void { this.sftpOpened += 1; callback(null, this.sftpClient); }
  end(): void { this.ended += 1; }
}

function sftpError(code: number): Error & { code: number } { return Object.assign(new Error("sftp"), { code }); }
function trustedProfile(): SshDockerProfile { return { ...profile, hostKeyFingerprint: new HostKeyVerifier().fingerprint(Buffer.from("server-key")) }; }

describe("SSH public-key installation", () => {
  it("uses strict SFTP with the exact typed password and only writes the public line", async () => {
    const client = new FakeClient();
    await expect(new SshPublicKeyInstallService(undefined, () => client as unknown as Client).install(trustedProfile(), "  session-password  ", publicKey)).resolves.toEqual({ status: "installed" });
    const installed = client.sftpClient.files.get("/home/docker/.ssh/authorized_keys")?.toString("utf8");
    expect(installed).toBe(`${publicKey}\n`);
    expect(client.config?.password).toBe("  session-password  ");
    expect(client.sftpOpened).toBe(1);
    expect(client.sftpClient.ended).toBe(1);
    expect(client.ended).toBe(1);
  });

  it("recognizes the same key despite a different comment and preserves existing lines", async () => {
    const client = new FakeClient();
    const path = "/home/docker/.ssh/authorized_keys";
    client.sftpClient.directories.add("/home/docker/.ssh");
    client.sftpClient.files.set(path, Buffer.from(`ssh-ed25519 ${publicKey.split(/\s+/)[1]} old-comment\nssh-rsa existing\n`, "utf8"));
    await expect(new SshPublicKeyInstallService(undefined, () => client as unknown as Client).install(trustedProfile(), "password", publicKey)).resolves.toEqual({ status: "already-installed" });
    expect(client.sftpClient.files.get(path)?.toString("utf8")).toContain("old-comment");
  });

  it("appends without rewriting existing authorized-key bytes", async () => {
    const client = new FakeClient();
    const path = "/home/docker/.ssh/authorized_keys";
    client.sftpClient.directories.add("/home/docker/.ssh");
    client.sftpClient.files.set(path, Buffer.from("ssh-rsa preserved-without-newline", "utf8"));
    await new SshPublicKeyInstallService(undefined, () => client as unknown as Client).install(trustedProfile(), "password", publicKey);
    expect(client.sftpClient.files.get(path)?.toString("utf8")).toBe(`ssh-rsa preserved-without-newline\n${publicKey}\n`);
  });

  it("maps remote permission failures safely and closes every SFTP resource", async () => {
    const client = new FakeClient();
    client.sftpClient.fail = { operation: "mkdir", code: 3 };
    await expect(new SshPublicKeyInstallService(undefined, () => client as unknown as Client).install(trustedProfile(), "password", publicKey)).rejects.toMatchObject({ code: "SSH_PUBLIC_KEY_INSTALL_PERMISSION_DENIED" });
    expect(client.sftpClient.ended).toBe(1);
    expect(client.ended).toBe(1);
  });

  it("times out a stalled SFTP operation and releases the SSH session", async () => {
    vi.useFakeTimers();
    try {
      const client = new FakeClient();
      client.sftpClient.hangRead = true;
      const attempt = new SshPublicKeyInstallService(undefined, () => client as unknown as Client, { connectMs: 100, operationMs: 100 }).install(trustedProfile(), "password", publicKey);
      const rejected = expect(attempt).rejects.toMatchObject({ code: "SSH_PUBLIC_KEY_INSTALL_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(101);
      await rejected;
      expect(client.sftpClient.ended).toBe(1);
      expect(client.ended).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never opens SFTP for unknown or mismatched SSH host keys", async () => {
    const unknown = new FakeClient();
    await expect(new SshPublicKeyInstallService(undefined, () => unknown as unknown as Client).install({ ...profile, hostKeyFingerprint: undefined }, "session-password", publicKey)).rejects.toBeInstanceOf(HostKeyTrustRequiredError);
    expect(unknown.sftpOpened).toBe(0);
    const mismatch = new FakeClient();
    await expect(new SshPublicKeyInstallService(undefined, () => mismatch as unknown as Client).install(profile, "session-password", publicKey)).rejects.toBeInstanceOf(HostKeyMismatchError);
    expect(mismatch.sftpOpened).toBe(0);
  });

  it("accepts only public identities and appends without changing existing bytes", () => {
    const identity = publicKeyIdentity(publicKey);
    expect(identity).toBe("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIErD5tPR+6mgsS8Qf62T6UpOrSSuJ9dlVnJgqf+7docker");
    expect(publicKeyIdentity("-----BEGIN OPENSSH PRIVATE KEY-----")).toBeUndefined();
    expect(containsPublicKey("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIErD5tPR+6mgsS8Qf62T6UpOrSSuJ9dlVnJgqf+7docker another-comment", identity!)).toBe(true);
    expect(appendPublicKey("existing-without-newline", publicKey)).toBe(`existing-without-newline\n${publicKey}\n`);
  });
});
