import { App, PluginSettingTab, Setting } from "obsidian";
import type DockerConnectorPlugin from "../main";
import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import type { ContainerDensity } from "../containers/ContainerModels";

export interface DockerConnectorSettings {
  profiles: DockerConnectionProfile[];
  automaticRefresh: boolean;
  refreshIntervalMinutes: number;
  integrateWithTheme: boolean;
  containerDensity: ContainerDensity;
}

export const DEFAULT_SETTINGS: DockerConnectorSettings = {
  profiles: [],
  automaticRefresh: true,
  refreshIntervalMinutes: 5,
  integrateWithTheme: true,
  containerDensity: "comfortable"
};

export function toSafeSettingsErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown persistence error.";
  const withoutStack = raw.split("\n")[0].replace(/(?:[A-Za-z]:\\|\/)[^\s]+/g, "<path>").trim();
  return (withoutStack || "Unknown persistence error.").slice(0, 180);
}

/** Settings UI and persistence boundary. Documentation: Docker Connector - Settings.md */
export class DockerConnectorSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: DockerConnectorPlugin) { super(app, plugin); }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
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
  }
}
