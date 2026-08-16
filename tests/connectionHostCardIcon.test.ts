import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("connection host card icon", () => {
  it("renders one canonical decorative server icon before any transport-specific branch", () => {
    const card = view.slice(view.indexOf("private renderConnectionRow"), view.indexOf("private addEditAction"));
    const icon = 'identity.createDiv({ cls: "dc-host-card-icon", attr: { "aria-hidden": "true" } }); setIcon(icon, "server")';
    expect(card).toContain(icon);
    expect(card.indexOf(icon)).toBeLessThan(card.indexOf('if (profile.connectionType === "docker-context")'));
    expect((card.match(/setIcon\(icon,/g) ?? [])).toHaveLength(1);
    expect(card).not.toMatch(/connectionType[^\n]{0,120}setIcon\(icon/);
  });

  it("uses one purple host-card treatment that does not depend on status or connection type", () => {
    const style = css.slice(css.indexOf(".dc-host-card-icon"), css.indexOf(".dc-connections-panel"));
    expect(style).toContain("background: var(--dc-host-card-icon-background)");
    expect(style).toContain("color: var(--dc-host-card-icon-color)");
    expect(style).not.toContain("status-");
    expect(style).not.toContain("ssh");
    expect(style).not.toContain("tls");
    expect(style).not.toContain("context");
  });

  it("applies one shared host-card typography structure before transport-specific content", () => {
    const card = view.slice(view.indexOf("private renderConnectionRow"), view.indexOf("private addEditAction"));
    const title = 'copy.createEl("h3", { text: profile.name, cls: "dc-host-card-title" })';
    expect(card).toContain(title);
    expect((card.match(/dc-host-card-meta docker-connector__muted/g) ?? [])).toHaveLength(2);
    expect((card.match(/cls: "dc-host-card-endpoint"/g) ?? [])).toHaveLength(3);
    expect(card.indexOf(title)).toBeLessThan(card.indexOf('if (profile.connectionType === "docker-context")'));
    expect(card).not.toMatch(/dc-(ssh|tls|context|local|gateway)-host-card/);
  });

  it("centralizes title, metadata, endpoint, metric, badge, and management metrics in host-card tokens", () => {
    const style = css.slice(css.indexOf(".dc-connection-card {"), css.indexOf("@container (max-width: 620px)"));
    expect(style).toContain("--dc-host-card-title-size");
    expect(style).toContain("--dc-host-card-meta-size");
    expect(style).toContain("--dc-host-card-endpoint-size");
    expect(style).toContain("--dc-host-card-label-size");
    expect(style).toContain("--dc-host-card-metric-value-size");
    expect(style).toContain("--dc-host-card-management-size");
    expect(style).toContain("--dc-host-card-action-size");
    expect(style).toContain(".dc-host-card-title");
    expect(style).toContain(".dc-host-card-meta");
    expect(style).toContain(".dc-host-card-endpoint");
    expect(style).toContain(".dc-connection-card .docker-connector__status");
    expect(style).toContain(".dc-connection-card .dc-card-management-switch");
  });
});
