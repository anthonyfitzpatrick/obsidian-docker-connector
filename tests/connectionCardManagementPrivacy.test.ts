import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("connection card management and SSH privacy", () => {
  it("places each shared management switch in its own centered footer row", () => {
    expect((view.match(/this\.addCardManagementSwitch\(management, profile, status\)/g) ?? []).length).toBe(1);
    expect(view).toContain('role: "switch", "aria-label": `Container management for ${profile.name}`');
    expect(view).toContain("this.plugin.setProfileManagementEnabled(profile.id, input.checked)");
    expect(view).toContain('cls: "dc-connection-card-footer"');
    expect(view).toContain('cls: "dc-connection-card-actions"');
    expect(view).toContain('cls: "dc-connection-card-management"');
    expect(css).toContain(".dc-card-management-switch");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain(".dc-connection-card-management { display: flex; align-items: center; justify-content: center;");
    expect(css).toContain(".dc-connection-card-actions { display: flex; align-items: center; justify-content: flex-start;");
    expect(css).not.toContain(".dc-card-management-switch { width: 100%");
  });

  it("keeps unavailable and enabled states in the same compact switch component", () => {
    const managementSwitch = view.slice(view.indexOf("private addCardManagementSwitch"), view.indexOf("private addDeleteAction"));
    expect(managementSwitch).toContain('available ? enabled ? "Enabled" : "Read-only" : "Unavailable"');
    expect(managementSwitch).toContain('cls: "dc-card-management-switch"');
    expect(managementSwitch).not.toContain("createDiv()");
  });

  it("keeps Delete, Reconnect, and Retry in the action row rather than the management row", () => {
    expect((view.match(/this\.addReconnectAction\(primaryActions, profile, status\);\s*this\.addDeleteAction\(primaryActions, profile\);\s*const management = footer\.createDiv\(\{ cls: "dc-connection-card-management" \}\);/g) ?? []).length).toBe(1);
    const managementRows = view.match(/const management = footer\.createDiv\(\{ cls: "dc-connection-card-management" \}\);\s*this\.addCardManagementSwitch\(management, profile, status\);/g) ?? [];
    expect(managementRows).toHaveLength(1);
    expect(managementRows.join("\n")).not.toContain("addDeleteAction");
  });

  it("does not expose SSH usernames or authentication modes in ordinary card metadata", () => {
    const summary = view.slice(view.indexOf("function connectionSummary"));
    expect(summary).toContain("`${profile.sshHost}:${profile.sshPort}`");
    expect(summary).not.toContain("sshUsername");
    const endpointStart = view.lastIndexOf('const endpoint = card.createDiv({ cls: "dc-host-card-endpoint" });');
    const endpoint = view.slice(endpointStart, view.indexOf('const inventory = card.createDiv', endpointStart));
    expect(endpoint).toContain("this.connectionCardEndpointDetails(profile)");
    expect(endpoint).not.toContain('"Password"');
    expect(endpoint).not.toContain("Private Key File");
    expect(endpoint).not.toContain("Passphrase");
    const adapter = view.slice(view.indexOf("private connectionCardEndpointDetails"), view.indexOf("private addEditAction"));
    expect(adapter).toContain("return [connectionSummary(profile)]");
    expect(view).toContain("this.username = editingProfile.sshUsername");
    expect(view).toContain("sshUsername: clean(this.username)");
    expect(view).toContain('setName(this.privateKeyPath ? "Selected Private Key File" : "Private Key File")');
    expect(view).toContain('setName(tls ? "Client Key Passphrase" : privateKey ? "Private-Key Passphrase" : "SSH Password")');
  });
});
