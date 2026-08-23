import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { utils } from "ssh2";
import { DockerConnectionError } from "../connections/DockerTransport";
import { loadPrivateKeyFile } from "./PrivateKeyFile";

export interface ResolvedSshPublicKey {
  privateKeyPath: string;
  publicKeyPath: string;
  publicKey: string;
  identity: string;
  fingerprint: string;
  source: "matching-file" | "derived";
}

/** Resolves a public identity from the selected private key, never a cached UI value. */
export async function resolvePublicKeyForPrivateKey(input: string, passphrase?: string): Promise<ResolvedSshPublicKey> {
  const loaded = await loadPrivateKeyFile(input, passphrase);
  try {
    const parsed = utils.parseKey(loaded.contents, passphrase);
    if (parsed instanceof Error || !parsed.isPrivateKey() || parsed.type !== "ssh-ed25519") throw new DockerConnectionError("SSH_PUBLIC_KEY_DERIVATION_FAILED", "Could not derive an Ed25519 public key from the selected private key.");
    const derived = `ssh-ed25519 ${parsed.getPublicSSH().toString("base64")}`;
    const identity = publicKeyIdentity(derived);
    if (!identity) throw new DockerConnectionError("SSH_PUBLIC_KEY_DERIVATION_FAILED", "Could not derive an Ed25519 public key from the selected private key.");
    const publicKeyPath = `${loaded.path}.pub`;
    try {
      const fileValue = await readFile(publicKeyPath, "utf8");
      const fileIdentity = publicKeyIdentity(fileValue);
      if (!fileIdentity || fileIdentity !== identity) throw new DockerConnectionError("SSH_PUBLIC_KEY_FILE_MISMATCH", "The matching .pub file does not belong to the selected private key.");
      return resolved(loaded.path, publicKeyPath, fileValue.trim(), identity, "matching-file");
    } catch (error) {
      if (!isMissing(error)) throw error;
      return resolved(loaded.path, publicKeyPath, derived, identity, "derived");
    }
  } finally {
    loaded.contents.fill(0);
  }
}

export function publicKeyIdentity(value: string): string | undefined {
  const parts = value.trim().split(/\s+/);
  return parts.length >= 2 && parts[0] === "ssh-ed25519" && /^[A-Za-z0-9+/]+={0,2}$/.test(parts[1]) ? `${parts[0]} ${parts[1]}` : undefined;
}

export function publicKeyFingerprint(identity: string): string {
  const parts = identity.split(" ");
  return `SHA256:${createHash("sha256").update(Buffer.from(parts[1], "base64")).digest("base64").replace(/=+$/, "")}`;
}

function resolved(privateKeyPath: string, publicKeyPath: string, publicKey: string, identity: string, source: ResolvedSshPublicKey["source"]): ResolvedSshPublicKey {
  return { privateKeyPath, publicKeyPath, publicKey, identity, fingerprint: publicKeyFingerprint(identity), source };
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
