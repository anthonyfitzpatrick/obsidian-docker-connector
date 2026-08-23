import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SshKeyGenerationService } from "../src/security/SshKeyGenerationService";
import { publicKeyFingerprint, publicKeyIdentity, resolvePublicKeyForPrivateKey } from "../src/security/SshPublicKeyResolver";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function home(): Promise<string> { const path = await mkdtemp(join(tmpdir(), "docker-connector-key-resolver-")); directories.push(path); return path; }

describe("selected SSH public-key resolution", () => {
  it("uses the selected key pair rather than a previously generated key", async () => {
    const directory = await home();
    const first = await new SshKeyGenerationService(directory).generate();
    const second = await new SshKeyGenerationService(directory).generate();
    const selected = await resolvePublicKeyForPrivateKey(second.privateKeyPath);
    expect(selected.privateKeyPath).toBe(second.privateKeyPath);
    expect(selected.identity).not.toBe(first.publicKey.split(/\s+/).slice(0, 2).join(" "));
    expect(selected.publicKey).toBe(second.publicKey);
    expect(selected.fingerprint).toBe(publicKeyFingerprint(selected.identity));
  });

  it("rejects a sibling public file that belongs to another private key", async () => {
    const directory = await home();
    const first = await new SshKeyGenerationService(directory).generate();
    const second = await new SshKeyGenerationService(directory).generate();
    await writeFile(`${second.privateKeyPath}.pub`, first.publicKey);
    await expect(resolvePublicKeyForPrivateKey(second.privateKeyPath)).rejects.toMatchObject({ code: "SSH_PUBLIC_KEY_FILE_MISMATCH" });
  });

  it("derives a public identity in memory when the matching .pub file is absent", async () => {
    const generated = await new SshKeyGenerationService(await home()).generate();
    await unlink(generated.publicKeyPath);
    const resolved = await resolvePublicKeyForPrivateKey(generated.privateKeyPath);
    expect(resolved.source).toBe("derived");
    expect(publicKeyIdentity(resolved.publicKey)).toBe(publicKeyIdentity(generated.publicKey));
  });

  it("uses an in-memory passphrase without changing the private key", async () => {
    const generated = await new SshKeyGenerationService(await home()).generate("passphrase");
    await expect(resolvePublicKeyForPrivateKey(generated.privateKeyPath)).rejects.toMatchObject({ code: "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED" });
    await expect(resolvePublicKeyForPrivateKey(generated.privateKeyPath, "passphrase")).resolves.toMatchObject({ privateKeyPath: generated.privateKeyPath });
  });
});
