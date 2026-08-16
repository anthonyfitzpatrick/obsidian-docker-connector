import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OVERVIEW_METRIC_ACCENTS } from "../src/overview/OverviewMetricAccents";

const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

describe("Overview metric colors", () => {
  it("assigns each primary Overview metric a stable, distinct semantic accent", () => {
    const accents = Object.values(OVERVIEW_METRIC_ACCENTS);
    expect(accents).toEqual(["hosts", "containers", "running", "stopped", "images", "volumes", "networks"]);
    expect(new Set(accents).size).toBe(7);
    for (const [metric, accent] of Object.entries(OVERVIEW_METRIC_ACCENTS)) {
      expect(view).toContain(`OVERVIEW_METRIC_ACCENTS.${metric}`);
      expect(css).toContain(`.dc-overview-card--${accent}`);
      expect(css).toContain(`--dc-overview-${accent}:`);
    }
  });

  it("scopes the palette to Docker Connector cards without relying on card order", () => {
    expect(view).toContain("dc-overview-card--${accent}");
    expect(css).toContain(".docker-connector__summary-card.dc-overview-card");
    expect(css).toContain(".docker-connector__summary-card.dc-overview-card::before");
    expect(css).not.toMatch(/dc-overview-card[^\n]*nth-child/);
    expect(css).not.toMatch(/(^|\n)body\s*\{[^}]*--dc-overview-/);
  });

  it("keeps responsive layout and theme-derived colors intact", () => {
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain("@media (max-width: 660px)");
    expect(css).toContain("var(--color-blue)");
    expect(css).toContain("var(--color-red)");
    expect(css).toContain("color-mix(in srgb, var(--dc-overview-card-accent)");
  });
});
