import { App, Notice, PluginSettingTab, Setting, ToggleComponent } from "obsidian";
import type DockerConnectorPlugin from "../main";
import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import type { ContainerDensity } from "../containers/ContainerModels";

export interface DockerConnectorSettings {
  profiles: DockerConnectionProfile[];
  automaticRefresh: boolean;
  refreshIntervalMinutes: number;
  integrateWithTheme: boolean;
  containerDensity: ContainerDensity;
  containerManagementEnabled: boolean;
}

export const DEFAULT_SETTINGS: DockerConnectorSettings = {
  profiles: [],
  automaticRefresh: true,
  refreshIntervalMinutes: 5,
  integrateWithTheme: true,
  containerDensity: "comfortable",
  containerManagementEnabled: false
};

type ContainerManagementStatus = "saving" | "save-failed" | undefined;

export function toSafeSettingsErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown persistence error.";
  const withoutStack = raw.split("\n")[0].replace(/(?:[A-Za-z]:\\|\/)[^\s]+/g, "<path>").trim();
  return (withoutStack || "Unknown persistence error.").slice(0, 180);
}

/** Settings UI and persistence boundary. Documentation: Docker Connector - Settings.md */
export class DockerConnectorSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: DockerConnectorPlugin) { super(app, plugin); }
  private containerManagementSaveInProgress = false;
  private containerManagementProgrammaticChange = false;
  private containerManagementStatus: ContainerManagementStatus;

  private setContainerManagementToggle(toggle: ToggleComponent, value: boolean): void {
    this.containerManagementProgrammaticChange = true;
    toggle.setValue(value);
    this.containerManagementProgrammaticChange = false;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Docker Connector" });
    new Setting(containerEl).setName("Automatic refresh").setDesc("Refresh configured hosts in the background.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.automaticRefresh).onChange(async (value) => {
        this.plugin.settings.automaticRefresh = value;
        await this.plugin.saveSettings();
        this.plugin.configureRefresh();
      }));
    new Setting(containerEl).setName("Refresh interval").setDesc("Minutes between background refreshes.")
      .addText((text) => text.setValue(String(this.plugin.settings.refreshIntervalMinutes)).onChange(async (value) => {
        const minutes = Number(value);
        if (Number.isFinite(minutes) && minutes >= 1) {
          this.plugin.settings.refreshIntervalMinutes = Math.floor(minutes);
          await this.plugin.saveSettings();
          this.plugin.configureRefresh();
        }
      }));
    new Setting(containerEl).setName("Theme integration").setDesc("Use Obsidian's native theme variables.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.integrateWithTheme).onChange(async (value) => {
        this.plugin.settings.integrateWithTheme = value;
        await this.plugin.saveSettings();
      }));
    const managementSetting = new Setting(containerEl).setName("Container management").setDesc("Allow explicit Start, Shut down, Stop, Restart and Update actions for containers. Docker access is highly privileged.");
    const status = managementSetting.settingEl.createDiv({ cls: "docker-connector__settings-status", attr: { "aria-live": "polite" } });
    const renderStatus = () => {
      const text = this.containerManagementStatus === "saving"
        ? "Status: Saving…"
        : this.containerManagementStatus === "save-failed"
          ? "Status: Save failed"
          : `Status: ${this.plugin.settings.containerManagementEnabled ? "Enabled" : "Disabled"}`;
      status.setText(text);
    };
    renderStatus();
    managementSetting.addToggle((toggle) => toggle.setValue(this.plugin.settings.containerManagementEnabled).onChange(async (requestedValue) => {
      if (this.containerManagementProgrammaticChange || this.containerManagementSaveInProgress) return;
      if (requestedValue && !window.confirm("Container management allows Docker Connector to change container state and recreate containers. Docker access is highly privileged. Enable this only for trusted Docker hosts.")) {
        this.setContainerManagementToggle(toggle, false);
        return;
      }
      this.containerManagementSaveInProgress = true;
      this.containerManagementStatus = "saving";
      toggle.setDisabled(true);
      renderStatus();
      try {
        const persistedValue = await this.plugin.setContainerManagementEnabled(requestedValue);
        if (persistedValue !== requestedValue || this.plugin.settings.containerManagementEnabled !== requestedValue) throw new Error("Container management setting did not retain the requested value.");
        this.setContainerManagementToggle(toggle, persistedValue);
        this.containerManagementStatus = undefined;
        renderStatus();
        new Notice(persistedValue ? "Container management enabled." : "Container management disabled.");
      } catch (error) {
        this.setContainerManagementToggle(toggle, this.plugin.settings.containerManagementEnabled);
        this.containerManagementStatus = "save-failed";
        renderStatus();
        new Notice(`Could not save Container management setting: ${toSafeSettingsErrorMessage(error)}`);
      } finally {
        this.containerManagementSaveInProgress = false;
        toggle.setDisabled(false);
      }
    }));
  }
}
