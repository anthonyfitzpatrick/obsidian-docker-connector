import { describe, expect, it } from "vitest";
import { HostKeyMismatchError, HostKeyTrustRequiredError } from "../src/connections/DockerTransport";
import { SshPublicKeyInstallWorkflow } from "../src/security/SshPublicKeyInstallWorkflow";

describe("SSH public-key install workflow", () => {
  it("passes the exact typed password once and immediately exposes installation progress", async () => {
    const workflow = new SshPublicKeyInstallWorkflow();
    let resolveInstall: ((value: { status: "installed" }) => void) | undefined;
    let received = "";
    workflow.setPassword("  session password  ");
    const first = workflow.submit((password) => {
      received = password;
      return new Promise((resolve) => resolveInstall = resolve);
    });
    const second = workflow.submit(async () => ({ status: "installed" }));
    expect(workflow.presentation).toEqual({ state: "installing", message: "Installing…" });
    expect(received).toBe("  session password  ");
    expect(await second).toEqual({ state: "installing", message: "Installing…" });
    resolveInstall?.({ status: "installed" });
    expect(await first).toEqual({ state: "installed", message: "Public key installed" });
    workflow.clear();
    expect(workflow.credential).toBe("");
  });

  it("keeps the current safe installer stage visible until the operation settles", async () => {
    const workflow = new SshPublicKeyInstallWorkflow();
    workflow.setPassword("password");
    let resolveInstall: ((value: { status: "installed" }) => void) | undefined;
    const attempt = workflow.submit((_password, onStage) => {
      onStage("OPEN_SFTP");
      return new Promise((resolve) => resolveInstall = resolve);
    });
    expect(workflow.presentation).toEqual({ state: "installing", stage: "OPEN_SFTP", message: "Opening SFTP…" });
    resolveInstall?.({ status: "installed" });
    await expect(attempt).resolves.toMatchObject({ state: "installed" });
  });

  it("reports an existing key and permits retry after a safe failure", async () => {
    const workflow = new SshPublicKeyInstallWorkflow();
    workflow.setPassword("password");
    expect(await workflow.submit(async () => ({ status: "already-installed" }))).toEqual({ state: "already-installed", message: "Public key already installed" });
    workflow.setPassword("password");
    expect(await workflow.submit(async () => { throw new Error("network"); })).toEqual({ state: "failed", message: "SSH public-key installation failed." });
  });

  it("requires explicit first-seen host trust before a single resumed attempt", async () => {
    const workflow = new SshPublicKeyInstallWorkflow();
    workflow.setPassword("password");
    expect(await workflow.submit(async () => { throw new HostKeyTrustRequiredError("SHA256:new"); })).toEqual({ state: "awaiting-host-trust", message: "Waiting for SSH host verification.", hostKeyRequired: "SHA256:new" });
    expect(await workflow.submit(async () => ({ status: "installed" }))).toMatchObject({ state: "awaiting-host-trust" });
    workflow.resumeAfterTrust();
    expect(await workflow.submit(async () => ({ status: "installed" }))).toMatchObject({ state: "installed" });
  });

  it("surfaces a host-key mismatch without replacing the trusted fingerprint", async () => {
    const workflow = new SshPublicKeyInstallWorkflow();
    workflow.setPassword("password");
    const result = await workflow.submit(async () => { throw new HostKeyMismatchError("SHA256:received", "SHA256:trusted"); });
    expect(result).toEqual({ state: "failed", message: "SSH host key changed. Verify the server before reconnecting.", mismatch: { trustedFingerprint: "SHA256:trusted", receivedFingerprint: "SHA256:received" } });
  });
});
