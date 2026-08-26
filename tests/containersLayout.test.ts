import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tab = readFileSync(resolve(process.cwd(), "src/containers/ContainersTab.ts"), "utf8");
const applications = readFileSync(resolve(process.cwd(), "src/applications/ApplicationsTab.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

function declaration(selector: string): string {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`));
  expect(match, `missing ${selector} rule`).not.toBeNull();
  return match![1];
}

describe("Containers card layout", () => {
  it("retains the four operational summary cards and all existing controls", () => {
    for (const value of ['label: "Containers"', 'label: "Running"', 'label: "Stopped"', 'label: "Updates Available"', '"Search containers…"', '"State"', '"Health"', '"Network"', '"Sort"', '"Comfortable"', '"Compact"', '"Refresh selected Docker host"']) expect(tab).toContain(value);
  });

  it("uses an Applications-style card grid with separate normal-flow container content", () => {
    for (const value of ["docker-connector__containers-header", "docker-connector__containers-toolbar", "docker-connector__containers-layout", "docker-connector__containers-list", "docker-connector__container-card", "docker-connector__containers-detail"]) expect(tab).toContain(value);
    for (const value of ["docker-connector__container-card-header", "docker-connector__container-card-identity", "dc-container-state-dot", "docker-connector__container-card-name", "docker-connector__container-card-badges", "docker-connector__container-card-secondary", "docker-connector__container-card-id", "docker-connector__container-card-metadata", "docker-connector__container-card-status", "docker-connector__container-card-ports", "docker-connector__container-card-created"]) expect(tab).toContain(value);
    expect(tab).not.toContain("docker-connector__containers-row");
    expect(css).toMatch(/containers-list \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/containers-layout\.is-detail-open .*containers-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@container \(max-width: 980px\).*containers-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
    expect(css).toMatch(/@container \(max-width: 520px\).*containers-list \{ grid-template-columns: 1fr/s);
    expect(css).toMatch(/container-card \{[^}]*height: auto;[^}]*min-height: 0;[^}]*overflow: visible;/);
    const card = declaration(".dc-containers-tab .docker-connector__container-card");
    const header = declaration(".dc-containers-tab .docker-connector__container-card-header");
    const secondary = declaration(".dc-containers-tab .docker-connector__container-card-secondary");
    const metadata = declaration(".dc-containers-tab .docker-connector__container-card-metadata");
    expect(card).toContain("grid-template-columns: 20px minmax(0, 1fr)");
    expect(card).toContain("text-align: left");
    expect(card).toContain("justify-content: start");
    expect(card).toContain("justify-items: stretch");
    expect(header).toContain("grid-template-columns: 20px minmax(0, 1fr) auto");
    expect(header).toContain("text-align: left");
    expect(secondary).toContain("grid-column: 2");
    expect(secondary).toContain("text-align: left");
    expect(metadata).toContain("grid-column: 2");
    expect(metadata).toContain("text-align: left");
    for (const rule of [card, header, secondary, metadata]) {
      expect(rule).not.toMatch(/text-align:\s*center|justify-content:\s*center|justify-items:\s*center|place-items:\s*center/);
    }
    expect(css).toMatch(/is-compact .*container-card-metadata \{ display: none; \}/);
    expect(css).toContain(".dc-containers-tab .docker-connector__container-card, .dc-images-tab .docker-connector__image-card");
    expect(css).toContain("border: 1px solid var(--dc-border); background: var(--dc-surface); color: var(--text-normal);");
    expect(css).toContain(".dc-containers-tab .docker-connector__container-card:hover, .dc-containers-tab .docker-connector__container-card.is-selected");
    expect(css).toContain("border-color: var(--dc-accent); background: color-mix(in srgb, var(--dc-accent) 7%, var(--dc-surface-raised)); box-shadow: 0 4px 10px rgb(0 0 0 / .06);");
    expect(css).not.toMatch(/\.dc-containers-tab \.docker-connector__container-card[^}]*\{[^}]*(?:background(?:-color)?\s*:\s*(?:white|transparent|#fff|var\(--background-primary\)))/);
    expect(tab).not.toContain("dc-resource-page");
    expect(applications).toContain('cls: "docker-connector__application-card-header"');
    expect(applications).toContain('cls: "docker-connector__application-summary"');
  });

  it("keeps container inspection, copying, and authorized management safeguards intact", () => {
    for (const value of ["navigator.clipboard.writeText(container.id)", 'role: "button"', 'tabindex: "0"', "Refresh container details", "getContainerActionCapabilities", "isProfileManagementEnabled", "getContainerUpdateEligibility", "Container management enabled"]) expect(tab).toContain(value);
  });
});
