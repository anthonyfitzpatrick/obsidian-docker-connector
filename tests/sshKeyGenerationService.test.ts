import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeGenerationPassphrase, SshKeyGenerationService } from "../src/security/SshKeyGenerationService";
import { loadPrivateKeyFile } from "../src/security/PrivateKeyFile";
import { publicKeyIdentity, resolvePublicKeyForPrivateKey } from "../src/security/SshPublicKeyResolver";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function home(): Promise<string> { const path = await mkdtemp(join(tmpdir(), "docker-connector-keygen-")); directories.push(path); return path; }

describe("SSH key generation", () => {
  it.each([undefined, "", "   "])("generates an unencrypted Ed25519 key for a blank passphrase", async (passphrase) => {
    const generated = await new SshKeyGenerationService(await home()).generate(passphrase);
    expect(generated.privateKeyPath).toMatch(/\.ssh\/docker_connector_ed25519$/);
    expect(generated.publicKeyPath).toBe(`${generated.privateKeyPath}.pub`);
    expect(generated.publicKey).toMatch(/^ssh-ed25519 /);
    const loaded = await loadPrivateKeyFile(generated.privateKeyPath, undefined);
    loaded.contents.fill(0);
    expect((await readFile(generated.publicKeyPath, "utf8")).trim()).toBe(generated.publicKey);
    const resolved = await resolvePublicKeyForPrivateKey(generated.privateKeyPath, undefined);
    expect(resolved.identity).toBe(publicKeyIdentity(generated.publicKey));
    expect(resolved.source).toBe("matching-file");
    expect((await stat(generated.privateKeyPath)).mode & 0o777).toBe(0o600);
    expect((await stat(generated.publicKeyPath)).mode & 0o777).toBe(0o644);
  });

  it("normalizes whitespace-only generation passphrases to unencrypted keys", () => {
    expect(normalizeGenerationPassphrase()).toBeUndefined();
    expect(normalizeGenerationPassphrase("")).toBeUndefined();
    expect(normalizeGenerationPassphrase(" \t ")).toBeUndefined();
    expect(normalizeGenerationPassphrase(" passphrase ")).toBe(" passphrase ");
  });

  it("uses the next safe filename rather than overwriting an existing key", async () => {
    const directory = await home(); const ssh = join(directory, ".ssh");
    await mkdir(ssh);
    await writeFile(join(ssh, "docker_connector_ed25519"), "existing");
    const generated = await new SshKeyGenerationService(directory).generate();
    expect(generated.privateKeyPath).toMatch(/docker_connector_ed25519_1$/);
    expect(await readFile(join(ssh, "docker_connector_ed25519"), "utf8")).toBe("existing");
  });

  it("creates the _10 pair when the base and _1 through _9 paths are occupied", async () => {
    const directory = await home(); const ssh = join(directory, ".ssh");
    await mkdir(ssh);
    for (let index = 0; index <= 9; index += 1) {
      const suffix = index ? `_${index}` : "";
      await Promise.all([
        writeFile(join(ssh, `docker_connector_ed25519${suffix}`), `private-${index}`),
        writeFile(join(ssh, `docker_connector_ed25519${suffix}.pub`), `public-${index}`)
      ]);
    }
    const generated = await new SshKeyGenerationService(directory).generate();
    expect(generated.privateKeyPath).toBe(join(ssh, "docker_connector_ed25519_10"));
    expect(generated.publicKeyPath).toBe(join(ssh, "docker_connector_ed25519_10.pub"));
    expect(await readFile(join(ssh, "docker_connector_ed25519_9"), "utf8")).toBe("private-9");
    expect(await readFile(join(ssh, "docker_connector_ed25519_9.pub"), "utf8")).toBe("public-9");
    expect((await stat(generated.privateKeyPath)).isFile()).toBe(true);
    expect((await stat(generated.publicKeyPath)).isFile()).toBe(true);
  });

  it("creates an encrypted key from stdin-only passphrase input", async () => {
    const generated = await new SshKeyGenerationService(await home()).generate("test-passphrase");
    await expect(loadPrivateKeyFile(generated.privateKeyPath, undefined)).rejects.toMatchObject({ code: "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED" });
    const loaded = await loadPrivateKeyFile(generated.privateKeyPath, "test-passphrase");
    loaded.contents.fill(0);
    await expect(resolvePublicKeyForPrivateKey(generated.privateKeyPath, "test-passphrase")).resolves.toMatchObject({
      identity: publicKeyIdentity(generated.publicKey),
      source: "matching-file"
    });
  });
});
