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
    expect(modal).toContain('addOption("private-key", "Private Key")');
    expect(modal).toContain('if (this.authentication === "password") this.passwordField(details); else this.privateKeyFields(details);');
    expect(modal).toContain('setName("Private-Key Passphrase")');
  });

  it("does not add global Obsidian Setting overrides", () => {
    expect(styles).not.toMatch(/^\.setting-item(?:\s|\{|,)/m);
    expect(styles).not.toMatch(/^\.setting-item-control(?:\s|\{|,)/m);
  });
});
