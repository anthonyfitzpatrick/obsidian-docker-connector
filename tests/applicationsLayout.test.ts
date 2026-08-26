import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tab = readFileSync(resolve(process.cwd(), "src/applications/ApplicationsTab.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("Applications density layout", () => {
  it("renders one coherent result count rather than concatenating it twice", () => {
    expect(tab).toContain('const count = results.length === all.length ? pluralize(all.length, "application")');
    expect(tab).toContain('text: count, cls: "dc-container-result-count"');
    expect(tab).not.toContain('`${results.length}${results.length === all.length ? ""');
  });

  it("retains search, Status, Updates, and Sort controls", () => {
    for (const label of ["Search applications…", '"Status"', '"Updates"', '"Sort"']) expect(tab).toContain(label);
  });

  it("keeps project metadata and selection-driven inspector behavior", () => {
    for (const value of ["application.displayName", "application.serviceCount", "application.containerCount", "application.networkNames", "application.volumeNames", "application.imageReferences", "this.selected = application", "this.detail(layout, this.selected, containers, snapshots)"]) expect(tab).toContain(value);
  });

  it("uses scoped compact cards, toolbar, and responsive project grid", () => {
    expect(css).toContain('.docker-connector__applications-tab .docker-connector__applications-toolbar');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toContain('.docker-connector__applications-layout.is-detail-open .docker-connector__applications-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(css).toContain('@container (max-width: 980px)');
    expect(css).toContain('@container (max-width: 520px)');
    expect(css).toContain('.docker-connector__applications-tab .docker-connector__summary-card { height: 84px;');
  });
});
