import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8"), css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");
describe("container management header switch", () => {
  it("is accessible, scoped to an individual Online profile, and removes the Overview panel", () => { expect(view).toContain("renderManagementSwitch(controls, profiles)"); expect(view).toContain('role: "switch"'); expect(view).toContain("input.disabled = !available"); expect(view).toContain('profileConnectionStatus(profile.id, this.plugin.snapshots) === "online"'); expect(view).not.toContain("renderManagementControl(grid, profiles)"); expect(css).toContain(".dc-management-switch input:checked"); expect(css).toContain(".dc-management-switch input:focus-visible"); });
});
