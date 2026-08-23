import { DockerConnectionError } from "../connections/DockerTransport";
import { normalizeGenerationPassphrase, type GeneratedSshKey, type SshKeyGenerationStage } from "./SshKeyGenerationService";
import { publicKeyIdentity, type ResolvedSshPublicKey } from "./SshPublicKeyResolver";

export type SshKeyGenerationState = "idle" | "preparing" | "generating" | "validating-private-key" | "resolving-public-key" | "verifying-key-pair" | "success" | "failed";

export interface SshKeyGenerationPresentation {
  state: SshKeyGenerationState;
  message?: string;
  fingerprint?: string;
}

export interface CompletedSshKeyGeneration {
  key: GeneratedSshKey;
  resolved: ResolvedSshPublicKey;
  passphrase: string;
}

/** Modal-local generation state. The completed key is delivered only after the user closes success. */
export class SshKeyGenerationWorkflow {
  private current: SshKeyGenerationPresentation = { state: "idle" };
  private passphrase = "";
  private confirmation = "";
  private completed?: CompletedSshKeyGeneration;

  get presentation(): SshKeyGenerationPresentation { return this.current; }
  get isBusy(): boolean { return ["preparing", "generating", "validating-private-key", "resolving-public-key", "verifying-key-pair"].includes(this.current.state); }
  setPassphrase(value: string): void { this.passphrase = value; }
  setConfirmation(value: string): void { this.confirmation = value; }
  takeCompleted(): CompletedSshKeyGeneration | undefined { const completed = this.completed; this.completed = undefined; return completed; }
  clear(): void { this.passphrase = ""; this.confirmation = ""; this.completed = undefined; this.current = { state: "idle" }; }

  async submit(generate: (passphrase: string | undefined, onStage: (stage: SshKeyGenerationStage) => void) => Promise<GeneratedSshKey>, resolve: (path: string, passphrase?: string) => Promise<ResolvedSshPublicKey>, onProgress?: (presentation: SshKeyGenerationPresentation) => void): Promise<SshKeyGenerationPresentation> {
    if (this.isBusy || this.current.state === "success") return this.current;
    if (this.passphrase !== this.confirmation) return this.update({ state: "failed", message: "The SSH key passphrases do not match." }, onProgress);
    this.update({ state: "preparing", message: "Preparing key generation…" }, onProgress);
    try {
      const generationPassphrase = normalizeGenerationPassphrase(this.passphrase);
      const key = await generate(generationPassphrase, (stage) => this.update(generationStage(stage), onProgress));
      this.update({ state: "resolving-public-key", message: "Resolving matching public key…" }, onProgress);
      const resolved = await resolve(key.privateKeyPath, generationPassphrase);
      this.update({ state: "verifying-key-pair", message: "Verifying key pair…" }, onProgress);
      if (resolved.privateKeyPath !== key.privateKeyPath || publicKeyIdentity(key.publicKey) !== resolved.identity) throw new DockerConnectionError("SSH_KEY_PAIR_MISMATCH", "The generated SSH key pair could not be verified.");
      this.completed = { key, resolved, passphrase: generationPassphrase ?? "" };
      return this.update({ state: "success", message: "Ed25519 SSH key ready.", fingerprint: resolved.fingerprint }, onProgress);
    } catch (error) {
      const message = error instanceof DockerConnectionError ? error.message : "SSH key generation failed.";
      return this.update({ state: "failed", message }, onProgress);
    }
  }

  private update(presentation: SshKeyGenerationPresentation, onProgress?: (presentation: SshKeyGenerationPresentation) => void): SshKeyGenerationPresentation {
    this.current = presentation;
    onProgress?.(presentation);
    return presentation;
  }
}

function generationStage(stage: SshKeyGenerationStage): SshKeyGenerationPresentation {
  return stage === "PREPARING"
    ? { state: "preparing", message: "Preparing key generation…" }
    : stage === "GENERATING"
      ? { state: "generating", message: "Generating Ed25519 key…" }
      : { state: "validating-private-key", message: "Validating private key…" };
}
