import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
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
    this.renderAboutFooter(containerEl);
  }

  /**
   * Renders the About / Support footer shared with the other Wolf 359 Press
   * plugins. The version comes from the loaded manifest so it stays correct
   * across releases without a duplicated constant.
   */
  private renderAboutFooter(containerEl: HTMLElement): void {
    const footerEl = containerEl.createDiv("docker-connector-about-footer");
    const identityEl = footerEl.createDiv("docker-connector-about-identity");
    this.renderAboutLogo(identityEl);

    const identityTextEl = identityEl.createDiv("docker-connector-about-identity-text");
    identityTextEl.createDiv({ cls: "docker-connector-about-title", text: "Docker Connector" });
    identityTextEl.createDiv({ cls: "docker-connector-about-version", text: `Version ${this.plugin.manifest.version}` });
    identityTextEl.createDiv({ cls: "docker-connector-about-credit", text: "Created by Anthony Fitzpatrick" });
    identityTextEl.createDiv({ cls: "docker-connector-about-credit", text: "Wolf 359 Press AB" });

    const linksEl = footerEl.createDiv("docker-connector-about-links");
    const primaryLinksEl = linksEl.createDiv("docker-connector-about-links-row");
    const secondaryLinksEl = linksEl.createDiv("docker-connector-about-links-row");
    const links: Array<{ icon?: string; className?: string; label: string; primary?: boolean; url: string }> = [
      { icon: "bug", label: "Report a bug", primary: true, url: "https://github.com/anthonyfitzpatrick/obsidian-docker-connector/issues/new?template=bug_report.yml&title=%5BBug+report%5D%3A+&labels=bug&ref=wolf359.app" },
      { icon: "lightbulb", label: "Request a feature", primary: true, url: "https://github.com/anthonyfitzpatrick/obsidian-docker-connector/issues/new?template=feature_request.yml&title=%5BFeature+request%5D%3A+&labels=enhancement&ref=wolf359.app" },
      { icon: "user-round", label: "Anthony Fitzpatrick", primary: true, url: "https://anthonyfitzpatrick.me/" },
      { icon: "globe", label: "wolf359.app", url: "https://wolf359.app/" },
      { icon: "book-open", label: "wolf359.press", url: "https://wolf359.press/" },
      { className: "docker-connector-about-link-coffee", label: "Buy me a coffee", url: "https://buymeacoffee.com/wolf359pressab" }
    ];

    for (const link of links) {
      const linkEl = (link.primary ? primaryLinksEl : secondaryLinksEl).createEl("button", { cls: "docker-connector-about-link", type: "button" });
      if (link.className) linkEl.addClass(link.className);
      const iconEl = linkEl.createSpan({ cls: "docker-connector-about-link-icon", attr: { "aria-hidden": "true" } });
      if (link.icon) setIcon(iconEl, link.icon);
      else iconEl.addClass("docker-connector-about-link-image-icon");
      linkEl.createSpan({ cls: "docker-connector-about-link-text", text: link.label });
      linkEl.addEventListener("click", () => this.openExternalUrl(link.url));
    }
  }

  /**
   * Draws the plugin mark inline. A community install ships only main.js,
   * manifest.json, and styles.css, so an external asset file would not exist.
   */
  private renderAboutLogo(containerEl: HTMLElement): void {
    const logoEl = containerEl.createDiv({ cls: "docker-connector-about-logo", attr: { "aria-label": "Docker Connector logo", role: "img" } });
    const markup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><rect width="512" height="512" rx="96" fill="#FFFFFF"/><g transform="translate(112 112) scale(12)" fill="none" stroke="#1F2937" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z" fill="#EDE9FE"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1" stroke="#7C3AED"/><path d="M18 17.5V9.4" stroke="#7C3AED"/></g></svg>';
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    logoEl.appendChild(document.importNode(parsed.documentElement, true));
  }

  /**
   * Opens a support link outside Obsidian. Some builds expose the helper at
   * runtime before the typings do, so both spellings are probed before the
   * window fallback.
   */
  private openExternalUrl(url: string): void {
    const app = this.app as App & { openExternalUrl?: (target: string) => void; openExternal?: (target: string) => void };
    if (app.openExternalUrl) { app.openExternalUrl(url); return; }
    if (app.openExternal) { app.openExternal(url); return; }
    window.open(url, "_blank", "noopener");
  }
}
