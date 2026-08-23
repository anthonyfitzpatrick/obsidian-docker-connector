import type { DockerConnectionTestResult } from "../connections/DockerTransport";

export interface HostKeyTrustWorkflowState {
  pendingFingerprint?: string;
  mismatch?: { trustedFingerprint: string; receivedFingerprint: string };
}

export interface HostKeySecurityPresentation {
  branch: "AWAITING_FIRST_CONNECTION" | "PENDING_TRUST" | "TRUSTED" | "MISMATCH";
  fingerprint?: string;
  description: string;
  canTrust: boolean;
}

/** Interprets safe SSH test output without ever accepting a server key. */
export function hostKeyTrustState(result: DockerConnectionTestResult, trustedFingerprint?: string): HostKeyTrustWorkflowState {
  if (result.safeErrorCode === "SSH_HOST_KEY_UNTRUSTED" && result.hostFingerprint) return { pendingFingerprint: result.hostFingerprint };
  if (result.safeErrorCode === "SSH_HOST_KEY_MISMATCH" && trustedFingerprint && result.hostFingerprint) {
    return { mismatch: { trustedFingerprint, receivedFingerprint: result.hostFingerprint } };
  }
  return {};
}

/** A trusted draft fingerprint must be tested again before it may be saved. */
export function trustPendingHostKey(pendingFingerprint?: string): string | undefined {
  return pendingFingerprint;
}

/** Prevents a trusted draft from being saved before its automatic retest succeeds. */
export class HostKeyTrustSession {
  private pendingFingerprint?: string;
  private automaticRetryFingerprint?: string;
  private verified: boolean;

  constructor(private trustedFingerprint = "") { this.verified = Boolean(trustedFingerprint); }

  receive(result: DockerConnectionTestResult, automaticRetryFingerprint?: string): HostKeyTrustWorkflowState {
    const state = hostKeyTrustState(result, this.trustedFingerprint || undefined);
    if (state.pendingFingerprint && automaticRetryFingerprint === state.pendingFingerprint) {
      this.automaticRetryFingerprint = undefined;
      this.pendingFingerprint = undefined;
      this.verified = false;
      return {};
    }
    this.pendingFingerprint = state.pendingFingerprint;
    if (result.success && this.trustedFingerprint) this.verified = true;
    if (!result.success && (state.pendingFingerprint || state.mismatch)) this.verified = false;
    return state;
  }

  trustAndRetry(): string | undefined {
    const fingerprint = trustPendingHostKey(this.pendingFingerprint);
    if (!fingerprint || this.automaticRetryFingerprint === fingerprint) return undefined;
    this.trustedFingerprint = fingerprint;
    this.pendingFingerprint = undefined;
    this.automaticRetryFingerprint = fingerprint;
    this.verified = false;
    return fingerprint;
  }

  cancel(): void { this.pendingFingerprint = undefined; }
  get trusted(): string { return this.trustedFingerprint; }
  get canSave(): boolean { return Boolean(this.trustedFingerprint) && this.verified; }
}

/** Keeps the Security UI driven by the modal's explicit state, not diagnostics. */
export function hostKeySecurityPresentation(trustedFingerprint: string, pendingFingerprint?: string, mismatch?: { trustedFingerprint: string; receivedFingerprint: string }): HostKeySecurityPresentation {
  if (mismatch) return { branch: "MISMATCH", description: "The saved host key does not match the server. Verify the server identity before changing this profile.", canTrust: false };
  if (trustedFingerprint) return { branch: "TRUSTED", fingerprint: trustedFingerprint, description: "Trusted host identity.", canTrust: false };
  if (pendingFingerprint) return { branch: "PENDING_TRUST", fingerprint: pendingFingerprint, description: "Received from the server. Verify it before trusting.", canTrust: true };
  return { branch: "AWAITING_FIRST_CONNECTION", description: "Displayed after the first connection.", canTrust: false };
}
