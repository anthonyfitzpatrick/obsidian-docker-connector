import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tab = readFileSync(resolve(process.cwd(), "src/volumes/VolumesTab.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");
const rule = (selector: string) => [...css.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g"))].at(-1)?.[1] ?? "";

describe("Volumes resource layout", () => {
  it("retains dynamic inventory counts, host scope, and four operational summary cards", () => {
    for (const value of ["results.length === all.length", "${results.length} of ${all.length} volumes", 'selectedHostId === "all" ? "All Docker hosts"', 'label: "Volumes"', 'label: "In use"', 'label: "No visible references"', 'label: "Drivers"']) expect(tab).toContain(value);
  });

  it("retains labelled search and filter controls with the compact volume inventory", () => {
    for (const value of ['"Search volumes…"', '"Filter"', '"Driver"', '"Scope"', '"Sort"', '"dc-volumes-tab"', "docker-connector__volumes-header", "docker-connector__volumes-toolbar", "docker-connector__volumes-layout", "docker-connector__volumes-list", "docker-connector__volume-card${", "docker-connector__volume-card-header", "docker-connector__volume-card-secondary", "docker-connector__volume-card-metadata", "Mount · ${truncate(volume.mountpoint)}", "containers"]) expect(tab).toContain(value);
    expect(tab).not.toContain("dc-resource-page");
  });

  it("keeps volume inspection, container relationships, and safe truncation intact", () => {
    for (const value of ['"Close volume details"', '"Overview"', '"Driver"', '"Scope"', '"Mountpoint"', '"Created"', '"Options"', '"Labels"', '"Containers using volume"', "this.openContainer", "value.length > 36"]) expect(tab).toContain(value);
  });

  it("uses direct volume cards with responsive inspector and long-name safety", () => {
    for (const value of ["docker-connector__volumes-header", "docker-connector__volumes-toolbar", "docker-connector__volumes-layout.is-detail-open", "docker-connector__volumes-list", "docker-connector__volume-card", "docker-connector__volumes-detail"]) expect(css).toContain(value);
    expect(css).toContain(".dc-volumes-tab .docker-connector__volume-card:hover");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(320px, .72fr);");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain("background: var(--dc-surface);");
    expect(css).toContain("color-mix(in srgb, var(--dc-accent) 7%, var(--dc-surface-raised))");
    expect(css).toContain(".dc-volumes-tab .docker-connector__volumes-detail .dc-container-detail-row span");
    expect(css).toContain("@container (max-width: 620px) { .dc-images-tab .docker-connector__images-toolbar");
    expect(css).not.toContain("dc-resource-page");
    expect(tab).not.toContain("docker-connector__volume-row");
  });

  it("anchors every volume text line to a fixed icon and flexible text track", () => {
    const card = rule(".dc-volumes-tab .docker-connector__volume-card");
    const header = rule(".dc-volumes-tab .docker-connector__volume-card-header");
    const title = rule(".dc-volumes-tab .docker-connector__volume-card-identity strong");
    const metadata = rule(".dc-volumes-tab .docker-connector__volume-card-metadata");
    const secondary = rule(".dc-volumes-tab .docker-connector__volume-card-secondary, .dc-volumes-tab .docker-connector__volume-card-metadata");

    expect(card).toContain("grid-template-columns: 20px minmax(0, 1fr) auto");
    expect(card).toContain("align-items: start");
    expect(card).toContain("justify-items: stretch");
    expect(card).toContain("text-align: left");
    expect(header).toContain("grid-template-columns: 20px minmax(0, 1fr) auto");
    expect(title).toContain("grid-column: 2");
    expect(title).toContain("text-align: left");
    expect(secondary).toContain("grid-column: 2");
    expect(metadata).toContain("flex-direction: column");
    expect(metadata).toContain("align-items: flex-start");
    expect(metadata).toContain("text-align: left");
    expect(rule(".dc-volumes-tab .docker-connector__volume-card-header > .dc-container-badge")).toContain("grid-column: 3");
    for (const declaration of ["text-align: center", "justify-content: center", "justify-items: center", "place-items: center"]) expect(`${card}${header}${title}${metadata}${secondary}`).not.toContain(declaration);
  });
});
