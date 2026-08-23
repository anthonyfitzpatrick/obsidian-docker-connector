import { describe, expect, it } from "vitest";
import { HostKeyTrustSession, hostKeyTrustState, trustPendingHostKey } from "../src/security/HostKeyTrustWorkflow";

const received = "SHA256:received";
const trusted = "SHA256:trusted";

describe("SSH host-key trust workflow", () => {
  it("makes an unknown received key pending until the user explicitly trusts it", () => {
    const state = hostKeyTrustState({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received });

    expect(state).toEqual({ pendingFingerprint: received });
    expect(trustPendingHostKey(state.pendingFingerprint)).toBe(received);
  });

  it("shows a mismatch without offering the received key as a trust candidate", () => {
    const state = hostKeyTrustState({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_MISMATCH", hostFingerprint: received }, trusted);

    expect(state).toEqual({ mismatch: { trustedFingerprint: trusted, receivedFingerprint: received } });
    expect(trustPendingHostKey(state.pendingFingerprint)).toBeUndefined();
  });

  it("keeps unrelated test results from changing trusted metadata", () => {
    expect(hostKeyTrustState({ success: false, steps: [], safeErrorCode: "SSH_PASSWORD_REJECTED" }, trusted)).toEqual({});
  });

  it("opens a first-seen decision model with the exact received fingerprint", () => {
    const session = new HostKeyTrustSession();
    expect(session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received })).toEqual({ pendingFingerprint: received });
    expect(session.trusted).toBe("");
    expect(session.canSave).toBe(false);
  });

  it("cancels without trusting or scheduling a retry", () => {
    const session = new HostKeyTrustSession();
    session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received });
    session.cancel();
    expect(session.trustAndRetry()).toBeUndefined();
    expect(session.trusted).toBe("");
  });

  it("trusts once, retries with the draft fingerprint, and enables saving only after success", () => {
    const session = new HostKeyTrustSession();
    session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received });
    expect(session.trustAndRetry()).toBe(received);
    expect(session.trusted).toBe(received);
    expect(session.trustAndRetry()).toBeUndefined();
    expect(session.canSave).toBe(false);
    session.receive({ success: true, steps: [] });
    expect(session.canSave).toBe(true);
  });

  it("keeps a failed automatic retry unsaveable", () => {
    const session = new HostKeyTrustSession();
    session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received });
    session.trustAndRetry();
    session.receive({ success: false, steps: [], safeErrorCode: "SSH_PASSWORD_REJECTED" });
    expect(session.trusted).toBe(received);
    expect(session.canSave).toBe(false);
  });

  it("does not reopen a first-seen prompt from the one automatic retry", () => {
    const session = new HostKeyTrustSession();
    session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received });
    const retry = session.trustAndRetry();
    expect(session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received }, retry)).toEqual({});
    expect(session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_UNTRUSTED", hostFingerprint: received })).toEqual({ pendingFingerprint: received });
  });

  it("does not replace an existing trusted identity after a mismatch", () => {
    const session = new HostKeyTrustSession(trusted);
    expect(session.receive({ success: false, steps: [], safeErrorCode: "SSH_HOST_KEY_MISMATCH", hostFingerprint: received })).toEqual({ mismatch: { trustedFingerprint: trusted, receivedFingerprint: received } });
    expect(session.trustAndRetry()).toBeUndefined();
    expect(session.trusted).toBe(trusted);
  });
});
