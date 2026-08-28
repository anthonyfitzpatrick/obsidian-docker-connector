import { afterEach, describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPrivateKeyFile, resolvePrivateKeyPath } from "../src/security/PrivateKeyFile";

const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function temporaryKey(contents: string): Promise<string> { const directory = await mkdtemp(join(tmpdir(), "docker-connector-key-")); temporaryDirectories.push(directory); const path = join(directory, "id_rsa"); await writeFile(path, contents, { mode: 0o600 }); return path; }

describe("private-key file handling", () => {
  it("expands tilde paths and normalizes absolute paths", () => { expect(resolvePrivateKeyPath("~/.ssh/id_ed25519", "/Users/tester")).toBe("/Users/tester/.ssh/id_ed25519"); expect(resolvePrivateKeyPath("/tmp/../tmp/key")).toBe("/tmp/key"); });
  it("distinguishes missing files, directories, and empty files", async () => {
    await expect(loadPrivateKeyFile("/definitely/missing/docker-key", undefined)).rejects.toMatchObject({ code: "SSH_PRIVATE_KEY_NOT_FOUND" });
    const directory = await mkdtemp(join(tmpdir(), "docker-connector-directory-")); temporaryDirectories.push(directory);
    await expect(loadPrivateKeyFile(directory, undefined)).rejects.toMatchObject({ code: "SSH_PRIVATE_KEY_NOT_A_FILE" });
    await expect(loadPrivateKeyFile(await temporaryKey(""), undefined)).rejects.toMatchObject({ code: "SSH_PRIVATE_KEY_EMPTY" });
  });
  it("loads a common RSA private key only into memory", async () => {
    const privateKey = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const loaded = await loadPrivateKeyFile(await temporaryKey(privateKey), undefined);
    expect(loaded.contents.length).toBeGreaterThan(0);
    loaded.contents.fill(0);
  });
  it("rejects an encrypted key without a passphrase", async () => {
    const privateKey = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ type: "pkcs1", format: "pem", cipher: "aes-256-cbc", passphrase: "test-passphrase" }).toString();
    await expect(loadPrivateKeyFile(await temporaryKey(privateKey), undefined)).rejects.toMatchObject({ code: "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED" });
  });
  it("rejects a supplied but incorrect private-key passphrase", async () => {
    const privateKey = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ type: "pkcs1", format: "pem", cipher: "aes-256-cbc", passphrase: "test-passphrase" }).toString();
    await expect(loadPrivateKeyFile(await temporaryKey(privateKey), "wrong-passphrase")).rejects.toMatchObject({ code: "SSH_PRIVATE_KEY_PASSPHRASE_REJECTED" });
  });
});
