import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("Connections management actions", () => {
  it("exposes the canonical Add Docker Host workflow and safe empty state", () => {
    expect(view).toContain('text: "Docker connections"');
    expect(view).toContain('text: "Add Docker Host"');
    expect(view).toContain('new DockerHostModal(this.plugin, () => this.render()).open()');
    expect(view).toContain('"No Docker connections configured"');
  });
  it("uses shared Edit, Reconnect, and Delete actions for every card branch", () => {
    expect((view.match(/this\.addEditAction\(actions, profile\)/g) ?? []).length).toBe(3);
    expect((view.match(/this\.addReconnectAction\(actions, profile, status\)/g) ?? []).length).toBe(3);
    expect((view.match(/this\.addDeleteAction\(actions, profile\)/g) ?? []).length).toBe(3);
    expect(view).toContain('setIcon(button, "pencil")');
    expect(view).toContain('setIcon(button, "refresh-cw")');
    expect(view).toContain('new ReconnectPasswordModal(this.plugin, profile, () => this.render()).open()');
    expect(view).toContain('private readonly editingProfile?: DockerConnectionProfile');
    expect(view).toContain('this.connectionType = editingProfile.connectionType');
  });
  it("keeps Connections visibly active, accessible, and responsive", () => {
    expect(view).toContain('this.page === item.id ? " is-active" : ""');
    expect(view).toContain('"aria-current": this.page === item.id ? "page" : "false"');
    expect(css).toContain('.docker-connector__nav-item.is-active { background: var(--dc-surface-raised); color: var(--dc-accent);');
    expect(css).toContain('opacity: 1; pointer-events: auto;');
    expect(css).toContain('.dc-connections-page-header { align-items: flex-start; flex-direction: column; }');
    expect(css).toContain('.dc-connection-actions { width: 100%; }');
    expect(view).toContain('if (this.page !== "connections" && this.requiresAuthenticationGate(profiles))');
  });
});
