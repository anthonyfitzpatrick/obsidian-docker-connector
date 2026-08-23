import { Client, type SFTPWrapper } from "ssh2";
import type { SshDockerProfile } from "../models/DockerConnectionProfile";
import { DockerConnectionError, HostKeyMismatchError, HostKeyTrustRequiredError } from "../connections/DockerTransport";
import { HostKeyVerifier } from "./HostKeyVerifier";
import { publicKeyIdentity } from "./SshPublicKeyResolver";

const CONNECT_TIMEOUT_MS = 30_000;
const OPERATION_TIMEOUT_MS = 10_000;

export interface SshPublicKeyInstallTimeouts { connectMs: number; operationMs: number; }
const DEFAULT_TIMEOUTS: SshPublicKeyInstallTimeouts = { connectMs: CONNECT_TIMEOUT_MS, operationMs: OPERATION_TIMEOUT_MS };

export type SshPublicKeyInstallStage = "VALIDATE_REQUEST" | "READ_PUBLIC_KEY" | "CONNECT_SSH" | "VERIFY_HOST_KEY" | "AUTHENTICATE_SSH" | "OPEN_SFTP" | "PREPARE_SSH_DIRECTORY" | "READ_AUTHORIZED_KEYS" | "WRITE_AUTHORIZED_KEYS" | "VERIFY_INSTALLATION" | "COMPLETE";
export interface SshPublicKeyInstallResult { status: "installed" | "already-installed"; }

/** Installs one generated public key with SFTP; it never opens or transfers a private key. */
export class SshPublicKeyInstallService {
  constructor(private readonly verifier = new HostKeyVerifier(), private readonly clientFactory: () => Client = () => new Client(), private readonly timeouts: SshPublicKeyInstallTimeouts = DEFAULT_TIMEOUTS) {}

  async install(profile: SshDockerProfile, password: string, publicKey: string, onStage?: (stage: SshPublicKeyInstallStage) => void): Promise<SshPublicKeyInstallResult> {
    onStage?.("VALIDATE_REQUEST");
    if (profile.authentication.type !== "password" || !password) throw new DockerConnectionError("SSH_PASSWORD_REQUIRED", "Enter the current SSH password to install a public key.");
    onStage?.("READ_PUBLIC_KEY");
    const identity = publicKeyIdentity(publicKey);
    if (!identity) throw new DockerConnectionError("SSH_PUBLIC_KEY_INVALID", "The generated SSH public key is invalid.");
    const client = this.clientFactory();
    let sftp: SFTPWrapper | undefined;
    try {
      await this.connect(client, profile, password, onStage);
      onStage?.("OPEN_SFTP");
      try {
        sftp = await this.openSftp(client);
      } catch (error) {
        throw operationError("OPEN_SFTP", error);
      }
      let home: string;
      try {
        home = await this.operation<string>("OPEN_SFTP", (done) => sftp!.realpath(".", (error, path) => done(error ?? undefined, path)));
      } catch (error) {
        throw operationError("OPEN_SFTP", error);
      }
      const sshDirectory = `${home}/.ssh`;
      const authorizedKeys = `${sshDirectory}/authorized_keys`;
      onStage?.("PREPARE_SSH_DIRECTORY");
      await this.ensureDirectory(sftp, sshDirectory);
      onStage?.("READ_AUTHORIZED_KEYS");
      const existing = await this.readAuthorizedKeys(sftp, authorizedKeys);
      if (containsPublicKey(existing, identity)) {
        onStage?.("COMPLETE");
        return { status: "already-installed" };
      }
      onStage?.("WRITE_AUTHORIZED_KEYS");
      const addition = publicKeyAppend(existing, publicKey);
      try {
        await this.operation("WRITE_AUTHORIZED_KEYS", (done) => sftp!.writeFile(authorizedKeys, Buffer.from(addition, "utf8"), { mode: 0o600, flag: "a" }, (error) => done(error ?? undefined)));
        await this.operation("WRITE_AUTHORIZED_KEYS", (done) => sftp!.chmod(authorizedKeys, 0o600, (error) => done(error ?? undefined)));
      } catch (error) {
        throw operationError("WRITE_AUTHORIZED_KEYS", error);
      }
      onStage?.("VERIFY_INSTALLATION");
      const verified = await this.readAuthorizedKeys(sftp, authorizedKeys);
      if (!containsPublicKey(verified, identity)) throw new DockerConnectionError("SSH_PUBLIC_KEY_INSTALL_FAILED", "Could not verify the public-key installation.");
      onStage?.("COMPLETE");
      return { status: "installed" };
    } finally {
      sftp?.end();
      client.end();
    }
  }

