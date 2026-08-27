import { Notice, setIcon } from "obsidian";
import type DockerConnectorPlugin from "../main";
import type { DockerConnectionProfile, DockerHostSnapshot } from "../models/DockerConnectionProfile";
import { dockerResourceKey, selectedInventorySnapshots } from "../models/DockerHostSnapshotSelection";
import { renderMetricCards } from "../ui/MetricCards";
import { DEFAULT_IMAGES_VIEW_STATE, type DockerImageSummary, type ImageFilter, type ImageSort, type ImagesViewState } from "./ImageModels";
import { selectImages, values } from "./ImageSelectors";
import { pluralize } from "../ui/pluralize";
import { multiHostResourceLabel } from "../ui/HostResourceLabel";

/** Interactive read-only image inventory. Documentation: [[Docker Connector - Images View]]. */
export class ImagesTab {
  readonly state: ImagesViewState = { ...DEFAULT_IMAGES_VIEW_STATE, detail: { status: "closed" } };
  private timer?: number;
  private origin?: HTMLElement;

  constructor(private readonly plugin: DockerConnectorPlugin, private readonly rerender: () => void, private readonly openContainer: (id: string) => void) {}
  dispose(): void { if (this.timer) window.clearTimeout(this.timer); }
  route(filter?: ImageFilter): void { if (filter) this.state.filter = filter; }

  render(root: HTMLElement, selectedHostId: string): void {
    const profiles = selectedHostId === "all" ? this.plugin.settings.profiles : this.plugin.settings.profiles.filter((profile) => profile.id === selectedHostId);
    const snapshots = selectedInventorySnapshots(this.plugin.settings.profiles, this.plugin.snapshots, selectedHostId);
    const all = snapshots.flatMap((snapshot) => snapshot.images);
    const results = selectImages(all, this.state);
    root.addClass("dc-images-tab");
    this.header(root, all, results, profiles, selectedHostId);
    this.controls(root, all);
    this.list(root, results, profiles, snapshots, all);
  }

  private header(root: HTMLElement, all: DockerImageSummary[], results: DockerImageSummary[], profiles: DockerConnectionProfile[], selectedHostId: string): void {
    const header = root.createDiv({ cls: "dc-image-header docker-connector__images-header" });
    const copy = header.createDiv();
    copy.createEl("h1", { text: "Images" });
    copy.createSpan({ text: results.length === all.length ? pluralize(all.length, "image") : `${results.length} of ${pluralize(all.length, "image")}`, cls: "dc-image-count", attr: { "aria-live": "polite" } });
    copy.createSpan({ text: selectedHostId === "all" ? "All Docker hosts" : profiles[0]?.name ?? "Selected host", cls: "docker-connector__muted" });
    renderMetricCards(root, [
      { label: "Images", value: all.length, detail: "Available image library", icon: "layers-3", active: this.state.filter === "all", onClick: () => { this.state.filter = "all"; this.rerender(); } },
      { label: "In use", value: all.filter((image) => image.containersUsingImage > 0).length, detail: "Referenced by containers", icon: "circle-check", tone: "success", active: this.state.filter === "in-use", onClick: () => { this.state.filter = "in-use"; this.rerender(); } },
      { label: "Dangling", value: all.filter((image) => image.dangling).length, detail: "Untagged Docker images", icon: "tag", tone: "warning", active: this.state.filter === "dangling", onClick: () => { this.state.filter = "dangling"; this.rerender(); } },
      { label: "No visible references", value: all.filter((image) => image.containersUsingImage === 0).length, detail: "No visible container use", icon: "circle-minus", tone: "muted", active: this.state.filter === "unused", onClick: () => { this.state.filter = "unused"; this.rerender(); } }
    ], "Image summary");
  }

