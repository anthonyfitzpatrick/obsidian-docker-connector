import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viewSource = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const mainSource = readFileSync(resolve(process.cwd(), "src/main.ts"), "utf8");

describe("saved Docker Context profile status lifecycle", () => {
  it("refreshes a newly saved Context through the normal single-host snapshot path", () => {
    const save = viewSource.slice(viewSource.indexOf("private async save():"), viewSource.indexOf("private renderDiagnostics"));
    expect(save).toContain('if (profile.connectionType === "docker-context") await this.plugin.retryHost(profile);');
    expect(save).not.toContain('profile.connectionType !== "docker-context" && profile.connectionType !== "docker-tls"');
  });

  it("publishes the resulting snapshot by profile ID and includes Contexts at startup/manual refresh", () => {
    expect(mainSource).toContain("this.snapshots.set(profile.id, retained)");
    expect(mainSource).toContain("this.refreshOpenDashboard();");
    expect(mainSource).toContain("connectionCapabilities(profile).supportsAutomaticRefresh");
    expect(mainSource).toContain("void this.refreshAll().catch(() => undefined);");
  });
});