  private connect(client: Client, profile: SshDockerProfile, password: string, onStage?: (stage: SshPublicKeyInstallStage) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let hostKeyError: Error | undefined;
      let settled = false;
      const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve(); };
      const timer = setTimeout(() => finish(new DockerConnectionError("SSH_CONNECTION_TIMEOUT", "SSH public-key installation timed out while connecting.")), this.timeouts.connectMs);
      client.once("ready", () => finish());
      client.once("error", (error) => finish(hostKeyError ?? installationConnectionError(error)));
      client.once("close", () => finish(new DockerConnectionError("SSH_CONNECTION_FAILED", "SSH connection closed before authentication completed.")));
      client.once("end", () => finish(new DockerConnectionError("SSH_CONNECTION_FAILED", "SSH connection ended before authentication completed.")));
      onStage?.("CONNECT_SSH");
      onStage?.("AUTHENTICATE_SSH");
      client.connect({ host: profile.sshHost, port: profile.sshPort, username: profile.sshUsername, password, tryKeyboard: true, authHandler: ["password", "keyboard-interactive"], hostVerifier: (key: Buffer) => {
        onStage?.("VERIFY_HOST_KEY");
        const received = this.verifier.fingerprint(key);
        if (!profile.hostKeyFingerprint) { hostKeyError = new HostKeyTrustRequiredError(received); return false; }
        if (!this.verifier.verify(key, profile.hostKeyFingerprint)) { hostKeyError = new HostKeyMismatchError(received, profile.hostKeyFingerprint); return false; }
        return true;
      } });
    });
  }

  private openSftp(client: Client): Promise<SFTPWrapper> {
    return this.operation("OPEN_SFTP", (done) => client.sftp(done));
  }

  private async ensureDirectory(sftp: SFTPWrapper, directory: string): Promise<void> {
    try {
      await this.operation("PREPARE_SSH_DIRECTORY", (done) => sftp.stat(directory, (error) => done(error ?? undefined)));
    } catch (error) {
      if (!isMissing(error)) throw operationError("PREPARE_SSH_DIRECTORY", error);
      try {
        await this.operation("PREPARE_SSH_DIRECTORY", (done) => sftp.mkdir(directory, { mode: 0o700 }, (error) => done(error ?? undefined)));
      } catch (createError) {
        throw operationError("PREPARE_SSH_DIRECTORY", createError);
      }
    }
    try {
      await this.operation("PREPARE_SSH_DIRECTORY", (done) => sftp.chmod(directory, 0o700, (error) => done(error ?? undefined)));
    } catch (chmodError) {
      throw operationError("PREPARE_SSH_DIRECTORY", chmodError);
    }
  }

  private async readAuthorizedKeys(sftp: SFTPWrapper, path: string): Promise<string> {
    try {
      const content = await this.operation<Buffer>("READ_AUTHORIZED_KEYS", (done) => sftp.readFile(path, (error, value) => done(error ?? undefined, value)));
      const text = content.toString("utf8");
      content.fill(0);
      return text;
    } catch (error) {
      if (isMissing(error)) return "";
      throw operationError("READ_AUTHORIZED_KEYS", error);
    }
  }

  private operation<T>(stage: SshPublicKeyInstallStage, start: (done: (error: Error | undefined, value?: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error: Error | undefined, value?: T) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve(value as T); };
      const timer = setTimeout(() => finish(new DockerConnectionError("SSH_PUBLIC_KEY_INSTALL_TIMEOUT", `Public-key installation timed out while ${stageMessage(stage).toLowerCase()}.`)), this.timeouts.operationMs);
      try { start(finish); } catch { finish(new DockerConnectionError("SSH_PUBLIC_KEY_INSTALL_FAILED", "Could not update ~/.ssh/authorized_keys.")); }
    });
  }
}

export { publicKeyIdentity } from "./SshPublicKeyResolver";

export function containsPublicKey(contents: string, identity: string): boolean {
  return contents.split(/\r?\n/).some((line) => publicKeyIdentity(line) === identity);
}

export function appendPublicKey(contents: string, publicKey: string): string {
  return `${contents}${publicKeyAppend(contents, publicKey)}`;
}

export function publicKeyAppend(contents: string, publicKey: string): string {
  return `${contents.length > 0 && !contents.endsWith("\n") ? "\n" : ""}${publicKey.trim()}\n`;
}

function isMissing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string | number }).code === 2; }
function operationError(stage: SshPublicKeyInstallStage, error: unknown): DockerConnectionError {
  if (error instanceof DockerConnectionError) return error;
  const denied = typeof error === "object" && error !== null && "code" in error && ((error as { code?: string | number }).code === 3 || (error as { code?: string }).code === "EACCES");
  if (denied) return new DockerConnectionError("SSH_PUBLIC_KEY_INSTALL_PERMISSION_DENIED", "Remote permissions prevented public-key installation.");
  return new DockerConnectionError("SSH_PUBLIC_KEY_INSTALL_FAILED", stage === "READ_AUTHORIZED_KEYS" ? "Could not read ~/.ssh/authorized_keys." : "Could not update ~/.ssh/authorized_keys.");
}
function installationConnectionError(error: Error): DockerConnectionError { return /authentication|password|auth fail/i.test(error.message) ? new DockerConnectionError("SSH_PUBLIC_KEY_INSTALL_AUTHENTICATION_FAILED", "SSH authentication failed. Check the current SSH password.") : new DockerConnectionError("SSH_CONNECTION_FAILED", "Could not open the trusted SSH session."); }
function stageMessage(stage: SshPublicKeyInstallStage): string { return ({ VALIDATE_REQUEST: "Validating request", READ_PUBLIC_KEY: "Reading public key", CONNECT_SSH: "Connecting to SSH", VERIFY_HOST_KEY: "Verifying SSH host key", AUTHENTICATE_SSH: "Authenticating", OPEN_SFTP: "Opening remote SSH directory", PREPARE_SSH_DIRECTORY: "Preparing remote SSH directory", READ_AUTHORIZED_KEYS: "Checking authorized_keys", WRITE_AUTHORIZED_KEYS: "Installing public key", VERIFY_INSTALLATION: "Verifying installation", COMPLETE: "Complete" })[stage]; }
