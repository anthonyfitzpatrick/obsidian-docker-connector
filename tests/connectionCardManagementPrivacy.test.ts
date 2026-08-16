import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("connection card management and SSH privacy", () => {
  it("keeps each shared management switch compactly grouped with the footer controls", () => {
    expect((view.match(/this\.addCardManagementSwitch\(footerControls, profile, status\)/g) ?? []).length).toBe(3);
    expect(view).toContain('role: "switch", "aria-label": `Container management for ${profile.name}`');
    expect(view).toContain("this.plugin.setProfileManagementEnabled(profile.id, input.checked)");
    expect(view).toContain('cls: "dc-connection-action-group"');
    expect(view).toContain('cls: "dc-connection-footer-controls"');
    expect(css).toContain(".dc-card-management-switch");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain(".dc-connection-footer-controls { margin-left: auto; flex-wrap: nowrap; }");
    expect(css).toContain("justify-content: space-between");
    expect(css).toContain(".dc-connection-footer-controls { width: 100%; justify-content: space-between; margin-left: 0;");
    expect(css).not.toContain(".dc-card-management-switch { width: 100%");
  });

  it("keeps unavailable and enabled states in the same compact switch component", () => {
    const managementSwitch = view.slice(view.indexOf("private addCardManagementSwitch"), view.indexOf("private addDeleteAction"));
    expect(managementSwitch).toContain('available ? enabled ? "Enabled" : "Read-only" : "Unavailable"');
    expect(managementSwitch).toContain('cls: "dc-card-management-switch"');
    expect(managementSwitch).not.toContain("createDiv()");
  });

  it("does not expose SSH usernames or authentication modes in ordinary card metadata", () => {
    const summary = view.slice(view.indexOf("function connectionSummary"));
    expect(summary).toContain("`${profile.sshHost}:${profile.sshPort}`");
    expect(summary).not.toContain("sshUsername");
    const endpointStart = view.lastIndexOf('const endpoint = card.createDiv({ cls: "dc-connection-endpoint" });');
    const endpoint = view.slice(endpointStart, view.indexOf("if (snapshot)", endpointStart));
    expect(endpoint).toContain('if (profile.connectionType !== "ssh")');
    expect(endpoint).not.toContain('"Password"');
    expect(endpoint).not.toContain("Private Key File");
    expect(endpoint).not.toContain("Passphrase");
    expect(view).toContain("this.username = editingProfile.sshUsername");
    expect(view).toContain("sshUsername: clean(this.username)");
    expect(view).toContain('setName(this.privateKeyPath ? "Selected Private Key File" : "Private Key File")');
    expect(view).toContain('setName(tls ? "Client Key Passphrase" : privateKey ? "Private-Key Passphrase" : "SSH Password")');
  });
});
