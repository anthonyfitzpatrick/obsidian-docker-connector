import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const modal = readFileSync(new URL("../src/views/DockerDashboardView.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("SSH Authentication field layout", () => {
  it("uses the shared responsive full-width field layout", () => {
    expect(modal).toContain('sshAuthenticationSetting.settingEl.addClass("dc-host-modal__full-width-field")');
    expect(styles).toContain(".dc-host-modal .dc-host-modal__full-width-field .setting-item-control select { width: 100%; min-width: 0; }");
    expect(styles).toContain("@media (max-width: 620px) { .dc-host-modal .dc-host-modal__full-width-field { grid-template-columns: minmax(0, 1fr);");
  });

  it("preserves SSH authentication values and the conditional password and key fields", () => {
    expect(modal).toContain('addOption("password", "Password")');
    expect(modal).toContain('addOption("private-key", "Private key")');
    expect(modal).toContain('if (this.authentication === "password") this.passwordField(details); else this.privateKeyFields(details);');
    expect(modal).toContain('setName("Private-key passphrase")');
  });

  it("offers password persistence only as an explicit, scoped SSH password opt-in", () => {
    expect(modal).toContain('setName("Remember password on this device")');
    expect(modal).toContain("Stores this SSH password locally so Docker Connector can reconnect automatically after Obsidian restarts.");
    expect(modal).toContain('setButtonText("Forget stored password")');
    expect(modal).toContain("changedAwayFromPassword");
    expect(modal).toContain("forgetRememberedSshPassword");
  });

  it("offers desktop-only key generation and strict public-key installation", () => {
    expect(modal).toContain('setButtonText("Generate SSH key")');
    expect(modal).toContain('setButtonText("Install public key")');
    expect(modal).toContain("resolvePublicKeyForPrivateKey(this.privateKeyPath, this.privateKeyPassphrase || undefined)");
    expect(modal).toContain("this.resolvedPublicKey = undefined");
    expect(modal).not.toContain("generatedPublicKey");
    const generation = readFileSync(new URL("../src/security/SshKeyGenerationService.ts", import.meta.url), "utf8");
    const installation = readFileSync(new URL("../src/security/SshPublicKeyInstallService.ts", import.meta.url), "utf8");
    expect(generation).toContain('spawn("ssh-keygen"');
    expect(generation).toContain("shell: false");
    expect(generation).toContain('["-N", ""]');
    expect(generation).toContain("if (passphrase === undefined) child.stdin?.end();");
    expect(installation).toContain("HostKeyVerifier");
    expect(installation).toContain("SFTPWrapper");
    expect(installation).toContain("containsPublicKey");
    expect(installation).not.toContain(".exec(");
    expect(installation).not.toContain("ssh-copy-id");
  });

  it("wires the installer modal to observable state without persisting its password", () => {
    const setup = readFileSync(new URL("../src/views/SshKeySetupModals.ts", import.meta.url), "utf8");
    const workflow = readFileSync(new URL("../src/security/SshPublicKeyInstallWorkflow.ts", import.meta.url), "utf8");
    expect(setup).toContain("Installing…");
    expect(setup).toContain('state.state === "failed" ? "Retry"');
    expect(setup).toContain("workflow.setPassword(value)");
    expect(setup).toContain("this.workflow.clear();");
    expect(setup).toContain("this.profile, password, this.publicKey");
    expect(setup).toContain('"Install public key"');
    expect(workflow).toContain('this.current = { state: "installing"');
    expect(workflow).not.toContain("trim()");
  });

  it("keeps generation progress and the completed selected key modal-local until Close", () => {
    const setup = readFileSync(new URL("../src/views/SshKeySetupModals.ts", import.meta.url), "utf8");
    const workflow = readFileSync(new URL("../src/security/SshKeyGenerationWorkflow.ts", import.meta.url), "utf8");
    expect(setup).toContain('text: "Generate SSH key"');
    expect(setup).toContain("this.workflow.isBusy");
    expect(setup).toContain('state.state === "failed" ? "Retry"');
    expect(setup).toContain("this.workflow.takeCompleted()");
    expect(modal).toContain("completed.resolved");
    expect(workflow).toContain("Preparing key generation…");
    expect(workflow).toContain("Generating Ed25519 key…");
    expect(workflow).toContain("Validating private key…");
    expect(workflow).toContain("Resolving matching public key…");
    expect(workflow).toContain("Verifying key pair…");
    expect(workflow).not.toContain("console.");
  });

  it("does not add global Obsidian Setting overrides", () => {
    expect(styles).not.toMatch(/^\.setting-item(?:\s|\{|,)/m);
    expect(styles).not.toMatch(/^\.setting-item-control(?:\s|\{|,)/m);
  });
});
