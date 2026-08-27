import { setIcon } from "obsidian";
import type DockerConnectorPlugin from "../main";
import { dockerResourceKey, selectedInventorySnapshots } from "../models/DockerHostSnapshotSelection";
import { renderMetricCards } from "../ui/MetricCards";
import { selectNetworks, values } from "./NetworkSelectors";
import { pluralize } from "../ui/pluralize";
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
    const snapshots = selectedInventorySnapshots(this.plugin.settings.profiles, this.plugin.snapshots, host);
    const all = snapshots.flatMap((snapshot) => snapshot.networks);
    const items = selectNetworks(all, this.q, this.filter, this.driver, this.scope);
    root.addClass("dc-networks-tab");

    const header = root.createDiv({ cls: "dc-image-header docker-connector__networks-header" });
    const copy = header.createDiv();
    copy.createEl("h1", { text: "Networks" });
    copy.createSpan({ text: items.length === all.length ? pluralize(all.length, "network") : `${items.length} of ${pluralize(all.length, "network")}`, cls: "dc-image-count", attr: { "aria-live": "polite" } });
    copy.createSpan({ text: host === "all" ? "All Docker hosts" : this.plugin.settings.profiles.find((profile) => profile.id === host)?.name ?? "Selected host", cls: "docker-connector__muted" });
    renderMetricCards(root, [
      { label: "Networks", value: all.length, detail: "Docker network definitions", icon: "network", active: this.filter === "all", onClick: () => { this.filter = "all"; this.rerender(); } },
      { label: "Built-in", value: all.filter((network) => network.builtIn).length, detail: "Docker default networks", icon: "box", active: this.filter === "built-in", onClick: () => { this.filter = "built-in"; this.rerender(); } },
      { label: "User defined", value: all.filter((network) => !network.builtIn).length, detail: "Custom network definitions", icon: "network", tone: "success", active: this.filter === "user-defined", onClick: () => { this.filter = "user-defined"; this.rerender(); } },
      { label: "Unused", value: all.filter((network) => !network.containersAttached).length, detail: "No attached containers", icon: "circle-minus", tone: "muted", active: this.filter === "unused", onClick: () => { this.filter = "unused"; this.rerender(); } }
    ], "Network summary");

    const toolbar = root.createDiv({ cls: "dc-image-toolbar docker-connector__networks-toolbar" });
    const search = toolbar.createDiv({ cls: "dc-container-search" });
    setIcon(search.createSpan(), "search");
    const input = search.createEl("input", { type: "search", value: this.q, placeholder: "Search networks…", attr: { "aria-label": "Search networks" } });
    input.oninput = () => { this.q = input.value; this.rerender(); };
    input.onkeydown = (event) => { if (event.key === "Escape") { this.q = ""; this.rerender(); } };
    this.select(toolbar, "Filter", this.filter, [["all", "All"], ["built-in", "Built-in"], ["user-defined", "User defined"], ["unused", "Unused"], ["internal", "Internal"], ["external", "External"], ["attachable", "Attachable"], ["ipv6", "IPv6 enabled"]], (value) => { this.filter = value as NetworkFilter; this.rerender(); });
    this.select(toolbar, "Driver", this.driver ?? "all", [["all", "All drivers"], ...values(all, "driver").map((value) => [value, value] as [string, string])], (value) => { this.driver = value === "all" ? null : value; this.rerender(); });
    this.select(toolbar, "Scope", this.scope ?? "all", [["all", "All scopes"], ...values(all, "scope").map((value) => [value, value] as [string, string])], (value) => { this.scope = value === "all" ? null : value; this.rerender(); });

    const layout = root.createDiv({ cls: `dc-network-layout docker-connector__networks-layout${this.selected ? " is-detail-open" : ""}` });
    const list = layout.createDiv({ cls: "dc-network-list docker-connector__networks-list", attr: { "aria-label": "Network results" } });
    if (!all.length) list.createDiv({ text: "No networks were returned by this Docker host.", cls: "dc-container-empty" });
    items.forEach((network) => {
      const isSelected = this.selected === this.key(network);
      const card = list.createEl("button", { cls: `docker-connector__network-card${isSelected ? " is-selected" : ""}`, attr: { "aria-label": network.name, "aria-pressed": String(isSelected) } });
      card.onclick = () => { this.selected = this.key(network); this.rerender(); };
      const header = card.createDiv({ cls: "docker-connector__network-card-header" });
      const identity = header.createDiv({ cls: "docker-connector__network-card-identity" });
      const icon = identity.createDiv({ cls: "docker-connector__network-card-icon" }); setIcon(icon, "network");
      identity.createEl("strong", { text: network.name, attr: { title: network.name } });
      header.createSpan({ text: network.builtIn ? "Built-in" : "User defined", cls: "dc-container-badge" });
      card.createSpan({ text: `Subnet · ${network.subnets.slice(0, 2).map((subnet) => subnet.subnet).filter(Boolean).join(", ") || "No subnet"}`, cls: "docker-connector__network-card-secondary docker-connector__muted" });
      const metadata = card.createDiv({ cls: "docker-connector__network-card-metadata" });
      metadata.createSpan({ text: `Driver · ${network.driver}` });
      metadata.createSpan({ text: `Scope · ${network.scope}` });
      metadata.createSpan({ text: `Containers · ${network.containersAttached}` });
    });
    const selected = snapshots.flatMap((snapshot) => snapshot.networks.map((network) => ({ network, snapshot }))).find(({ network, snapshot }) => dockerResourceKey(snapshot, network.id) === this.selected)?.network;
    if (selected) {
      const panel = layout.createEl("aside", { cls: "dc-network-detail-panel docker-connector__networks-detail", attr: { "aria-label": `Details for ${selected.name}` } });
      const header = panel.createDiv({ cls: "dc-image-detail-header" });
      header.createEl("h2", { text: selected.name });
      const close = header.createEl("button", { attr: { "aria-label": "Close network details", title: "Close details" } });
      setIcon(close, "x");
      close.onclick = () => { this.selected = null; this.rerender(); };
      [["Driver", selected.driver], ["Scope", selected.scope], ["Internal", String(selected.internal)], ["Attachable", String(selected.attachable)], ["IPv6", String(selected.enableIPv6)], ["Gateways", selected.gateways.join(", ")]].forEach(([label, value]) => { const row = panel.createDiv({ cls: "dc-container-detail-row" }); row.createSpan({ text: label }); row.createSpan({ text: value }); });
      panel.createEl("h3", { text: "Attached containers" });
      selected.containers.forEach((container) => { const button = panel.createEl("button", { text: `${container.name} · ${container.ipv4 ?? "No IPv4"}` }); button.onclick = () => this.openContainer(container.id); });
    }
  }

  private select(root: HTMLElement, label: string, value: string, options: Array<[string, string]>, onchange: (value: string) => void): void {
    const control = root.createEl("label", { cls: "dc-container-select" }); control.createSpan({ text: label }); const select = control.createEl("select", { attr: { "aria-label": `${label} network filter` } }); options.forEach(([optionValue, text]) => select.createEl("option", { value: optionValue, text })); select.value = value; select.onchange = () => onchange(select.value);
  }
  private key(network: { id: string; hostProfileId: string }): string { const snapshot = this.plugin.snapshots.get(network.hostProfileId); return snapshot ? dockerResourceKey(snapshot, network.id) : `profile:${network.hostProfileId}\u0000${network.id}`; }
}
