import { Notice, setIcon } from "obsidian";
import type DockerConnectorPlugin from "../main";
import type { DockerConnectionProfile, DockerHostSnapshot } from "../models/DockerConnectionProfile";
import { renderMetricCards } from "../ui/MetricCards";
import { DEFAULT_VOLUMES_STATE, type DockerVolumeSummary, type VolumeFilter, type VolumesViewState } from "./VolumeModels";
import { selectVolumes, values } from "./VolumeSelectors";

/** Interactive read-only volume inventory. Documentation: [[Docker Connector - Volumes View]]. */
export class VolumesTab {
  readonly state: VolumesViewState = { ...DEFAULT_VOLUMES_STATE, detail: { status: "closed" } };
  private timer?: number;

  constructor(private readonly plugin: DockerConnectorPlugin, private readonly rerender: () => void, private readonly openContainer: (id: string) => void) {}
  dispose(): void { if (this.timer) window.clearTimeout(this.timer); }
  route(filter?: VolumeFilter): void { if (filter) this.state.filter = filter; }

  render(root: HTMLElement, selectedHostId: string): void {
    const profiles = selectedHostId === "all" ? this.plugin.settings.profiles : this.plugin.settings.profiles.filter((profile) => profile.id === selectedHostId);
    const snapshots = profiles.map((profile) => this.plugin.snapshots.get(profile.id)).filter((snapshot): snapshot is DockerHostSnapshot => Boolean(snapshot));
    const all = snapshots.flatMap((snapshot) => snapshot.volumes);
    const results = selectVolumes(all, this.state);
    root.addClass("dc-volumes-tab");
    const header = root.createDiv({ cls: "dc-image-header docker-connector__volumes-header" });
    const copy = header.createDiv(); copy.createEl("h1", { text: "Volumes" });
    copy.createSpan({ text: results.length === all.length ? `${all.length} volumes` : `${results.length} of ${all.length} volumes`, cls: "dc-image-count" });
    copy.createSpan({ text: selectedHostId === "all" ? "All Docker hosts" : profiles[0]?.name ?? "Selected host", cls: "docker-connector__muted" });
    renderMetricCards(root, [
      { label: "Volumes", value: all.length, detail: "Persistent data stores", icon: "database", active: this.state.filter === "all", onClick: () => { this.state.filter = "all"; this.rerender(); } },
      { label: "In use", value: all.filter((volume) => volume.inUse).length, detail: "Mounted by containers", icon: "circle-check", tone: "success", active: this.state.filter === "in-use", onClick: () => { this.state.filter = "in-use"; this.rerender(); } },
      { label: "No visible references", value: all.filter((volume) => !volume.inUse).length, detail: "No current mounts", icon: "circle-minus", tone: "muted", active: this.state.filter === "unused", onClick: () => { this.state.filter = "unused"; this.rerender(); } },
      { label: "Drivers", value: new Set(all.map((volume) => volume.driver)).size, detail: "Storage backends detected", icon: "hard-drive", tone: "accent" }
    ], "Volume summary");
    this.controls(root, all);
    const layout = root.createDiv({ cls: `dc-volume-layout docker-connector__volumes-layout${this.state.selected ? " is-detail-open" : ""}` });
    const list = layout.createDiv({ cls: "dc-volume-list docker-connector__volumes-list", attr: { "aria-label": "Volume results" } });
    if (!all.length) list.createDiv({ text: "No volumes were returned by this Docker host.", cls: "dc-container-empty" });
    else if (!results.length) list.createDiv({ text: "No volumes match the current filters.", cls: "dc-container-empty" });
    results.forEach((volume) => this.row(list, volume));
    if (this.state.selected) this.detail(layout, profiles, snapshots);
  }

  private controls(root: HTMLElement, all: DockerVolumeSummary[]): void {
    const toolbar = root.createDiv({ cls: "dc-image-toolbar docker-connector__volumes-toolbar" });
    const search = toolbar.createDiv({ cls: "dc-container-search" }); setIcon(search.createSpan(), "search");
    const input = search.createEl("input", { type: "search", value: this.state.search, placeholder: "Search volumes…", attr: { "aria-label": "Search volumes" } });
    input.oninput = () => { if (this.timer) window.clearTimeout(this.timer); this.timer = window.setTimeout(() => { this.state.search = input.value; this.rerender(); }, 180); };
    input.onkeydown = (event) => { if (event.key === "Escape") { this.state.search = ""; this.rerender(); } };
    this.select(toolbar, "Filter", this.state.filter, [["all", "All"], ["in-use", "In use"], ["unused", "No visible references"]], (value) => { this.state.filter = value as VolumeFilter; this.rerender(); });
    this.select(toolbar, "Driver", this.state.driver ?? "all", [["all", "All drivers"], ...values(all, "driver").map((value) => [value, value] as [string, string])], (value) => { this.state.driver = value === "all" ? null : value; this.rerender(); });
    this.select(toolbar, "Scope", this.state.scope ?? "all", [["all", "All scopes"], ...values(all, "scope").map((value) => [value, value] as [string, string])], (value) => { this.state.scope = value === "all" ? null : value; this.rerender(); });
    this.select(toolbar, "Sort", this.state.sort, [["name", "Name"], ["driver", "Driver"], ["created-newest", "Created newest"], ["created-oldest", "Created oldest"], ["usage-count", "Usage count"]], (value) => { this.state.sort = value as VolumesViewState["sort"]; this.rerender(); });
  }

