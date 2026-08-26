import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8"), css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");
describe("container management header switch", () => {
  it("does not render a global management control in the dashboard header", () => { expect(view).not.toContain("renderManagementSwitch"); expect(view).not.toContain('aria-label": "Container management"'); expect(view).not.toContain("Individual host required"); expect(css).not.toContain(".dc-management-switch"); });
  it("retains the profile-scoped Connections card control and authorization gate", () => { expect(view).toContain("this.addCardManagementSwitch(management, profile, status)"); expect(view).toContain('aria-label": `Container management for ${profile.name}`'); expect(view).toContain("connectionCapabilities(profile).supportsContainerActions"); expect(view).toContain("this.plugin.setProfileManagementEnabled(profile.id, input.checked)"); expect(css).toContain(".dc-card-management-switch input:checked"); });
});
