import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Updates Available container summary card", () => {
  it("counts only available update statuses and toggles only the update filter", async () => {
    const source = await readFile("src/containers/ContainersTab.ts", "utf8");
    expect(source).toMatch(/containerImageUpdateStatus\(container\.hostProfileId, container\.id\)\?\.state === "available"/);
    expect(source).toMatch(/label: "Updates Available"/);
    expect(source).toMatch(/detail: availableCount \? "Containers needing updates" : "Everything is up to date\."/);
    expect(source).toMatch(/this\.state\.updatesOnly = !this\.state\.updatesOnly/);
  });

  it("filters through the shared selector, presents the chip and clears only that filter", async () => {
    const source = await readFile("src/containers/ContainersTab.ts", "utf8");
    expect(source).toMatch(/selectContainers\(all, this\.state, availableUpdateKeys\)/);
    expect(source).toMatch(/filter\.id === "updates"\) this\.state\.updatesOnly = false/);
    const selectors = await readFile("src/containers/ContainerSelectors.ts", "utf8");
    expect(selectors).toMatch(/Updates available/);
  });

  it("reconciles selection and presents the no-updates empty state", async () => {
    const source = await readFile("src/containers/ContainersTab.ts", "utf8");
    expect(source).toMatch(/reconcileUpdateFilterSelection\(results\)/);
    expect(source).toMatch(/Everything is up to date/);
    expect(source).toMatch(/No containers currently have a newer image available\./);
    expect(source).toMatch(/Show all containers/);
  });

  it("uses a native summary button with an accessible update-filter label", async () => {
    const source = await readFile("src/ui/MetricCards.ts", "utf8");
    const tab = await readFile("src/containers/ContainersTab.ts", "utf8");
    expect(source).toMatch(/grid\.createEl\("button"/);
    expect(tab).toMatch(/ariaLabel: "Show only containers with available updates"/);
  });
});
