import { App, Modal, Setting } from "obsidian";

/**
 * Every destructive or privilege-granting action in the plugin asks first.
 * Obsidian plugins must not use the browser confirm() dialog, so this is the
 * single place that shape of question is asked.
 */
export interface ConfirmationRequest {
  /** Modal title; the action about to happen, in sentence case. */
  title: string;
  /** One sentence explaining the consequence. */
  message: string;
  /** Optional label/value rows identifying exactly what is affected. */
  details?: { label: string; value: string }[];
  /** Label for the accepting button. Defaults to "Confirm". */
  confirmText?: string;
  /** Styles the accepting button as destructive rather than as the call to action. */
  destructive?: boolean;
}

class ConfirmationModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private readonly request: ConfirmationRequest,
    private readonly resolve: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.request.title);
    this.contentEl.addClass("dc-confirmation");
    this.contentEl.createEl("p", { cls: "dc-confirmation__message", text: this.request.message });
    if (this.request.details?.length) {
      const list = this.contentEl.createEl("dl", { cls: "dc-confirmation__details" });
      for (const detail of this.request.details) {
        list.createEl("dt", { text: detail.label });
        list.createEl("dd", { text: detail.value });
      }
    }
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((button) => {
        button.setButtonText(this.request.confirmText ?? "Confirm").onClick(() => {
          this.confirmed = true;
          this.close();
        });
        // setDestructive() is the current spelling but is @since 1.13.0.
        // Taking it would raise minAppVersion from 1.7.2 to 1.13.0 and drop
        // every user in between, which is not worth a button style.
        if (this.request.destructive) button.setWarning();
        else button.setCta();
      });
  }

  /** Dismissing the modal any way other than the accepting button declines. */
  onClose(): void {
    this.contentEl.empty();
    this.resolve(this.confirmed);
  }
}

export function confirmAction(app: App, request: ConfirmationRequest): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmationModal(app, request, resolve).open();
  });
}
