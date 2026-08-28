import { Modal, Setting } from "obsidian";
import type DockerConnectorPlugin from "../main";
import type { SshDockerProfile } from "../models/DockerConnectionProfile";
import { SshKeyGenerationWorkflow, type CompletedSshKeyGeneration } from "../security/SshKeyGenerationWorkflow";
import { SshPublicKeyInstallService, type SshPublicKeyInstallResult } from "../security/SshPublicKeyInstallService";
import { SshPublicKeyInstallWorkflow } from "../security/SshPublicKeyInstallWorkflow";
import { desktopUi } from "../platform/DesktopUiAdapter";
import { SshHostKeyMismatchModal, SshHostKeyTrustModal } from "./SshHostKeyTrustModal";

/** A child modal that retains safe generation progress and success until Close. */
export class SshKeyGenerationModal extends Modal {
  private readonly workflow = new SshKeyGenerationWorkflow();
  private delivered = false;

  constructor(private readonly plugin: DockerConnectorPlugin, private readonly onCompleted: (completed: CompletedSshKeyGeneration) => void) { super(plugin.app); }

  onOpen(): void { this.render(); }

  close(): void { if (!this.workflow.isBusy) super.close(); }

  onClose(): void {
    if (!this.delivered && this.workflow.presentation.state === "success") {
      const completed = this.workflow.takeCompleted();
      if (completed) { this.delivered = true; this.onCompleted(completed); }
    }
    this.workflow.clear();
  }

  private render(): void {
    this.contentEl.empty();
    const state = this.workflow.presentation;
    this.contentEl.createEl("h2", { text: "Generate SSH key" });
    this.contentEl.createEl("p", { text: "Creates a new Ed25519 key under ~/.ssh without overwriting existing files. A passphrase is optional and remains in memory only." });
    const busy = this.workflow.isBusy;
    if (state.state !== "success") {
      new Setting(this.contentEl).setName("Key passphrase (optional)").addText((text) => { text.inputEl.type = "password"; text.inputEl.autocomplete = "new-password"; text.setDisabled(busy); text.onChange((value) => this.workflow.setPassphrase(value)); });
      new Setting(this.contentEl).setName("Confirm passphrase").addText((text) => { text.inputEl.type = "password"; text.inputEl.autocomplete = "new-password"; text.setDisabled(busy); text.onChange((value) => this.workflow.setConfirmation(value)); });
    }
    if (state.message) this.contentEl.createDiv({ text: `${state.state === "success" ? "✓ " : ""}${state.message}${state.fingerprint ? ` ${state.fingerprint}` : ""}`, cls: `dc-host-modal__key-status is-${state.state === "failed" ? "error" : state.state === "success" ? "success" : "warning"}`, attr: { role: "status", "aria-live": "polite" } });
    const footer = new Setting(this.contentEl).addButton((button) => button.setButtonText(state.state === "success" ? "Close" : "Cancel").setDisabled(busy).onClick(() => this.close()));
    if (state.state !== "success") footer.addButton((button) => button.setButtonText(busy ? "Generating…" : state.state === "failed" ? "Retry" : "Generate key").setCta().setDisabled(busy).onClick(() => void this.generate()));
  }

  private async generate(): Promise<void> {
    const attempt = this.workflow.submit(
      (passphrase, onStage) => desktopUi(this.plugin).generateSshKey(passphrase, onStage),
      (path, passphrase) => desktopUi(this.plugin).resolvePublicKeyForPrivateKey(path, passphrase),
      () => this.render(),
    );
    this.render();
    await attempt;
    this.render();
  }
}

/** Explicit remote action: sends only the selected private key's resolved public line. */
export class SshPublicKeyInstallModal extends Modal {
  private profile: SshDockerProfile;
  private readonly workflow = new SshPublicKeyInstallWorkflow();
  private openedTrust = false;

  constructor(app: DockerConnectorPlugin["app"], profile: SshDockerProfile, private readonly publicKey: string, private readonly fingerprint: string, private readonly onInstalled: (result: SshPublicKeyInstallResult) => void, private readonly onTrusted: (fingerprint: string) => void) { super(app); this.profile = profile; }

  onOpen(): void {
    this.render();
  }

  onClose(): void { this.workflow.clear(); }

  private render(): void {
    this.contentEl.empty();
    const state = this.workflow.presentation;
    this.contentEl.createEl("h2", { text: "Install public key" });
    this.contentEl.createEl("p", { text: `Append the selected public key (${this.fingerprint}) to ${this.profile.sshHost}'s ~/.ssh/authorized_keys if it is not already present. Existing entries are preserved.` });
    this.contentEl.createEl("p", { text: "This uses the current SSH password only for this installation. It does not save the password, passphrase, or private-key contents." });
    const busy = state.state === "installing" || state.state === "awaiting-host-trust";
    new Setting(this.contentEl).setName("Current SSH password").addText((text) => { text.inputEl.type = "password"; text.inputEl.autocomplete = "current-password"; text.setValue(this.workflow.credential); text.setDisabled(busy || state.state === "installed" || state.state === "already-installed"); text.onChange((value) => this.workflow.setPassword(value)); });
    if (state.message) this.contentEl.createDiv({ text: `${state.state === "installed" || state.state === "already-installed" ? "✓ " : ""}${state.message}`, cls: `dc-host-modal__key-status is-${state.state === "failed" ? "error" : state.state === "installed" || state.state === "already-installed" ? "success" : "warning"}`, attr: { role: "status", "aria-live": "polite" } });
    const footer = new Setting(this.contentEl).addButton((button) => button.setButtonText(state.state === "installed" || state.state === "already-installed" ? "Close" : "Cancel").onClick(() => this.close()));
    if (state.state !== "installed" && state.state !== "already-installed") footer.addButton((button) => button.setButtonText(state.state === "installing" ? "Installing…" : state.state === "failed" ? "Retry" : "Install public key").setDestructive().setDisabled(busy).onClick(() => void this.install()));
  }

  private async install(): Promise<void> {
    const attempt = this.workflow.submit(
      (password, onStage) => new SshPublicKeyInstallService().install(this.profile, password, this.publicKey, onStage),
      () => this.render(),
    );
    this.render();
    const presentation = await attempt;
    this.render();
    if (presentation.hostKeyRequired && !this.openedTrust) this.openTrustModal(presentation.hostKeyRequired);
    else if (presentation.mismatch) new SshHostKeyMismatchModal(this.app, { host: this.profile.sshHost, port: this.profile.sshPort, trustedFingerprint: presentation.mismatch.trustedFingerprint, receivedFingerprint: presentation.mismatch.receivedFingerprint }).open();
    else if (presentation.state === "installed" || presentation.state === "already-installed") { this.workflow.clearCredential(); this.render(); this.onInstalled({ status: presentation.state }); }
  }

  private openTrustModal(fingerprint: string): void {
    this.openedTrust = true;
    new SshHostKeyTrustModal(this.app, { host: this.profile.sshHost, port: this.profile.sshPort, fingerprint, onTrust: () => { this.profile = { ...this.profile, hostKeyFingerprint: fingerprint }; this.onTrusted(fingerprint); this.workflow.resumeAfterTrust(); this.openedTrust = false; void this.install(); }, onCancel: () => { this.openedTrust = false; this.workflow.cancelHostTrust(); this.render(); } }).open();
  }
}
