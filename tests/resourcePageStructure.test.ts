import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const resourcePaths = ["src/images/ImagesTab.ts", "src/volumes/VolumesTab.ts", "src/networks/NetworksTab.ts"] as const;

describe("resource page structure", () => {
  it("renders direct resource-specific layout hooks without a shared shell", () => {
    const hooks: Record<(typeof resourcePaths)[number], string[]> = {
      "src/images/ImagesTab.ts": ["docker-connector__images-header", "docker-connector__images-toolbar", "docker-connector__images-layout", "docker-connector__images-list", "docker-connector__image-card", "docker-connector__images-detail"],
      "src/volumes/VolumesTab.ts": ["docker-connector__volumes-header", "docker-connector__volumes-toolbar", "docker-connector__volumes-layout", "docker-connector__volumes-list", "docker-connector__volume-card", "docker-connector__volumes-detail"],
      "src/networks/NetworksTab.ts": ["docker-connector__networks-header", "docker-connector__networks-toolbar", "docker-connector__networks-layout", "docker-connector__networks-list", "docker-connector__network-card", "docker-connector__networks-detail"]
    };
    resourcePaths.forEach((path) => {
      const tab = readFileSync(resolve(process.cwd(), path), "utf8");
      hooks[path].forEach((hook) => expect(tab).toContain(hook));
      expect(tab).not.toContain("dc-resource-page");
      expect(tab).not.toContain("queueMicrotask");
      expect(tab).not.toContain("querySelector");
    });
  });

  it("keeps Containers on the Applications-style card layout", () => {
    const containers = readFileSync(resolve(process.cwd(), "src/containers/ContainersTab.ts"), "utf8");
    for (const hook of ["docker-connector__containers-layout", "docker-connector__containers-list", "docker-connector__container-card", "dc-container-detail-panel"]) expect(containers).toContain(hook);
  });

  it("keeps metric cards focused on summary rendering", () => {
    const metrics = readFileSync(resolve(process.cwd(), "src/ui/MetricCards.ts"), "utf8");
    expect(metrics).toContain("dc-resource-summary");
    expect(metrics).not.toContain("queueMicrotask");
    expect(metrics).not.toContain("querySelector");
  });
});
