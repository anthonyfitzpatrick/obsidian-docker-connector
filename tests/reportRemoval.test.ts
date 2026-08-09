import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { describe, expect, it } from "vitest";

describe("retired Markdown reports", () => {
  it("does not expose a report route or report generator in production source", async () => {
    const [dashboard, plugin, settings] = await Promise.all([
      readFile("src/views/DockerDashboardView.ts", "utf8"),
      readFile("src/main.ts", "utf8"),
      readFile("src/settings/settings.ts", "utf8")
    ]);

    expect(dashboard).not.toMatch(/label:\s*"Reports"/);
    expect(dashboard).not.toContain('"reports"');
    expect(plugin).not.toContain("ReportGenerator");
    expect(plugin).not.toContain("generateHostReport");
    expect(plugin).not.toContain("generatePortfolioReport");
    expect(settings).not.toMatch(/^\s*reportFolder:/m);
  });

  it("removes the report generator implementation", async () => {
    await expect(access("src/reports/ReportGenerator.ts", constants.F_OK)).rejects.toBeDefined();
  });
});
