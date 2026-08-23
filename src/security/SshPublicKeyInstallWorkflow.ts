import { DockerConnectionError, HostKeyMismatchError, HostKeyTrustRequiredError } from "../connections/DockerTransport";
import type { SshPublicKeyInstallResult, SshPublicKeyInstallStage } from "./SshPublicKeyInstallService";

export type SshPublicKeyInstallState = "idle" | "installing" | "awaiting-host-trust" | "installed" | "already-installed" | "failed";

export interface SshPublicKeyInstallPresentation {
  state: SshPublicKeyInstallState;
  message?: string;
  stage?: SshPublicKeyInstallStage;
  hostKeyRequired?: string;
  mismatch?: { trustedFingerprint: string; receivedFingerprint: string };
}

/** Modal-local state that makes every installation attempt visibly observable. */
export class SshPublicKeyInstallWorkflow {
  private current: SshPublicKeyInstallPresentation = { state: "idle" };
  private password = "";

  setPassword(password: string): void { this.password = password; }
  get presentation(): SshPublicKeyInstallPresentation { return this.current; }
  get credential(): string { return this.password; }
  clearCredential(): void { this.password = ""; }
  resumeAfterTrust(): void { if (this.current.state === "awaiting-host-trust") this.current = { state: "idle" }; }
  cancelHostTrust(): void { if (this.current.state === "awaiting-host-trust") this.current = { state: "failed", message: "Public-key installation was cancelled until the SSH host identity is trusted." }; }
  clear(): void { this.password = ""; this.current = { state: "idle" }; }

  async submit(install: (password: string, onStage: (stage: SshPublicKeyInstallStage) => void) => Promise<SshPublicKeyInstallResult>, onProgress?: (presentation: SshPublicKeyInstallPresentation) => void): Promise<SshPublicKeyInstallPresentation> {
    if (this.current.state === "installing" || this.current.state === "awaiting-host-trust") return this.current;
    if (!this.password) return this.current = { state: "failed", message: "Enter the current SSH password to install the public key." };
    this.current = { state: "installing", message: "Installing…" };
    onProgress?.(this.current);
    try {
      const result = await install(this.password, (stage) => {
        this.current = { state: "installing", stage, message: stageMessage(stage) };
        onProgress?.(this.current);
      });
      return this.current = result.status === "already-installed" ? { state: "already-installed", message: "Public key already installed" } : { state: "installed", message: "Public key installed" };
    } catch (error) {
      if (error instanceof HostKeyTrustRequiredError) return this.current = { state: "awaiting-host-trust", message: "Waiting for SSH host verification.", hostKeyRequired: error.fingerprint };
      if (error instanceof HostKeyMismatchError) return this.current = { state: "failed", message: error.message, mismatch: { trustedFingerprint: error.details?.match(/^Expected (.*); received /)?.[1] ?? "", receivedFingerprint: error.receivedFingerprint } };
      const message = error instanceof DockerConnectionError ? error.message : "SSH public-key installation failed.";
      return this.current = { state: "failed", message };
    }
  }
}

function stageMessage(stage: SshPublicKeyInstallStage): string {
  return ({
    VALIDATE_REQUEST: "Validating request…",
    READ_PUBLIC_KEY: "Validating generated public key…",
    CONNECT_SSH: "Connecting to SSH…",
    VERIFY_HOST_KEY: "Verifying SSH host key…",
    AUTHENTICATE_SSH: "Authenticating SSH session…",
    OPEN_SFTP: "Opening SFTP…",
    PREPARE_SSH_DIRECTORY: "Preparing ~/.ssh…",
    READ_AUTHORIZED_KEYS: "Checking authorized_keys…",
    WRITE_AUTHORIZED_KEYS: "Installing public key…",
    VERIFY_INSTALLATION: "Verifying public-key installation…",
    COMPLETE: "Public-key installation complete…",
  })[stage];
}
