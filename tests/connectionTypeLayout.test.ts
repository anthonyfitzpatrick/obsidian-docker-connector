import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const modal = readFileSync(new URL("../src/views/DockerDashboardView.ts", import.meta.url), "utf8");

describe("Connection Type field layout", () => {
  it("uses a shared scoped responsive grid and full-width native select", () => {
    expect(modal).toContain('connectionTypeSetting.settingEl.addClass("dc-host-modal__connection-type")');
    expect(modal).toContain('connectionTypeSetting.settingEl.addClass("dc-host-modal__full-width-field")');
    expect(styles).toContain(".dc-host-modal .dc-host-modal__full-width-field { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(300px, 1.2fr);");
    expect(styles).toContain(".dc-host-modal .dc-host-modal__full-width-field .setting-item-control select { width: 100%; min-width: 0; }");
    expect(styles).toContain("@media (max-width: 620px) { .dc-host-modal .dc-host-modal__full-width-field { grid-template-columns: minmax(0, 1fr);");
  });

  it("preserves all four option labels and stable internal values", () => {
    [["local", "Local Docker Socket"], ["docker-context", "Docker Context"], ["ssh", "Remote Docker via SSH"], ["docker-tls", "Remote Docker API (Mutual TLS)"]].forEach(([value, label]) => {
      expect(modal).toContain(`addOption("${value}", "${label}")`);
    });
  });

  it("does not introduce a global Obsidian Setting override", () => {
    expect(styles).not.toMatch(/^\.setting-item(?:\s|\{|,)/m);
    expect(styles).not.toMatch(/^\.setting-item-control(?:\s|\{|,)/m);
  });
});
