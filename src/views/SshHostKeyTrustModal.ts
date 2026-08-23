import { Modal, Setting } from "obsidian";

export interface SshHostKeyTrustModalOptions {
  host: string;
  port: number;
  fingerprint: string;
  onTrust: () => void;
  onCancel: () => void;
}

/** An explicit, credential-free confirmation for a first-seen SSH host key. */
export class SshHostKeyTrustModal extends Modal {
  constructor(app: Modal["app"], private readonly options: SshHostKeyTrustModalOptions) { super(app); }

  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Verify SSH Host" });
    this.contentEl.createEl("p", { text: "This is the first time Docker Connector has connected to this SSH host." });
    new Setting(this.contentEl).setName("Host").setDesc(`${this.options.host}:${this.options.port}`);
    new Setting(this.contentEl).setName("Host key fingerprint").setDesc(this.options.fingerprint);
    this.contentEl.createEl("p", { text: "Verify this fingerprint against a trusted source before continuing." });
    const footer = this.contentEl.createDiv({ cls: "dc-host-modal__footer" });
    const cancel = footer.createEl("button", { text: "Cancel" });
    cancel.onclick = () => { this.options.onCancel(); this.close(); };
    const trust = footer.createEl("button", { text: "Trust and Continue", cls: "mod-cta" });
    trust.onclick = () => { this.options.onTrust(); this.close(); };
    cancel.focus();
  }
}

export interface SshHostKeyMismatchModalOptions {
  host: string;
  port: number;
  trustedFingerprint: string;
  receivedFingerprint: string;
}

/** A blocking warning. Replacing an existing identity is never a one-click action. */
export class SshHostKeyMismatchModal extends Modal {
  constructor(app: Modal["app"], private readonly options: SshHostKeyMismatchModalOptions) { super(app); }

  onOpen(): void {
    this.contentEl.createEl("h2", { text: "SSH Host Identity Changed" });
    this.contentEl.createEl("p", { text: "Docker Connector received a different SSH host key than the one trusted for this connection." });
    new Setting(this.contentEl).setName("Host").setDesc(`${this.options.host}:${this.options.port}`);
    new Setting(this.contentEl).setName("Trusted fingerprint").setDesc(this.options.trustedFingerprint);
    new Setting(this.contentEl).setName("Received fingerprint").setDesc(this.options.receivedFingerprint);
    this.contentEl.createEl("p", { text: "This can indicate that the server was rebuilt, its SSH keys changed, or that the connection is being intercepted." });
    const footer = this.contentEl.createDiv({ cls: "dc-host-modal__footer" });
    const cancel = footer.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();
    cancel.focus();
  }
}
