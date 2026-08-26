import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tab = readFileSync(resolve(process.cwd(), "src/images/ImagesTab.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("Images resource layout", () => {
  it("retains dynamic inventory counts, host scope, and four operational summary cards", () => {
    for (const value of ["results.length === all.length", "${results.length} of ${all.length} images", 'selectedHostId === "all" ? "All Docker hosts"', 'label: "Images"', 'label: "In use"', 'label: "Dangling"', 'label: "No visible references"']) expect(tab).toContain(value);
  });

  it("retains the searchable, labelled image controls and operational list", () => {
    for (const value of ['"Search images…"', '"Filter"', '"Architecture"', '"OS"', '"Sort"', '"dc-images-tab"', "docker-connector__images-header", "docker-connector__images-toolbar", "docker-connector__images-layout", "docker-connector__images-list", "docker-connector__image-card${", "docker-connector__image-card-header", "docker-connector__image-card-id", "docker-connector__image-card-metadata", "docker-connector__images-detail", " is-detail-open", " is-selected"]) expect(tab).toContain(value);
    expect(tab).not.toContain("dc-resource-page");
  });

  it("keeps the read-only inspector data and container handoff intact", () => {
    for (const value of ['"Copy full image ID"', '"Refresh image details"', '"Close image details"', '"Overview"', '"Repository tags"', '"Repository digests"', '"Containers using image"', "this.openContainer"]) expect(tab).toContain(value);
  });

  it("uses direct image cards with the shared surface and responsive inspector", () => {
    for (const value of ["docker-connector__images-header", "docker-connector__images-toolbar", "docker-connector__images-layout.is-detail-open", "docker-connector__images-list", "docker-connector__image-card", "docker-connector__images-detail"]) expect(css).toContain(value);
    expect(css).toContain(".dc-images-tab .docker-connector__images-layout.is-detail-open");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(320px, .72fr);");
    expect(css).toContain(".dc-images-tab .docker-connector__image-card:hover");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain("background: var(--dc-surface);");
    expect(css).toContain("color-mix(in srgb, var(--dc-accent) 7%, var(--dc-surface-raised))");
    expect(css).toContain('overflow-wrap: anywhere;');
    expect(css).toContain(".dc-images-tab .docker-connector__image-card { grid-template-columns: 20px minmax(0, 1fr); align-items: start; justify-items: stretch; justify-content: start; text-align: left; }");
    expect(css).toContain(".dc-images-tab .docker-connector__image-card-secondary, .dc-images-tab .docker-connector__image-card-id, .dc-images-tab .docker-connector__image-card-metadata { grid-column: 2; justify-self: stretch; width: 100%; text-align: left; }");
    expect(css).toContain(".dc-images-tab .docker-connector__image-card-metadata { justify-items: start; text-align: left; }");
    expect(css).toContain("@container (max-width: 620px) { .dc-images-tab .docker-connector__images-toolbar");
    expect(css).not.toContain("dc-resource-page");
    expect(tab).not.toContain("docker-connector__image-row");
  });
});