  private controls(root: HTMLElement, all: DockerImageSummary[]): void {
    const toolbar = root.createDiv({ cls: "dc-image-toolbar docker-connector__images-toolbar" });
    const search = toolbar.createDiv({ cls: "dc-container-search" });
    setIcon(search.createSpan(), "search");
    const input = search.createEl("input", { type: "search", value: this.state.search, placeholder: "Search images…", attr: { "aria-label": "Search images" } });
    input.oninput = () => { if (this.timer) window.clearTimeout(this.timer); this.timer = window.setTimeout(() => { this.state.search = input.value; this.rerender(); }, 180); };
    input.onkeydown = (event) => { if (event.key === "Escape") { this.state.search = ""; this.rerender(); } };
    this.select(toolbar, "Filter", this.state.filter, [["all", "All"], ["in-use", "In use"], ["unused", "No visible references"], ["dangling", "Dangling"], ["tagged", "Tagged"], ["untagged", "Untagged"]], (value) => { this.state.filter = value as ImageFilter; this.rerender(); });
    this.select(toolbar, "Architecture", this.state.architecture ?? "all", [["all", "All architectures"], ...values(all, "architecture").map((value) => [value, value] as [string, string])], (value) => { this.state.architecture = value === "all" ? null : value; this.rerender(); });
    this.select(toolbar, "OS", this.state.operatingSystem ?? "all", [["all", "All operating systems"], ...values(all, "operatingSystem").map((value) => [value, value] as [string, string])], (value) => { this.state.operatingSystem = value === "all" ? null : value; this.rerender(); });
    this.select(toolbar, "Sort", this.state.sort, [["repository", "Repository"], ["tag", "Tag"], ["created-newest", "Created newest"], ["created-oldest", "Created oldest"], ["size-largest", "Size largest"], ["size-smallest", "Size smallest"], ["usage-count", "Usage count"]], (value) => { this.state.sort = value as ImageSort; this.rerender(); });
  }

  private list(root: HTMLElement, results: DockerImageSummary[], profiles: DockerConnectionProfile[], snapshots: DockerHostSnapshot[], all: DockerImageSummary[]): void {
    const layout = root.createDiv({ cls: `dc-image-layout docker-connector__images-layout${this.state.selectedImageId ? " is-detail-open" : ""}` });
    const list = layout.createDiv({ cls: "dc-image-list docker-connector__images-list", attr: { "aria-label": "Image results" } });
    if (!all.length) { list.createDiv({ text: "No images were returned by this Docker host.", cls: "dc-container-empty" }); return; }
    if (!results.length) { list.createDiv({ text: this.state.search ? "No images match your search." : "No images match the current filters.", cls: "dc-container-empty" }); return; }
    results.forEach((image) => this.row(list, image, multiHostResourceLabel(snapshots, this.plugin.settings.profiles, image.hostProfileId)));
    if (this.state.selectedImageId) this.detail(layout, profiles, snapshots);
  }

