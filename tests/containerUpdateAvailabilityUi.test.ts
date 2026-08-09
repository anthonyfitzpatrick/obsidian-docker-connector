import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("container image update availability UI", () => {
  it("renders exactly one safe availability state and enables Update only for an available image", async () => {
    const source = await readFile("src/containers/ContainersTab.ts", "utf8");
    expect(source).toMatch(/state === "not-checked"/);
    expect(source).toMatch(/state === "checking"/);
    expect(source).toMatch(/state === "available"/);
    expect(source).toMatch(/state === "current"/);
    expect(source).toMatch(/state === "error"/);
    expect(source).toMatch(/Update status not checked/);
    expect(source).toMatch(/Image is current/);
    expect(source).toMatch(/Could not check for updates/);
    const available = source.slice(source.indexOf('if (status.state === "available")'), source.indexOf('if (status.state === "current")'));
    expect(available).toMatch(/add\("Update"/);
    const current = source.slice(source.indexOf('if (status.state === "current")'), source.indexOf('if (status.state === "error")'));
    expect(current).not.toMatch(/add\("Update"/);
  });

  it("uses the typed check service for Check now and rerenders without invoking the update transaction", async () => {
    const source = await readFile("src/containers/ContainersTab.ts", "utf8");
    const statusRenderer = source.slice(source.indexOf("private imageUpdate"), source.indexOf("private updateRows"));
    expect(statusRenderer).toMatch(/checkContainerImageUpdate\(profile, summary\.id, true\)/);
    expect(statusRenderer).toMatch(/await pending; this\.rerender\(\)/);
    expect(statusRenderer).not.toMatch(/updateContainer\(/);
  });

  it("notifies open views when a background status check settles", async () => {
    const main = await readFile("src/main.ts", "utf8");
    expect(main).toMatch(/containerImageUpdates\.onStatusChange/);
    expect(main).toMatch(/this\.refreshOpenDashboard\(\)/);
  });

  it("keeps the post-update status current without immediately scheduling another pull", async () => {
    const main = await readFile("src/main.ts", "utf8");
    expect(main).toMatch(/await this\.retryHost\(profile, false\)/);
    expect(main).toMatch(/this\.containerImageUpdates\.markCurrent/);
  });
});
