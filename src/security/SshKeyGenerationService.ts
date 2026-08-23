import { spawn } from "node:child_process";
import { access, chmod, mkdir, readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { DockerConnectionError } from "../connections/DockerTransport";
import { loadPrivateKeyFile } from "./PrivateKeyFile";

const KEYGEN_TIMEOUT_MS = 30_000;
const OUTPUT_LIMIT = 8 * 1024;

export interface GeneratedSshKey {
  privateKeyPath: string;
  publicKeyPath: string;
  publicKey: string;
}

export type SshKeyGenerationStage = "PREPARING" | "GENERATING" | "VALIDATING";

/** Desktop-only OpenSSH key generation. Non-empty passphrases are sent only to ssh-keygen stdin. */
export class SshKeyGenerationService {
  constructor(private readonly home = homedir()) {}

  async generate(passphrase?: string, onStage?: (stage: SshKeyGenerationStage) => void): Promise<GeneratedSshKey> {
    const generationPassphrase = normalizeGenerationPassphrase(passphrase);
    onStage?.("PREPARING");
    const directory = join(this.home, ".ssh");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const privateKeyPath = await this.availablePath(directory);
    const publicKeyPath = `${privateKeyPath}.pub`;
    let created = false;
    try {
      onStage?.("GENERATING");
      await runSshKeygen(privateKeyPath, generationPassphrase);
      created = true;
      await verifyGeneratedFiles(privateKeyPath, publicKeyPath);
      await Promise.all([chmod(privateKeyPath, 0o600), chmod(publicKeyPath, 0o644)]);
      await verifyGeneratedModes(privateKeyPath, publicKeyPath);
      onStage?.("VALIDATING");
      await validateGeneratedKey(privateKeyPath, generationPassphrase);
      const publicKey = await readPublicKey(publicKeyPath);
      return { privateKeyPath, publicKeyPath, publicKey };
    } catch (error) {
      // A failed ssh-keygen can mean another process won the filename race.
      if (created) await Promise.all([rm(privateKeyPath, { force: true }), rm(publicKeyPath, { force: true })]);
      if (error instanceof DockerConnectionError) throw error;
      throw new DockerConnectionError("SSH_KEY_GENERATION_FAILED", error instanceof Error ? error.message : "SSH key generation failed.");
    }
  }

  private async availablePath(directory: string): Promise<string> {
    for (let index = 0; index < 10_000; index += 1) {
      const path = join(directory, `docker_connector_ed25519${index ? `_${index}` : ""}`);
      if (!(await exists(path)) && !(await exists(`${path}.pub`))) return path;
    }
    throw new Error("Could not reserve a new SSH key filename.");
  }
}

/** Whitespace cannot be a generation passphrase because it is visually indistinguishable from none. */
export function normalizeGenerationPassphrase(passphrase?: string): string | undefined {
  return passphrase?.trim() ? passphrase : undefined;
}

async function exists(path: string): Promise<boolean> { try { await access(path); return true; } catch { return false; } }

async function verifyGeneratedFiles(privateKeyPath: string, publicKeyPath: string): Promise<void> {
  const [privateKey, publicKey] = await Promise.all([stat(privateKeyPath), stat(publicKeyPath)]);
  if (!privateKey.isFile() || !publicKey.isFile()) throw new Error("ssh-keygen did not create both SSH key files.");
}

async function verifyGeneratedModes(privateKeyPath: string, publicKeyPath: string): Promise<void> {
  const [privateKey, publicKey] = await Promise.all([stat(privateKeyPath), stat(publicKeyPath)]);
  if ((privateKey.mode & 0o777) !== 0o600 || (publicKey.mode & 0o777) !== 0o644) throw new Error("Could not set safe SSH key file permissions.");
}

async function readPublicKey(path: string): Promise<string> {
  const value = (await readFile(path, "utf8")).trim();
  if (!/^ssh-ed25519\s+[A-Za-z0-9+/]+={0,2}(?:\s+[^\r\n]+)?$/.test(value)) throw new Error("ssh-keygen did not produce a valid Ed25519 public key.");
  return value;
}

async function validateGeneratedKey(path: string, passphrase?: string): Promise<void> {
  if (passphrase === undefined) {
    const loaded = await loadPrivateKeyFile(path, undefined);
    loaded.contents.fill(0);
    return;
  }
  try {
    const unencrypted = await loadPrivateKeyFile(path, undefined);
    unencrypted.contents.fill(0);
  } catch (error) {
    if (error instanceof DockerConnectionError && error.code === "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED") {
      const loaded = await loadPrivateKeyFile(path, passphrase);
      loaded.contents.fill(0);
      return;
    }
    throw error;
  }
  throw new Error("ssh-keygen created an unencrypted key despite a passphrase.");
}

function runSshKeygen(path: string, passphrase?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const arguments_ = ["-q", "-t", "ed25519", "-f", path, "-C", "docker-connector", ...(passphrase === undefined ? ["-N", ""] : [])];
    const child = spawn("ssh-keygen", arguments_, { shell: false, stdio: ["pipe", "ignore", "pipe"] });
    let stderr = ""; let settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve(); };
    const timer = setTimeout(() => { child.kill(); finish(new Error("SSH key generation timed out.")); }, KEYGEN_TIMEOUT_MS);
    child.stderr?.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString()}`.slice(-OUTPUT_LIMIT); });
    child.once("error", () => finish(new Error("Could not start ssh-keygen.")));
    child.once("close", (code) => finish(code === 0 ? undefined : new Error(stderr.includes("already exists") ? "The selected SSH key path already exists." : "ssh-keygen could not create an SSH key.")));
    // A blank key uses the cross-platform -N "" form. Non-empty secrets never enter argv.
    if (passphrase === undefined) child.stdin?.end();
    else child.stdin?.end(`${passphrase}\n${passphrase}\n`);
  });
}
