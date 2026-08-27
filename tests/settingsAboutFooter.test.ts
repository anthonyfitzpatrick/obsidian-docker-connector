import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settings = readFileSync(resolve(process.cwd(), "src/settings/settings.ts"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("settings About footer", () => {
  it("names the plugin, its version from the manifest, and its authors", () => {
    expect(settings).toContain('text: "Docker Connector"');
    expect(settings).toContain("Version ${this.plugin.manifest.version}");
    expect(settings).toContain('text: "Created by Anthony Fitzpatrick"');
    expect(settings).toContain('text: "Wolf 359 Press AB"');
  });

  it("links every support destination", () => {
    for (const url of [
      "https://github.com/anthonyfitzpatrick/obsidian-docker-connector/issues/new?template=bug_report.yml",
      "https://github.com/anthonyfitzpatrick/obsidian-docker-connector/issues/new?template=feature_request.yml",
      "https://anthonyfitzpatrick.me/",
      "https://wolf359.app/",
      "https://wolf359.press/",
      "https://buymeacoffee.com/wolf359pressab"
    ]) expect(settings).toContain(url);
    // The issue links carry the label so GitHub files the report correctly.
    expect(settings).toContain("labels=bug");
    expect(settings).toContain("labels=enhancement");
  });

  it("draws the mark inline, because a community install ships no asset files", () => {
    expect(settings).toContain("docker-connector-about-logo");
    expect(settings).toContain("<svg xmlns=");
    expect(settings).not.toMatch(/createEl\("img"[^)]*icon/);
  });

  it("opens links outside Obsidian without importing Electron", () => {
    expect(settings).toContain("openExternalUrl");
    expect(settings).toContain('window.open(url, "_blank", "noopener")');
    expect(settings).not.toContain("require(\"electron\")");
  });

  it("styles the footer with theme variables so it follows light and dark", () => {
    for (const rule of [".docker-connector-about-footer", ".docker-connector-about-link", ".docker-connector-about-link-coffee", ".docker-connector-about-link-image-icon"]) {
      expect(styles).toContain(rule);
    }
    expect(styles).toContain("var(--background-secondary)");
    expect(styles).toContain("var(--text-muted)");
  });
});
