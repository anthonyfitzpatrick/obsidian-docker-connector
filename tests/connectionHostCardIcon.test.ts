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
    expect(style).toContain("background: var(--dc-accent-soft)");
    expect(style).toContain("color: var(--dc-accent)");
    expect(style).not.toContain("status-");
    expect(style).not.toContain("ssh");
    expect(style).not.toContain("tls");
    expect(style).not.toContain("context");
  });
});
