import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tab = readFileSync(resolve(process.cwd(), "src/networks/NetworksTab.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");
const rule = (selector: string) => [...css.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g"))].at(-1)?.[1] ?? "";

describe("Networks resource layout", () => {
  it("renders attached containers as one clickable list rather than pill buttons", () => {
    expect(tab).toContain('cls: "dc-network-attachments"');
    expect(tab).toContain('cls: "dc-network-attachment-name"');
    expect(tab).toContain('cls: "dc-network-attachment-address"');
    const button = rule(".dc-network-attachments button");
    expect(button).toContain("background: transparent");
    expect(button).toContain("width: 100%");
    expect(button).toContain("border-radius: 0");
    expect(rule(".dc-network-attachments button:hover")).toContain("background: var(--background-modifier-hover)");
  });

  it("states when a network has no attached containers, as Images and Volumes do", () => {
    expect(tab).toContain("No attached containers.");
    expect(tab).toContain("selected.containers.length ?");
  });

  it("retains dynamic counts, host scope, and four operational summary cards", () => {
    for (const value of ["items.length === all.length", '${items.length} of ${pluralize(all.length, "network")}', 'host === "all" ? "All Docker hosts"', 'label: "Networks"', 'label: "Built-in"', 'label: "User defined"', 'label: "Unused"']) expect(tab).toContain(value);
  });

  it("retains searchable labelled filters, including all existing network filters", () => {
    for (const value of ['"Search networks…"', '"Filter"', '"Driver"', '"Scope"', '"built-in"', '"user-defined"', '"internal"', '"external"', '"attachable"', '"ipv6"']) expect(tab).toContain(value);
  });

  it("keeps compact card metadata, selection, and network relationships", () => {
    for (const value of ["docker-connector__network-card${", "docker-connector__network-card-header", "docker-connector__network-card-secondary", "docker-connector__network-card-metadata", "Subnet · ${network.subnets", "containers", '"Built-in"', '"User defined"', '"Driver"', '"Scope"', '"Internal"', '"Attachable"', '"IPv6"', '"Gateways"', '"Attached containers"', '"Close network details"', "this.openContainer"]) expect(tab).toContain(value);
    expect(tab).not.toContain("dc-resource-page");
  });

  it("uses direct network cards with responsive inspector and long-name safety", () => {
    for (const value of ["docker-connector__networks-header", "docker-connector__networks-toolbar", "docker-connector__networks-layout.is-detail-open", "docker-connector__networks-list", "docker-connector__network-card", "docker-connector__networks-detail"]) expect(css).toContain(value);
    expect(css).toContain(".dc-networks-tab .docker-connector__network-card:hover");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(320px, .72fr);");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain("background: var(--dc-surface);");
    expect(css).toContain("color-mix(in srgb, var(--dc-accent) 7%, var(--dc-surface-raised))");
    expect(css).toContain(".dc-networks-tab .docker-connector__networks-detail .dc-container-detail-row span");
    expect(css).toContain("@container (max-width: 620px) { .dc-images-tab .docker-connector__images-toolbar");
    expect(css).not.toContain("dc-resource-page");
    expect(tab).not.toContain("docker-connector__network-row");
  });

  it("anchors every network text line to a fixed icon and flexible text track", () => {
    const card = rule(".dc-networks-tab .docker-connector__network-card");
    const header = rule(".dc-networks-tab .docker-connector__network-card-header");
    const title = rule(".dc-networks-tab .docker-connector__network-card-header > strong");
    const metadata = rule(".dc-networks-tab .docker-connector__network-card-metadata");
    const secondary = rule(".dc-networks-tab .docker-connector__network-card-secondary, .dc-networks-tab .docker-connector__network-card-metadata");

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
    expect(rule(".dc-networks-tab .docker-connector__network-card-header > .dc-container-badge")).toContain("grid-column: 3");
    for (const declaration of ["text-align: center", "justify-content: center", "justify-items: center", "place-items: center"]) expect(`${card}${header}${title}${metadata}${secondary}`).not.toContain(declaration);
  });
});