  private row(list: HTMLElement, volume: DockerVolumeSummary): void {
    const selected = this.state.selected === volume.name;
    const card = list.createEl("button", { cls: `docker-connector__volume-card${selected ? " is-selected" : ""}`, attr: { "aria-label": volume.name, "aria-pressed": String(selected) } });
    card.onclick = () => void this.open(volume, card);
    const header = card.createDiv({ cls: "docker-connector__volume-card-header" });
    const identity = header.createDiv({ cls: "docker-connector__volume-card-identity" });
    const icon = identity.createDiv({ cls: "docker-connector__volume-card-icon" }); setIcon(icon, "database");
    identity.createEl("strong", { text: volume.name, attr: { title: volume.name } });
    header.appendChild(badge(volume.inUse ? "In Use" : "Unused", volume.inUse ? "in-use" : "unused"));
    card.createSpan({ text: `Mount · ${truncate(volume.mountpoint)}`, cls: "docker-connector__volume-card-secondary docker-connector__muted", attr: { title: volume.mountpoint ?? "No mountpoint" } });
    const metadata = card.createDiv({ cls: "docker-connector__volume-card-metadata" });
    metadata.createSpan({ text: `Driver · ${volume.driver}` });
    metadata.createSpan({ text: `Scope · ${volume.scope}` });
    metadata.createSpan({ text: `${volume.containersUsingVolume} containers` });
  }

  private detail(root: HTMLElement, profiles: DockerConnectionProfile[], snapshots: DockerHostSnapshot[]): void {
    const volume = snapshots.flatMap((snapshot) => snapshot.volumes).find((item) => item.name === this.state.selected);
    const profile = volume && profiles.find((item) => item.id === volume.hostProfileId);
    const snapshot = volume && snapshots.find((item) => item.hostId === volume.hostProfileId);
    if (!volume || !profile || !snapshot) return;
    const panel = root.createEl("aside", { cls: "dc-volume-detail-panel docker-connector__volumes-detail", attr: { "aria-label": `Details for ${volume.name}` } });
    const header = panel.createDiv({ cls: "dc-image-detail-header" }); header.createEl("h2", { text: volume.name });
    const close = header.createEl("button", { attr: { "aria-label": "Close volume details" } }); setIcon(close, "x"); close.onclick = () => { this.state.selected = null; this.state.detail = { status: "closed" }; this.rerender(); };
    if (this.state.detail.status === "loading") { panel.createDiv({ text: "Loading volume details…", cls: "dc-container-loading" }); return; }
    if (this.state.detail.status !== "ready") return;
    const details = this.state.detail.value;
    section(panel, "Overview", [["Driver", details.driver], ["Scope", details.scope], ["Mountpoint", details.mountpoint], ["Created", details.createdAt]]);
    section(panel, "Options", Object.entries(details.options)); section(panel, "Labels", Object.entries(details.labels));
    const references = panel.createEl("section", { cls: "dc-image-detail-section" }); references.createEl("h3", { text: "Containers using volume" });
    details.containersUsingVolume.length ? details.containersUsingVolume.forEach((container) => { const button = references.createEl("button", { text: `${container.name} · ${container.state ?? "Unknown"}` }); button.onclick = () => this.openContainer(container.id); }) : references.createDiv({ text: "No visible container references.", cls: "docker-connector__muted" });
  }

  private async open(volume: DockerVolumeSummary, _origin: HTMLElement): Promise<void> { this.state.selected = volume.name; const profile = this.plugin.settings.profiles.find((item) => item.id === volume.hostProfileId); const snapshot = this.plugin.snapshots.get(volume.hostProfileId); if (!profile || !snapshot) return; this.state.detail = { status: "loading", name: volume.name }; this.rerender(); try { this.state.detail = { status: "ready", name: volume.name, value: await this.plugin.inspectVolume(profile, snapshot, volume.name) }; } catch (error) { this.state.detail = { status: "error", name: volume.name, message: error instanceof Error ? error.message : "Volume details could not be loaded." }; } this.rerender(); }
  private select(root: HTMLElement, label: string, value: string, options: Array<[string, string]>, change: (value: string) => void): void { const control = root.createEl("label", { cls: "dc-container-select" }); control.createSpan({ text: label }); const select = control.createEl("select", { attr: { "aria-label": `${label} volume control` } }); options.forEach(([optionValue, text]) => select.createEl("option", { value: optionValue, text })); select.value = value; select.onchange = () => change(select.value); }
}

function badge(text: string, kind: string): HTMLElement { const element = document.createElement("span"); element.addClass("dc-container-badge", `is-${kind}`); element.setText(text); return element; }
function truncate(value?: string): string { if (!value) return "No mountpoint"; return value.length > 36 ? `…${value.slice(-35)}` : value; }
function section(root: HTMLElement, title: string, rows: Array<[string, string | undefined]>): void { const section = root.createEl("section", { cls: "dc-image-detail-section" }); section.createEl("h3", { text: title }); rows.filter(([, value]) => Boolean(value)).forEach(([label, value]) => { const row = section.createDiv({ cls: "dc-container-detail-row" }); row.createSpan({ text: label }); row.createSpan({ text: value! }); }); }