  private row(list: HTMLElement, image: DockerImageSummary, host?: string): void {
    const selected = this.state.selectedImageId === this.key(image);
    const card = list.createEl("button", { cls: `docker-connector__image-card${selected ? " is-selected" : ""}`, attr: { "aria-label": `${image.repository}:${image.tag}`, "aria-pressed": String(selected) } });
    card.onclick = () => void this.open(image, card);
    const header = card.createDiv({ cls: "docker-connector__image-card-header" });
    const identity = header.createDiv({ cls: "docker-connector__image-card-identity" });
    const icon = identity.createDiv({ cls: "docker-connector__image-card-icon" }); setIcon(icon, "layers-3");
    identity.createEl("strong", { text: image.repository, attr: { title: image.repository } });
    header.appendChild(badge(image.dangling ? "Dangling" : image.containersUsingImage > 0 ? "In use" : "Unused", image.dangling ? "dangling" : image.containersUsingImage > 0 ? "in-use" : "unused"));
    card.createSpan({ text: `Tag · ${image.tag}`, cls: "docker-connector__image-card-secondary docker-connector__muted", attr: { title: image.tag } });
    const id = card.createSpan({ text: image.shortId, cls: "docker-connector__image-card-id dc-container-id", attr: { role: "button", tabindex: "0", "aria-label": "Copy full image ID" } });
    const copyId = (event: Event) => { event.stopPropagation(); void navigator.clipboard.writeText(image.id); new Notice("Image ID copied"); };
    id.onclick = copyId;
    id.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); copyId(event); } };
    const metadata = card.createDiv({ cls: "docker-connector__image-card-metadata" });
    metadata.createSpan({ text: `Size · ${bytes(image.sizeBytes)}` });
    metadata.createSpan({ text: image.containersUsingImage < 0 ? "Usage unknown" : `${image.containersUsingImage} in use` });
    if (host) metadata.createSpan({ text: host });
  }

  private detail(root: HTMLElement, profiles: DockerConnectionProfile[], snapshots: DockerHostSnapshot[]): void {
    const image = snapshots.flatMap((snapshot) => snapshot.images.map((item) => ({ item, snapshot }))).find(({ item, snapshot }) => dockerResourceKey(snapshot, item.id) === this.state.selectedImageId);
    const profile = image && profiles.find((item) => item.id === image.item.hostProfileId);
    if (!image || !profile) return;
    const summary = image.item;
    const snapshot = image.snapshot;
    const panel = root.createEl("aside", { cls: "dc-image-detail-panel docker-connector__images-detail", attr: { "aria-label": `Details for ${summary.repository}:${summary.tag}`, tabindex: "-1" } });
    const header = panel.createDiv({ cls: "dc-image-detail-header" }); header.createEl("h2", { text: `${summary.repository}:${summary.tag}` });
    const copy = header.createEl("button", { attr: { "aria-label": "Copy full image ID" } }); setIcon(copy, "copy"); copy.onclick = () => { void navigator.clipboard.writeText(summary.id); new Notice("Image ID copied"); };
    const refresh = header.createEl("button", { attr: { "aria-label": "Refresh image details" } }); setIcon(refresh, "refresh-cw"); refresh.onclick = () => void this.load(profile, snapshot, summary, true);
    const close = header.createEl("button", { attr: { "aria-label": "Close image details" } }); setIcon(close, "x"); close.onclick = () => this.close();
    if (this.state.detail.status === "loading") { panel.createDiv({ text: "Loading read-only image details…", cls: "dc-container-loading", attr: { "aria-live": "polite" } }); return; }
    if (this.state.detail.status === "error") { panel.createDiv({ text: this.state.detail.message, cls: "dc-container-error" }); return; }
    if (this.state.detail.status !== "ready") return;
    const details = this.state.detail.value;
    section(panel, "Overview", [["Full ID", details.id], ["Created", details.createdAt], ["Size", bytes(details.sizeBytes)], ["Architecture", details.architecture], ["Operating system", details.operatingSystem], ["Docker version", details.dockerVersion], ["Author", details.author], ["Comment", details.comment]]);
    section(panel, "Repository tags", details.repositoryTags.map((tag) => ["Tag", tag]));
    section(panel, "Repository digests", details.repositoryDigests.map((digest) => ["Digest", digest]));
    section(panel, "Labels", Object.entries(details.labels));
    const used = panel.createEl("section", { cls: "dc-image-detail-section" }); used.createEl("h3", { text: "Containers using image" });
    details.containersUsingImage.length ? details.containersUsingImage.forEach((container) => { const button = used.createEl("button", { text: `${container.name} · ${container.state ?? "Unknown"}` }); button.onclick = () => this.openContainer(container.id); }) : used.createDiv({ text: "No visible container references.", cls: "docker-connector__muted" });
  }

  private async open(image: DockerImageSummary, origin: HTMLElement): Promise<void> { this.state.selectedImageId = this.key(image); this.origin = origin; const profile = this.plugin.settings.profiles.find((item) => item.id === image.hostProfileId); const snapshot = this.plugin.snapshots.get(image.hostProfileId); if (profile && snapshot) await this.load(profile, snapshot, image); }
  private async load(profile: DockerConnectionProfile, snapshot: DockerHostSnapshot, image: DockerImageSummary, force = false): Promise<void> { const key = dockerResourceKey(snapshot, image.id); if (!force && this.state.detail.status === "ready" && this.state.detail.id === key) return; this.state.detail = { status: "loading", id: key }; this.rerender(); try { this.state.detail = { status: "ready", id: key, value: await this.plugin.inspectImage(profile, snapshot, image.id) }; } catch (error) { this.state.detail = { status: "error", id: key, message: error instanceof Error ? error.message : "Image details could not be loaded." }; } this.rerender(); }
  private close(): void { this.state.selectedImageId = null; this.state.detail = { status: "closed" }; this.rerender(); this.origin?.focus(); }
  private key(image: DockerImageSummary): string { const snapshot = this.plugin.snapshots.get(image.hostProfileId); return snapshot ? dockerResourceKey(snapshot, image.id) : `profile:${image.hostProfileId}\u0000${image.id}`; }
  private select(root: HTMLElement, name: string, value: string, options: Array<[string, string]>, change: (value: string) => void): void { const label = root.createEl("label", { cls: "dc-container-select" }); label.createSpan({ text: name }); const select = label.createEl("select", { attr: { "aria-label": `${name} image control` } }); options.forEach(([optionValue, text]) => select.createEl("option", { value: optionValue, text })); select.value = value; select.onchange = () => change(select.value); }
}

function badge(text: string, kind: string): HTMLElement { const element = createSpan(); element.addClass("dc-container-badge", `is-${kind}`); element.setText(text); return element; }
function bytes(value: number): string { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function section(root: HTMLElement, title: string, rows: Array<[string, string | undefined]>): void { const section = root.createEl("section", { cls: "dc-image-detail-section" }); section.createEl("h3", { text: title }); rows.filter(([, value]) => Boolean(value)).forEach(([label, value]) => { const row = section.createDiv({ cls: "dc-container-detail-row" }); row.createSpan({ text: label }); row.createSpan({ text: value! }); }); }
