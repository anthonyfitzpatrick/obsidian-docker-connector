import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("connection card management and SSH privacy", () => {
  it("adds the shared profile-scoped management switch to every card branch", () => {
    expect((view.match(/this\.addCardManagementSwitch\(actions, profile, status\)/g) ?? []).length).toBe(3);
    expect(view).toContain('role: "switch", "aria-label": `Container management for ${profile.name}`');
    expect(view).toContain("this.plugin.setProfileManagementEnabled(profile.id, input.checked)");
    expect(css).toContain(".dc-card-management-switch");
    expect(css).toContain("@media (max-width: 620px)");
  });

  it("does not expose SSH usernames in ordinary connection summaries", () => {
    const summary = view.slice(view.indexOf("function connectionSummary"));
    expect(summary).toContain("`${profile.sshHost}:${profile.sshPort}`");
    expect(summary).not.toContain("sshUsername");
    expect(view).toContain("this.username = editingProfile.sshUsername");
    expect(view).toContain("sshUsername: clean(this.username)");
  });
});
