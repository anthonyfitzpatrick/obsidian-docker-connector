import { setIcon } from "obsidian";

export interface MetricCard {
  label: string;
  value: number | string;
  detail: string;
  icon: string;
  tone?: "accent" | "success" | "warning" | "muted";
  active?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}

/** Shared icon-and-value summary cards used by the dashboard inventory tabs. */
export function renderMetricCards(root: HTMLElement, metrics: MetricCard[], label: string): void {
  const resourcePage = ["Application summary", "Container summary", "Image summary", "Volume summary", "Network summary"].includes(label);
  const grid = root.createDiv({ cls: `docker-connector__summary-grid${resourcePage ? " dc-resource-summary" : ""}`, attr: { "aria-label": label } });
  metrics.forEach((metric) => {
    const classes = `docker-connector__summary-card${resourcePage ? " dc-resource-summary-card" : ""} is-${metric.tone ?? "accent"}${metric.active ? " is-active" : ""}`;
    const card = metric.onClick
      ? grid.createEl("button", { cls: classes, attr: { "aria-pressed": String(Boolean(metric.active)), ...(metric.ariaLabel ? { "aria-label": metric.ariaLabel } : {}) } })
      : grid.createDiv({ cls: classes });
    if (metric.onClick && card instanceof HTMLButtonElement) card.onclick = metric.onClick;
    const icon = card.createDiv({ cls: "docker-connector__summary-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, metric.icon);
    const copy = card.createDiv();
    copy.createSpan({ text: metric.label });
    copy.createEl("strong", { text: String(metric.value) });
    copy.createEl("small", { text: metric.detail });
  });
}
