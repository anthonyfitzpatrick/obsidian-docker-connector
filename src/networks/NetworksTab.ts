import { setIcon } from "obsidian";
import type DockerConnectorPlugin from "../main";
import { renderMetricCards } from "../ui/MetricCards";
import { selectNetworks, values } from "./NetworkSelectors";
import type { NetworkFilter } from "./NetworkModels";

/** Read-only Networks tab backed by the current `/networks` snapshot. */
export class NetworksTab {
  private q = "";
  private filter: NetworkFilter = "all";
  private driver: string | null = null;
  private scope: string | null = null;
  private selected: string | null = null;

  constructor(private readonly plugin: DockerConnectorPlugin, private readonly rerender: () => void, private readonly openContainer: (id: string) => void) {}

  render(root: HTMLElement, host: string): void {
    const snapshots = (host === "all" ? [...this.plugin.snapshots.values()] : [this.plugin.snapshots.get(host)]).filter(Boolean);
    const all = snapshots.flatMap((snapshot) => snapshot!.networks);
    const items = selectNetworks(all, this.q, this.filter, this.driver, this.scope);
    root.addClass("dc-networks-tab");

    const header = root.createDiv({ cls: "dc-image-header" });
    header.createEl("h1", { text: "Networks" });
    renderMetricCards(root, [
      { label: "Networks", value: all.length, detail: "Docker network definitions", icon: "network", active: this.filter === "all", onClick: () => { this.filter = "all"; this.rerender(); } },
      { label: "Built-in", value: all.filter((network) => network.builtIn).length, detail: "Docker default networks", icon: "box", active: this.filter === "built-in", onClick: () => { this.filter = "built-in"; this.rerender(); } },
      { label: "User defined", value: all.filter((network) => !network.builtIn).length, detail: "Custom network definitions", icon: "network", tone: "success", active: this.filter === "user-defined", onClick: () => { this.filter = "user-defined"; this.rerender(); } },
      { label: "Unused", value: all.filter((network) => !network.containersAttached).length, detail: "No attached containers", icon: "circle-minus", tone: "muted", active: this.filter === "unused", onClick: () => { this.filter = "unused"; this.rerender(); } }
    ], "Network summary");

    const toolbar = root.createDiv({ cls: "dc-image-toolbar" });
    const search = toolbar.createDiv({ cls: "dc-container-search" });
    setIcon(search.createSpan(), "search");
    const input = search.createEl("input", { type: "search", value: this.q, placeholder: "Search networks…", attr: { "aria-label": "Search networks" } });
    input.oninput = () => { this.q = input.value; this.rerender(); };
    input.onkeydown = (event) => { if (event.key === "Escape") { this.q = ""; this.rerender(); } };
    this.select(toolbar, "Filter", this.filter, [["all", "All"], ["built-in", "Built-in"], ["user-defined", "User defined"], ["unused", "Unused"], ["internal", "Internal"], ["external", "External"], ["attachable", "Attachable"], ["ipv6", "IPv6 enabled"]], (value) => { this.filter = value as NetworkFilter; this.rerender(); });
    this.select(toolbar, "Driver", this.driver ?? "all", [["all", "All drivers"], ...values(all, "driver").map((value) => [value, value] as [string, string])], (value) => { this.driver = value === "all" ? null : value; this.rerender(); });
    this.select(toolbar, "Scope", this.scope ?? "all", [["all", "All scopes"], ...values(all, "scope").map((value) => [value, value] as [string, string])], (value) => { this.scope = value === "all" ? null : value; this.rerender(); });

    const layout = root.createDiv({ cls: "dc-network-layout" });
    const list = layout.createDiv({ cls: "dc-network-list" });
    if (!all.length) list.createDiv({ text: "No networks were returned by this Docker host.", cls: "dc-container-empty" });
    items.forEach((network) => {
      const row = list.createEl("button", { cls: `dc-network-row${this.selected === network.id ? " is-selected" : ""}` });
      row.onclick = () => { this.selected = network.id; this.rerender(); };
      const icon = row.createDiv({ cls: "dc-resource-icon is-network" }); setIcon(icon, "network");
      const copy = row.createDiv(); copy.createEl("strong", { text: network.name }); copy.createSpan({ text: `Subnet · ${network.subnets.slice(0, 2).map((subnet) => subnet.subnet).filter(Boolean).join(", ") || "No subnet"}`, cls: "docker-connector__muted" });
      row.createSpan({ text: network.driver }); row.createSpan({ text: network.scope }); row.createSpan({ text: `${network.containersAttached} containers` }); row.createSpan({ text: network.builtIn ? "Built-in" : "User defined", cls: "dc-container-badge" }); setIcon(row.createSpan(), "panel-right-open");
    });
    const selected = all.find((network) => network.id === this.selected);
    if (selected) {
      const panel = layout.createEl("aside", { cls: "dc-network-detail-panel", attr: { "aria-label": `Details for ${selected.name}` } });
      panel.createEl("h2", { text: selected.name });
      [["Driver", selected.driver], ["Scope", selected.scope], ["Internal", String(selected.internal)], ["Attachable", String(selected.attachable)], ["IPv6", String(selected.enableIPv6)], ["Gateways", selected.gateways.join(", ")]].forEach(([label, value]) => { const row = panel.createDiv({ cls: "dc-container-detail-row" }); row.createSpan({ text: label }); row.createSpan({ text: value }); });
      panel.createEl("h3", { text: "Attached containers" });
      selected.containers.forEach((container) => { const button = panel.createEl("button", { text: `${container.name} · ${container.ipv4 ?? "No IPv4"}` }); button.onclick = () => this.openContainer(container.id); });
    }
  }

  private select(root: HTMLElement, label: string, value: string, options: Array<[string, string]>, onchange: (value: string) => void): void {
    const control = root.createEl("label", { cls: "dc-container-select" }); control.createSpan({ text: label }); const select = control.createEl("select", { attr: { "aria-label": `${label} network filter` } }); options.forEach(([optionValue, text]) => select.createEl("option", { value: optionValue, text })); select.value = value; select.onchange = () => onchange(select.value);
  }
}
