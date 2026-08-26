import { ItemView, Modal, Notice, Setting, setIcon, WorkspaceLeaf } from "obsidian";
import type DockerConnectorPlugin from "../main";
import type { DockerConnectionProfile, DockerContextProfile, DockerHostSnapshot, HostConnectionStatus, SshDockerProfile } from "../models/DockerConnectionProfile";
import { dockerPermissionRemediation } from "../security/DockerPermissionRemediation";
import type { DockerContainerSummary } from "../containers/ContainerModels";
import { ContainersTab } from "../containers/ContainersTab";
import { ImagesTab } from "../images/ImagesTab";
import { VolumesTab } from "../volumes/VolumesTab";
import { NetworksTab } from "../networks/NetworksTab";
import { ApplicationsTab } from "../applications/ApplicationsTab";
import { selectAttentionItems, type DashboardAttentionItem } from "../overview/AttentionItems";
import { renderMetricCards } from "../ui/MetricCards";
import { FloatingModalController } from "../ui/ModalDragController";
import { HostKeyTrustSession, hostKeySecurityPresentation, type HostKeyTrustWorkflowState } from "../security/HostKeyTrustWorkflow";
import { SshHostKeyMismatchModal, SshHostKeyTrustModal } from "./SshHostKeyTrustModal";
import { SshKeyGenerationModal, SshPublicKeyInstallModal } from "./SshKeySetupModals";
import type { ResolvedSshPublicKey } from "../security/SshPublicKeyResolver";
import type { DiscoveredDockerContext } from "../connections/DockerContextDiscovery";
import { canSaveDiscoveredDockerContext, mapDiscoveredDockerContextToProfile, updateDockerContextProfile } from "../connections/DockerContextProfileMapper";
import { evaluateDockerContextLifecycle, unavailableDockerContextLifecycle, type DockerContextLifecycleResult } from "../connections/DockerContextLifecycle";
import type { validateDockerTlsFiles } from "../security/TlsProfileValidation";
import { desktopUi } from "../platform/DesktopUiAdapter";
import { getDockerConnectionTypeDisplayName, getDockerConnectionTypePresentation } from "../connections/DockerConnectionTypePresentation";
import { configuredServerConnection } from "./ConfiguredServerConnection";
import { aggregateConnectionStatus, connectionStateSummary, profileConnectionStatus } from "../connections/ProfileConnectionState";
import { connectionCapabilities } from "../connections/DockerConnectionCapabilities";
import { OVERVIEW_METRIC_ACCENTS, type OverviewMetricAccent } from "../overview/OverviewMetricAccents";

export const DOCKER_CONNECTOR_VIEW = "docker-connector-dashboard";

type DashboardPage = "overview" | "applications" | "containers" | "images" | "volumes" | "networks" | "connections";
type ContainerState = "running" | "stopped" | "paused" | "restarting" | "dead" | "created" | "unknown";

const NAVIGATION: Array<{ id: DashboardPage; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "layout-dashboard" },
  { id: "applications", label: "Applications", icon: "boxes" },
  { id: "containers", label: "Containers", icon: "container" },
  { id: "images", label: "Images", icon: "layers-3" },
  { id: "volumes", label: "Volumes", icon: "database" },
  { id: "networks", label: "Networks", icon: "network" },
  { id: "connections", label: "Connections", icon: "plug-zap" }
];

/**
 * The plugin's single, internally routed monitoring view.
 *
 * Documentation: [[Docker Connector - Dashboard]] and [[Docker Connector - User Guide]]
 */
export class DockerDashboardView extends ItemView {
  private page: DashboardPage = "overview";
  private selectedHostId = "all";
  private selectedContainerState?: ContainerState;
  private readonly containersTab: ContainersTab;
  private readonly imagesTab: ImagesTab;
  private readonly volumesTab: VolumesTab;
  private readonly networksTab: NetworksTab;
  private readonly applicationsTab: ApplicationsTab;
  private relativeTimeTimer?: number;
  private readonly attentionReleaseChecks = new Set<string>();
  private closed = false;
  private removeSettingsListener?: () => void;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: DockerConnectorPlugin) { super(leaf); this.containersTab = new ContainersTab(plugin, () => void this.render()); this.applicationsTab = new ApplicationsTab(plugin, () => void this.render(), (id) => { this.containersTab.route(undefined, id); this.page = "containers"; void this.render(); }); this.imagesTab = new ImagesTab(plugin, () => void this.render(), (id) => { this.containersTab.route(undefined, id); this.page = "containers"; void this.render(); }); this.volumesTab = new VolumesTab(plugin, () => void this.render(), (id) => { this.containersTab.route(undefined, id); this.page = "containers"; void this.render(); }); this.networksTab = new NetworksTab(plugin, () => void this.render(), id => { this.containersTab.route(undefined,id);this.page="containers";void this.render();}); }

  getViewType(): string { return DOCKER_CONNECTOR_VIEW; }
  getDisplayText(): string { return "Docker Connector"; }
  getIcon(): string { return "container"; }
  async onOpen(): Promise<void> { this.closed = false; this.removeSettingsListener = this.plugin.onSettingsChanged((change) => { if (change.key === "managementAuthorization" && !this.closed) void this.render(); }); /* The view owns this presentation-only timer, so registerInterval ties it to ItemView disposal as well as the explicit close path. */ this.relativeTimeTimer = this.registerInterval(window.setInterval(() => { if (this.page === "containers") void this.render(); }, 60_000)); await this.render(); }
  async onClose(): Promise<void> { this.closed = true; this.removeSettingsListener?.(); this.removeSettingsListener = undefined; this.attentionReleaseChecks.clear(); if (this.relativeTimeTimer) window.clearInterval(this.relativeTimeTimer); this.containersTab.dispose(); this.applicationsTab.dispose(); this.imagesTab.dispose(); this.volumesTab.dispose(); }

  async render(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("docker-connector");
    const profiles = this.plugin.settings.profiles;
    if (this.selectedHostId !== "all" && !profiles.some((profile) => profile.id === this.selectedHostId)) this.selectedHostId = "all";
    this.renderHeader(root, profiles);
    this.renderNavigation(root);
    const content = root.createDiv({ cls: "docker-connector__content" });
    if (this.page !== "connections" && this.requiresAuthenticationGate(profiles)) {
      this.renderAuthenticationGate(content, profiles, this.page);
      return;
    }
    switch (this.page) {
      case "overview": this.renderOverview(content, profiles); break;
      case "applications": this.renderApplications(content); break;
      case "containers": this.renderContainers(content); break;
      case "images": this.renderImages(content); break;
      case "volumes": this.renderVolumes(content); break;
      case "networks": this.renderNetworks(content); break;
      case "connections": this.renderConnections(content, profiles); break;
    }
  }

  private renderHeader(root: HTMLElement, profiles: DockerConnectionProfile[]): void {
    const header = root.createDiv({ cls: "docker-connector__header" });
    const identity = header.createDiv({ cls: "docker-connector__brand" });
    const logo = identity.createDiv({ cls: "docker-connector__brand-icon" }); setIcon(logo, "container");
    const text = identity.createDiv(); text.createEl("h2", { text: "Docker Connector" }); text.createSpan({ text: "Read-only environment dashboard" });

    const controls = header.createDiv({ cls: "docker-connector__header-controls" });
    const hostPicker = controls.createDiv({ cls: "docker-connector__host-picker" });
    const hostIcon = hostPicker.createSpan({ cls: "docker-connector__host-picker-icon", attr: { "aria-hidden": "true" } });
    setIcon(hostIcon, "server");
    hostPicker.createSpan({ text: "Current environment", cls: "docker-connector__control-label" });
    const select = hostPicker.createEl("select", { attr: { "aria-label": "Current Docker host" } });
    select.createEl("option", { text: "All Docker hosts", value: "all" });
    profiles.forEach((profile) => select.createEl("option", { text: profile.name, value: profile.id }));
    select.value = this.selectedHostId;
    select.onchange = () => { this.selectedHostId = select.value; void this.render(); };

    const status = this.currentStatus(profiles);
    controls.appendChild(this.statusPill(status));
    const refreshInfo = controls.createDiv({ cls: "docker-connector__refresh-info" });
    refreshInfo.createSpan({ text: this.lastRefreshText(profiles) });
    refreshInfo.createSpan({ text: this.plugin.settings.automaticRefresh ? `Auto · ${this.plugin.settings.refreshIntervalMinutes} min` : "Auto refresh off", cls: "docker-connector__auto-refresh" });
    this.iconButton(controls, "Refresh dashboard", "refresh-cw", async (button) => {
      button.disabled = true;
      await this.plugin.refreshAll();
      button.disabled = false;
    }, "docker-connector__refresh-button");
    this.iconButton(controls, "Add Docker host", "plus", () => new DockerHostModal(this.plugin, () => this.render()).open(), "mod-cta");
    this.iconButton(controls, "Docker Connector settings", "settings", () => {
      const settings = (this.plugin.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting;
      settings.open();
      settings.openTabById(this.plugin.manifest.id);
    });
  }

  private renderNavigation(root: HTMLElement): void {
    const nav = root.createEl("nav", { cls: "docker-connector__nav", attr: { "aria-label": "Docker Connector sections" } });
    for (const item of NAVIGATION) {
      const button = nav.createEl("button", { cls: `docker-connector__nav-item${this.page === item.id ? " is-active" : ""}`, attr: { "aria-current": this.page === item.id ? "page" : "false" } });
      setIcon(button.createSpan({ cls: "docker-connector__nav-icon" }), item.icon);
      button.createSpan({ text: item.label });
      button.onclick = () => this.navigate(item.id);
    }
  }

  /**
   * Keeps Docker metadata out of the dashboard until the selected session has
   * authenticated. Configuration names and connection states remain available
   * so the user can reconnect without exposing an old or unavailable snapshot.
   */
  private requiresAuthenticationGate(profiles: DockerConnectionProfile[]): boolean {
    // An aggregate dashboard must retain each connection's independent status:
    // one password-authenticated host cannot mask an already-online mTLS host.
    if (this.selectedHostId === "all") return false;
    return profileConnectionStatus(this.selectedHostId, this.plugin.snapshots) === "authentication-required";
  }

  private renderAuthenticationGate(root: HTMLElement, profiles: DockerConnectionProfile[], page: Exclude<DashboardPage, "connections">): void {
    const applications = page === "applications";
    root.addClass(`docker-connector__connection-required--${page}`);
    this.sectionIntro(root, applications ? "Reconnect to view Applications" : "Reconnect Docker connections", applications ? "Docker Compose application details remain hidden until a secure session connection succeeds." : "Docker details remain hidden until a secure session connection succeeds.");
    const panel = this.panel(root, "Configured servers", "Connection state for this Obsidian session", "shield-check", "docker-connector__access-panel");
    const list = panel.createDiv({ cls: "docker-connector__access-list", attr: { "aria-label": "Configured Docker server connection states" } });
    for (const profile of profiles) {
      const snapshot = this.plugin.snapshots.get(profile.id);
      const row = list.createDiv({ cls: "docker-connector__access-row" });
      const identity = row.createDiv({ cls: "docker-connector__access-identity" });
      identity.createEl("strong", { text: profile.name });
      const method = configuredServerConnection(profile);
      identity.createDiv({ text: `Connection: ${method.label}`, cls: "docker-connector__access-method" });
      if (method.detail) identity.createDiv({ text: method.detail, cls: "docker-connector__muted docker-connector__access-detail", attr: { "aria-label": method.detail } });
      const status = profileConnectionStatus(profile.id, this.plugin.snapshots);
      row.appendChild(this.statusPill(status));
      if (status === "authentication-required") {
        const reconnect = row.createEl("button", { text: "Reconnect", cls: "mod-cta" });
        reconnect.onclick = () => new ReconnectPasswordModal(this.plugin, profile, () => this.render()).open();
      }
    }
  }

  private renderOverview(root: HTMLElement, profiles: DockerConnectionProfile[]): void {
    const snapshots = this.visibleSnapshots();
    const containers = snapshots.flatMap((snapshot) => snapshot.containers);
    const online = connectionStateSummary(profiles, this.plugin.snapshots).online;
    const states = this.containerStates(containers);
    const attention = selectAttentionItems(profiles, this.plugin.snapshots, containers, (image) => this.plugin.publicImageReleases.get(image));
    void this.loadAttentionReleases(containers);
    this.sectionIntro(root, "Environment overview", this.selectedHostId === "all" ? "A concise view of every configured Docker environment." : "The current Docker environment at a glance.");

    const cards = root.createDiv({ cls: "docker-connector__summary-grid" });
    this.summaryCard(cards, "Hosts", profiles.length, `${online} online`, "server", OVERVIEW_METRIC_ACCENTS.hosts, () => this.navigate("connections"));
    this.summaryCard(cards, "Containers", containers.length, `${states.running} running · ${states.stopped} stopped`, "container", OVERVIEW_METRIC_ACCENTS.containers, () => this.navigate("containers"));
    this.summaryCard(cards, "Running", states.running, `${percentage(states.running, containers.length)}% of containers`, "circle-play", OVERVIEW_METRIC_ACCENTS.running, () => this.navigate("containers", "running"));
    this.summaryCard(cards, "Stopped", states.stopped, `${states.paused + states.restarting} need attention`, "circle-stop", OVERVIEW_METRIC_ACCENTS.stopped, () => this.navigate("containers", "stopped"));
    this.summaryCard(cards, "Images", snapshots.reduce((total, snapshot) => total + snapshot.images.length, 0), "Available image library", "layers-3", OVERVIEW_METRIC_ACCENTS.images, () => this.navigate("images"));
    this.summaryCard(cards, "Volumes", snapshots.reduce((total, snapshot) => total + snapshot.volumes.length, 0), "Persistent data stores", "database", OVERVIEW_METRIC_ACCENTS.volumes, () => this.navigate("volumes"));
    this.summaryCard(cards, "Networks", snapshots.reduce((total, snapshot) => total + snapshot.networks.length, 0), "Docker network definitions", "network", OVERVIEW_METRIC_ACCENTS.networks, () => this.navigate("networks"));

    const grid = root.createDiv({ cls: "docker-connector__overview-grid" });
    const hasAttention = attention.length > 0;
    this.renderHostHealth(grid, profiles);
    if (hasAttention) this.renderAttention(grid, attention, true);
    if (!hasAttention) this.renderAttention(grid, attention);
  }

  private renderHostHealth(root: HTMLElement, profiles: DockerConnectionProfile[]): void {
    const panel = this.panel(root, "Host health", "Activity and Engine details", "heart-pulse", "docker-connector__panel--wide");
    const hosts = this.selectedHostId === "all" ? profiles : profiles.filter((profile) => profile.id === this.selectedHostId);
    if (!hosts.length) { this.emptyState(panel, "No Docker hosts yet", "Add a Docker host to begin monitoring your environments.", "plus", () => new DockerHostModal(this.plugin, () => this.render()).open()); return; }
    const list = panel.createDiv({ cls: "docker-connector__health-list" });
    for (const host of hosts) {
      const snapshot = this.plugin.snapshots.get(host.id);
      const item = list.createEl("button", { cls: "docker-connector__health-row", attr: { "aria-label": `Select ${host.name}` } });
      item.onclick = () => { this.selectedHostId = host.id; void this.render(); };
      const main = item.createDiv(); main.createDiv({ text: host.name, cls: "docker-connector__health-name" }); main.createDiv({ text: host.category || connectionSummary(host), cls: "docker-connector__muted" });
      const metrics = item.createDiv({ cls: "docker-connector__health-metrics" });
      if (snapshot?.system) metrics.createSpan({ text: `Docker ${snapshot.system.dockerVersion}` });
      metrics.createSpan({ text: snapshot?.system ? `${snapshot.system.operatingSystem} · ${snapshot.system.architecture}` : "Waiting for connection" });
      item.appendChild(this.statusPill(profileConnectionStatus(host.id, this.plugin.snapshots)));
    }
    if (this.selectedHostId !== "all") this.renderSelectedHostDetails(panel, hosts[0], this.plugin.snapshots.get(hosts[0].id));
  }

  private renderSelectedHostDetails(panel: HTMLElement, host: DockerConnectionProfile, snapshot?: DockerHostSnapshot): void {
    const details = panel.createEl("details", { cls: "docker-connector__host-details" });
    details.createEl("summary", { text: "Host information and diagnostics" });
    const grid = details.createDiv({ cls: "docker-connector__detail-grid" });
    const values: Array<[string, string]> = [
      ["Connection", "Configured Docker host"], ["Docker context", "Selected Docker connection"],
      ["Last refresh", snapshot ? relativeTime(snapshot.refreshedAt) : "Not refreshed"],
      ["Docker version", snapshot?.system?.dockerVersion ?? "—"], ["API version", snapshot?.system?.apiVersion ?? "—"],
      ["Operating system", snapshot?.system?.operatingSystem ?? "—"], ["Architecture", snapshot?.system?.architecture ?? "—"],
      ["Kernel", snapshot?.system?.kernelVersion ?? "—"], ["CPU count", snapshot?.system ? String(snapshot.system.cpuCount) : "—"], ["Memory", snapshot?.system ? formatBytes(snapshot.system.totalMemory) : "—"]
    ];
    values.forEach(([label, value]) => { const item = grid.createDiv(); item.createSpan({ text: label }); item.createEl("strong", { text: value }); });
    const diagnostics = details.createEl("details", { cls: "docker-connector__diagnostics" }); diagnostics.createEl("summary", { text: "Connection diagnostics" }); diagnostics.createDiv({ text: snapshot?.error ?? "No connection errors recorded.", cls: snapshot?.error ? "docker-connector__error" : "docker-connector__muted" });
  }

  private renderAttention(root: HTMLElement, issues: DashboardAttentionItem[], prominent = false): void {
    const panel = this.panel(root, "Attention required", "Updates and conditions that may need a closer look", "triangle-alert", prominent ? "docker-connector__panel--wide docker-connector__attention-panel" : "");
    if (!issues.length) { panel.createDiv({ text: "All refreshed hosts and containers are reporting normally.", cls: "docker-connector__empty-inline" }); return; }
    const list = panel.createDiv({ cls: "docker-connector__attention-list" });
    issues.forEach((issue) => {
      const item = list.createDiv({ cls: `docker-connector__attention-item is-${issue.severity}` });
      item.appendChild(this.attentionPill(issue.label, issue.severity));
      const copy = item.createDiv(); copy.createEl("strong", { text: issue.title }); copy.createDiv({ text: issue.description, cls: "docker-connector__muted" });
      if (issue.target === "host" && profileConnectionStatus(issue.hostProfileId, this.plugin.snapshots) === "authentication-required") {
        const profile = this.plugin.settings.profiles.find((candidate) => candidate.id === issue.hostProfileId);
        if (profile) { const reconnect = item.createEl("button", { text: "Reconnect", cls: "mod-cta" }); reconnect.onclick = () => new ReconnectPasswordModal(this.plugin, profile, () => this.render()).open(); }
      } else {
        const action = item.createEl("button", { text: issue.target === "container" ? "View container" : issue.target === "image" ? "View images" : "Open connection" });
        action.onclick = () => this.openAttentionItem(issue);
      }
    });
  }

  private renderContainers(root: HTMLElement): void {
    this.containersTab.render(root, this.selectedHostId);
  }
  private renderApplications(root: HTMLElement): void { this.applicationsTab.render(root, this.selectedHostId); }
  private renderImages(root: HTMLElement): void { this.imagesTab.render(root, this.selectedHostId); }
  private renderVolumes(root: HTMLElement): void { this.volumesTab.render(root, this.selectedHostId); }
  private renderNetworks(root: HTMLElement): void { this.networksTab.render(root, this.selectedHostId); }
  private renderConnections(root: HTMLElement, profiles: DockerConnectionProfile[]): void {
    root.addClass("dc-connections-tab");
    const pageHeader = root.createDiv({ cls: "dc-connections-page-header" });
    const pageCopy = pageHeader.createDiv(); pageCopy.createEl("h1", { text: "Docker connections" }); pageCopy.createSpan({ text: "Manage saved Docker hosts and reconnect session-based credentials." });
    const add = pageHeader.createEl("button", { text: "Add Docker Host", cls: "mod-cta", attr: { "aria-label": "Add Docker Host" } });
    setIcon(add.createSpan({ attr: { "aria-hidden": "true" } }), "plus");
    add.onclick = () => new DockerHostModal(this.plugin, () => this.render()).open();
    if (!profiles.length) {
      const panel = this.panel(root, "Docker hosts", "Add a host to begin monitoring Docker environments", "plug-zap");
      this.emptyState(panel, "No Docker connections configured", "Add a Docker host to get started.", "plus", () => new DockerHostModal(this.plugin, () => this.render()).open());
      return;
    }
    const summary = connectionStateSummary(profiles, this.plugin.snapshots);
    renderMetricCards(root, [{ label: "Configured hosts", value: summary.configured, detail: "Local and remote Docker hosts", icon: "server" }, { label: "Online", value: summary.online, detail: "Connected this session", icon: "circle-check", tone: "success" }, { label: "Needs sign-in", value: summary.needsSignIn, detail: "Session credential required", icon: "key-round", tone: "warning" }], "Docker host connection summary");
    const section = root.createEl("section", { cls: "dc-connections-panel" });
    const heading = section.createDiv({ cls: "dc-connections-panel-header" });
    const icon = heading.createDiv({ cls: "docker-connector__panel-icon" }); setIcon(icon, "plug-zap");
    const copy = heading.createDiv(); copy.createEl("h2", { text: "Docker hosts" }); copy.createSpan({ text: "Select an environment to review its current Docker inventory." });
    const cards = section.createDiv({ cls: "dc-connection-cards" });
    profiles.forEach((profile) => this.renderConnectionRow(cards, profile, this.plugin.snapshots.get(profile.id)));
  }

  private renderConnectionRow(root: HTMLElement, profile: DockerConnectionProfile, snapshot?: DockerHostSnapshot): void {
    const status = profileConnectionStatus(profile.id, this.plugin.snapshots);
    const card = root.createEl("article", { cls: `dc-connection-card status-${status}` });
    const header = card.createDiv({ cls: "dc-connection-card-header" });
    const identity = header.createDiv({ cls: "dc-connection-identity" });
    const icon = identity.createDiv({ cls: "dc-host-card-icon", attr: { "aria-hidden": "true" } }); setIcon(icon, "server");
    const copy = identity.createDiv(); copy.createEl("h3", { text: profile.name, cls: "dc-host-card-title" });
    copy.createSpan({ text: profile.description || profile.category || "Configured Docker host", cls: "dc-host-card-meta docker-connector__muted" });
    copy.createSpan({ text: getDockerConnectionTypeDisplayName(profile.connectionType), cls: "dc-host-card-meta docker-connector__muted" });
    header.appendChild(this.statusPill(status));

    const endpoint = card.createDiv({ cls: "dc-host-card-endpoint" });
    const endpointIcon = endpoint.createSpan({ attr: { "aria-hidden": "true" } }); setIcon(endpointIcon, "network");
    this.connectionCardEndpointDetails(profile).forEach((detail) => endpoint.createSpan({ text: detail }));
    if (profile.category) endpoint.createSpan({ text: profile.category, cls: "dc-connection-category" });

    const inventory = card.createDiv({ cls: "dc-host-card-inventory dc-connection-inventory", attr: { "aria-label": `${profile.name} Docker inventory` } });
    [["Containers", snapshot?.containers.length ?? 0, "container"], ["Images", snapshot?.images.length ?? 0, "layers-3"], ["Volumes", snapshot?.volumes.length ?? 0, "database"], ["Networks", snapshot?.networks.length ?? 0, "network"]].forEach(([label, value, iconName]) => {
      const metric = inventory.createDiv(); const metricIcon = metric.createSpan({ attr: { "aria-hidden": "true" } }); setIcon(metricIcon, String(iconName));
      metric.createEl("strong", { text: String(value) }); metric.createSpan({ text: String(label) });
    });
    const engine = card.createDiv({ cls: "dc-host-card-runtime dc-connection-engine" });
    engine.createSpan({ text: snapshot?.system ? `Docker ${snapshot.system.dockerVersion} · API ${snapshot.system.apiVersion}` : "Docker details unavailable" });
    engine.createSpan({ text: snapshot?.system ? `${snapshot.system.operatingSystem} · ${snapshot.system.architecture}` : this.lastRefreshText([profile]) });

    const footer = card.createDiv({ cls: "dc-connection-card-footer" });
    const primaryActions = footer.createDiv({ cls: "dc-connection-card-actions" });
    const action = primaryActions.createEl("button", { text: "Open dashboard", cls: "mod-cta" });
    action.onclick = () => { this.selectedHostId = profile.id; this.navigate("overview"); };
    this.addEditAction(primaryActions, profile);
    this.addConnectionSpecificAction(primaryActions, profile);
    this.addReconnectAction(primaryActions, profile, status);
    this.addDeleteAction(primaryActions, profile);
    const management = footer.createDiv({ cls: "dc-connection-card-management" });
    this.addCardManagementSwitch(management, profile, status);
  }

  /** Supplies safe, transport-relevant values to the shared host-card endpoint slot. */
  private connectionCardEndpointDetails(profile: DockerConnectionProfile): string[] {
    if (profile.connectionType === "docker-context") {
      const lifecycle = this.plugin.contextLifecycle.get(profile.id);
      return [`Context: ${profile.contextName}`, `Endpoint: ${profile.contextSnapshot.endpointType} · ${profile.contextSnapshot.endpointDisplay ?? "—"}`, `Lifecycle: ${contextLifecycleLabel(lifecycle?.state)}`, `Imported: ${profile.contextSnapshot.importedAt}${lifecycle?.checkedAt ? ` · Checked: ${lifecycle.checkedAt}` : ""}`];
    }
    if (profile.connectionType === "docker-tls") return [`${profile.host}:${profile.port}`, `Server name: ${profile.serverName}`];
    return [connectionSummary(profile)];
  }

  private addConnectionSpecificAction(actions: HTMLElement, profile: DockerConnectionProfile): void {
    if (profile.connectionType !== "docker-context") return;
    const refresh = actions.createEl("button", { text: "Refresh Context Metadata", attr: { "aria-label": `Refresh Context metadata for ${profile.name}` } });
    refresh.onclick = () => void this.plugin.refreshContextMetadata(profile);
  }

  private addEditAction(actions: HTMLElement, profile: DockerConnectionProfile): void {
    const button = actions.createEl("button", { cls: "docker-connector__icon-button", attr: { "aria-label": `Edit connection ${profile.name}`, title: "Edit connection" } });
    setIcon(button, "pencil");
    button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); new DockerHostModal(this.plugin, () => this.render(), profile).open(); };
  }
  private addReconnectAction(actions: HTMLElement, profile: DockerConnectionProfile, status: HostConnectionStatus): void {
    if (status === "online" || status === "unknown") return;
    if (status === "authentication-required") {
      const button = actions.createEl("button", { text: "Reconnect", cls: "dc-connection-reconnect", attr: { "aria-label": `Reconnect ${profile.name}`, title: "Reconnect" } });
      button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); new ReconnectPasswordModal(this.plugin, profile, () => this.render()).open(); };
      return;
    }
    const button = actions.createEl("button", { cls: "docker-connector__icon-button", attr: { "aria-label": `Reconnect ${profile.name}`, title: "Reconnect" } });
    setIcon(button, "refresh-cw");
    button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); void this.plugin.retryHost(profile); };
  }

  private addCardManagementSwitch(actions: HTMLElement, profile: DockerConnectionProfile, status: HostConnectionStatus): void { const available = status === "online" && connectionCapabilities(profile).supportsContainerActions; const enabled = available && this.plugin.isProfileManagementEnabled(profile.id); const control = actions.createDiv({ cls: "dc-card-management-switch" }); control.createSpan({ text: "Container management" }); control.createEl("small", { text: available ? enabled ? "Enabled" : "Read-only" : "Unavailable" }); const input = control.createEl("input", { type: "checkbox", attr: { role: "switch", "aria-label": `Container management for ${profile.name}` } }); input.checked = enabled; input.disabled = !available; input.onchange = () => { if (input.checked && !globalThis.confirm(`Enable container management for ${profile.name}?\n\nThis allows Start, Stop, Shut down, Restart and standalone Update actions for this Docker connection during the current Obsidian session. Management turns off automatically if the connection is lost or Obsidian restarts.`)) { input.checked = false; return; } if (!this.plugin.setProfileManagementEnabled(profile.id, input.checked)) input.checked = false; void this.render(); }; }

  private addDeleteAction(actions: HTMLElement, profile: DockerConnectionProfile): void {
    const button = actions.createEl("button", { cls: "docker-connector__icon-button mod-warning", attr: { "aria-label": `Delete connection ${profile.name}`, title: "Delete connection" } });
    setIcon(button, "trash-2");
    button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); new DeleteConnectionModal(this.plugin, profile, async () => { this.reconcileSelectedHostAfterDelete(profile.id); await this.render(); this.contentEl.querySelector<HTMLButtonElement>('[aria-label^="Delete connection"], [aria-label="Add Docker host"]')?.focus(); }).open(); };
  }
  private reconcileSelectedHostAfterDelete(profileId: string): void {
    if (this.selectedHostId !== profileId) return;
    const remaining = this.plugin.settings.profiles;
    this.selectedHostId = remaining.find((profile) => this.plugin.snapshots.get(profile.id)?.status === "online")?.id ?? remaining[0]?.id ?? "all";
  }

  private renderInventory(root: HTMLElement, title: string, icon: string, rows: Array<[string, string, string]>, subtitle = `Read-only ${title.toLowerCase()} across the selected environments.`, clearFilter?: () => void): void { this.sectionIntro(root, title, subtitle); if (clearFilter) { const clear = root.createEl("button", { text: "Clear container filter", cls: "docker-connector__clear-filter" }); clear.onclick = clearFilter; } const panel = this.panel(root, title, `${rows.length} available`, icon); if (!rows.length) { panel.createDiv({ text: "No data is available. Refresh an authenticated host to load this inventory.", cls: "docker-connector__empty-inline" }); return; } const table = panel.createDiv({ cls: "docker-connector__inventory" }); rows.forEach(([primary, secondary, detail]) => { const row = table.createDiv({ cls: "docker-connector__inventory-row" }); row.createEl("strong", { text: primary }); row.createSpan({ text: secondary, cls: "docker-connector__muted" }); row.createSpan({ text: detail, cls: "docker-connector__muted" }); }); }
  private panel(root: HTMLElement, title: string, subtitle: string, icon: string, cls = ""): HTMLElement { const panel = root.createEl("section", { cls: `docker-connector__panel ${cls}` }); const header = panel.createDiv({ cls: "docker-connector__panel-header" }); const iconEl = header.createDiv({ cls: "docker-connector__panel-icon" }); setIcon(iconEl, icon); const copy = header.createDiv(); copy.createEl("h3", { text: title }); copy.createSpan({ text: subtitle }); return panel; }
  private sectionIntro(root: HTMLElement, title: string, subtitle: string): void { const intro = root.createDiv({ cls: "docker-connector__section-intro" }); intro.createEl("h1", { text: title }); intro.createSpan({ text: subtitle }); }
  private summaryCard(root: HTMLElement, label: string, value: number, detail: string, icon: string, accent: OverviewMetricAccent, onclick: () => void): void { const card = root.createEl("button", { cls: `docker-connector__summary-card dc-overview-card dc-overview-card--${accent}`, attr: { "aria-label": `${label}: ${value}. ${detail}` } }); card.onclick = onclick; const iconEl = card.createDiv({ cls: "docker-connector__summary-icon" }); setIcon(iconEl, icon); const copy = card.createDiv(); copy.createSpan({ text: label }); copy.createEl("strong", { text: String(value) }); copy.createEl("small", { text: detail }); }
  private attentionPill(label: string, severity: "danger" | "warning" | "info"): HTMLElement { const pill = document.createElement("span"); pill.addClass("docker-connector__attention-badge", `is-${severity}`); pill.createSpan({ cls: "docker-connector__status-dot" }); pill.createSpan({ text: label }); return pill; }
  private openAttentionItem(issue: DashboardAttentionItem): void { this.selectedHostId = issue.hostProfileId; if (issue.target === "container") { this.containersTab.route(undefined, issue.containerId); this.navigate("containers"); return; } this.navigate(issue.target === "image" ? "images" : "connections"); }
  private emptyState(root: HTMLElement, title: string, message: string, icon: string, action: () => void): void { const empty = root.createDiv({ cls: "docker-connector__empty" }); const iconEl = empty.createDiv(); setIcon(iconEl, icon); empty.createEl("h4", { text: title }); empty.createSpan({ text: message }); const button = empty.createEl("button", { text: "Add host", cls: "mod-cta" }); button.onclick = action; }
  private iconButton(root: HTMLElement, label: string, icon: string, onclick: (button: HTMLButtonElement) => void | Promise<void>, cls = ""): void { const button = root.createEl("button", { cls: `docker-connector__icon-button ${cls}`, attr: { "aria-label": label, title: label } }); setIcon(button, icon); button.onclick = () => void onclick(button); }
  private statusPill(status: HostConnectionStatus | ContainerState): HTMLElement { const label = status === "authentication-required" ? "Authentication Required" : titleCase(status); const el = document.createElement("span"); el.addClass("docker-connector__status", `status-${status}`); el.createSpan({ cls: "docker-connector__status-dot" }); el.createSpan({ text: label }); return el; }
  private currentStatus(profiles: DockerConnectionProfile[]): HostConnectionStatus { return this.selectedHostId === "all" ? aggregateConnectionStatus(profiles, this.plugin.snapshots) : profileConnectionStatus(this.selectedHostId, this.plugin.snapshots); }
  private visibleSnapshots(): DockerHostSnapshot[] { const snapshots = [...this.plugin.snapshots.values()]; return this.selectedHostId === "all" ? snapshots : snapshots.filter((snapshot) => snapshot.hostId === this.selectedHostId); }
  private containerStates(containers: DockerContainerSummary[]): Record<ContainerState, number> { const initial: Record<ContainerState, number> = { running: 0, stopped: 0, paused: 0, restarting: 0, dead: 0, created: 0, unknown: 0 }; containers.forEach((container) => { initial[normaliseState(container.state)]++; }); return initial; }
  private async loadAttentionReleases(containers: DockerContainerSummary[]): Promise<void> {
    const images = [...new Set(containers.map((container) => container.image).filter((image) => image && image !== "Unknown image"))].filter((image) => !this.plugin.publicImageReleases.get(image) && !this.attentionReleaseChecks.has(image));
    if (!images.length) return;
    images.forEach((image) => this.attentionReleaseChecks.add(image));
    await Promise.all(images.map((image) => this.plugin.publicImageReleases.check(image)));
    images.forEach((image) => this.attentionReleaseChecks.delete(image));
    if (!this.closed && this.page === "overview") void this.render();
  }
  private lastRefreshText(profiles: DockerConnectionProfile[]): string { const refreshed = profiles.map((profile) => this.plugin.snapshots.get(profile.id)?.refreshedAt).filter((value): value is string => Boolean(value)).sort().at(-1); return refreshed ? `Updated ${relativeTime(refreshed)}` : "Not refreshed yet"; }
  private navigate(page: DashboardPage, filter?: ContainerState): void { this.page = page; this.selectedContainerState = page === "containers" ? filter : undefined; if (page === "containers") this.containersTab.route(filter === "stopped" ? "stopped" : filter === "running" ? "running" : undefined); void this.render(); }
}

function normaliseState(value: string): ContainerState { const state = value.toLowerCase(); if (state === "exited" || state === "stopped") return "stopped"; if (["running", "paused", "restarting", "dead", "created"].includes(state)) return state as ContainerState; return "unknown"; }
function titleCase(value: string): string { return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function percentage(value: number, total: number): number { return total ? Math.round((value / total) * 100) : 0; }
function relativeTime(value: string): string { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return "just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`; if (seconds < 86_400) return `${Math.floor(seconds / 3600)} hr ago`; return `${Math.floor(seconds / 86_400)} d ago`; }
function formatBytes(value: number): string { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function contextLifecycleLabel(state: DockerContextLifecycleResult["state"] | undefined): string { return ({ "not-tested": "Not Tested", unchanged: "Unchanged", missing: "Docker Context Not Found", changed: "Docker Context Configuration Changed", unsupported: "Unsupported", "cli-unavailable": "Docker CLI Unavailable", "discovery-error": "Discovery Error" } as const)[state ?? "not-tested"]; }

class DockerHostModal extends Modal {
  private tlsValidationError?: string;
  private floatingModal?: FloatingModalController;
  private readonly id: string; private readonly createdAt: string; private name = ""; private description = ""; private category = ""; private connectionType: "ssh" | "local" | "docker-context" | "docker-tls" = "ssh"; private contexts: DiscoveredDockerContext[] = []; private selectedContextName?: string; private contextState = "Not checked"; private lifecycle?: DockerContextLifecycleResult; private discoverySucceeded = false; private discovering = false; private dismissed = false; private localEndpoint: import("../connections/LocalEndpointDiscovery").LocalDockerEndpoint = { type: "unix-socket", socketPath: "/var/run/docker.sock" }; private localStatus?: string; private host = ""; private port = "22"; private username = ""; private password = ""; private passwordVisible = false; private rememberPassword = false; private passwordRemembered = false; private authentication: "password" | "private-key" = "password"; private privateKeyPath = ""; private privateKeyPassphrase = ""; private resolvedPublicKey?: ResolvedSshPublicKey; private socketPath = "/var/run/docker.sock"; private tlsHost = ""; private tlsPort = "2376"; private tlsServerName = ""; private tlsCaPath = ""; private tlsCertPath = ""; private tlsKeyPath = ""; private tlsPassphrase = ""; private tlsValidation?: Awaited<ReturnType<typeof validateDockerTlsFiles>>; private fingerprint = ""; private mismatch?: HostKeyTrustWorkflowState["mismatch"]; private hostKeyTrust = new HostKeyTrustSession(); private formError?: string; private keyStatus?: { tone: "success" | "error" | "warning"; message: string }; private lastResult?: import("../connections/DockerTransport").DockerConnectionTestResult; private testing = false;
  constructor(private readonly plugin: DockerConnectorPlugin, private readonly onSaved: () => Promise<void>, private readonly editingProfile?: DockerConnectionProfile) { super(plugin.app); this.id = editingProfile?.id ?? crypto.randomUUID(); this.createdAt = editingProfile?.createdAt ?? new Date().toISOString(); if (editingProfile) { this.name = editingProfile.name; this.description = editingProfile.description ?? ""; this.category = editingProfile.category ?? ""; this.connectionType = editingProfile.connectionType; if (editingProfile.connectionType === "docker-context") this.selectedContextName = editingProfile.contextName; else if (editingProfile.connectionType === "local") this.localEndpoint = editingProfile.localEndpoint; else if (editingProfile.connectionType === "ssh") { this.host = editingProfile.sshHost; this.port = String(editingProfile.sshPort); this.username = editingProfile.sshUsername; this.authentication = editingProfile.authentication.type === "private-key" ? "private-key" : "password"; this.privateKeyPath = editingProfile.authentication.type === "private-key" ? editingProfile.authentication.privateKeyPath : ""; this.socketPath = editingProfile.remoteSocketPath; this.fingerprint = editingProfile.hostKeyFingerprint ?? ""; this.hostKeyTrust = new HostKeyTrustSession(this.fingerprint); this.passwordRemembered = editingProfile.authentication.type === "password" && plugin.hasRememberedSshPassword(this.id); this.rememberPassword = this.passwordRemembered; } else { this.tlsHost = editingProfile.host; this.tlsPort = String(editingProfile.port); this.tlsServerName = editingProfile.serverName; this.tlsCaPath = editingProfile.caCertificatePath; this.tlsCertPath = editingProfile.clientCertificatePath; this.tlsKeyPath = editingProfile.clientKeyPath; } } }
  onOpen(): void { this.dismissed = false; this.modalEl.addClass("dc-resizable-modal"); this.floatingModal = new FloatingModalController(this.modalEl); this.render(); }
  onClose(): void { this.dismissed = true; this.floatingModal?.dispose(); this.floatingModal = undefined; }
  private render(): void { this.contentEl.empty(); this.contentEl.addClass("dc-host-modal"); const header = this.contentEl.createDiv({ cls: "dc-floating-modal__header" }); header.createEl("h2", { text: this.editingProfile ? "Edit Docker Host" : "Add Docker Host" }); const close = header.createEl("button", { cls: "dc-floating-modal__close", attr: { "aria-label": "Close Docker Host dialog", title: "Close" } }); setIcon(close, "x"); close.onclick = () => this.close(); this.floatingModal?.attach(header); const form = this.contentEl.createDiv({ cls: "dc-host-modal__form" }); const host = this.section(form, "Host Information"); this.text(host, "Friendly Name", this.name, (value) => this.name = value); this.text(host, "Description", this.description, (value) => this.description = value); this.text(host, "Category", this.category, (value) => this.category = value);
    const connection = this.section(form, "Connection"); const connectionTypeSetting = new Setting(connection).setName("Connection Type").setDesc("Choose how Docker Connector connects to this Docker environment.").addDropdown((dropdown) => { dropdown.addOption("local", "Local Docker Socket").addOption("docker-context", "Docker Context").addOption("ssh", "Remote Docker via SSH").addOption("docker-tls", "Remote Docker API (Mutual TLS)"); dropdown.setValue(this.connectionType).onChange((value) => { this.connectionType = value as typeof this.connectionType; this.formError = undefined; this.render(); }); dropdown.selectEl.setAttribute("aria-describedby", "dc-connection-type-description"); dropdown.setDisabled(Boolean(this.editingProfile)); }); connectionTypeSetting.settingEl.addClass("dc-host-modal__connection-type"); connectionTypeSetting.settingEl.addClass("dc-host-modal__full-width-field"); this.connectionTypeInfo(connection); if (this.connectionType === "local") this.localFields(connection); else if (this.connectionType === "docker-context") this.contextFields(connection); else if (this.connectionType === "docker-tls") this.tlsFields(connection); else { this.text(connection, "SSH Host", this.host, (value) => this.host = value); this.text(connection, "SSH Port", this.port, (value) => this.port = value); this.text(connection, "SSH Username", this.username, (value) => this.username = value); }
    if (this.connectionType === "ssh") { const auth = this.section(form, "Authentication"); const sshAuthenticationSetting = new Setting(auth).setName("SSH Authentication").setDesc("Choose how this host authenticates. Secrets remain in memory only unless you explicitly opt in to remember an SSH password.").addDropdown((dropdown) => dropdown.addOption("password", "Password").addOption("private-key", "Private Key").setValue(this.authentication).onChange((value) => void this.changeAuthentication(value as typeof this.authentication))); sshAuthenticationSetting.settingEl.addClass("dc-host-modal__full-width-field"); const details = this.section(form, "Authentication Details", "dc-host-modal__auth-details"); if (this.authentication === "password") this.passwordField(details); else this.privateKeyFields(details); const docker = this.section(form, "Docker"); new Setting(docker).setName("Remote Docker Socket").setDesc("Docker socket path on the remote host.").addText((text) => text.setValue(this.socketPath).onChange((value) => this.socketPath = value)); this.hostKeySecurity(form); }
    if (this.formError) form.createDiv({ text: this.formError, cls: "dc-host-modal__validation", attr: { role: "alert" } }); if (this.lastResult) this.renderDiagnostics(form, this.lastResult);
    const footer = this.contentEl.createDiv({ cls: "dc-host-modal__footer" }); const cancel = footer.createEl("button", { text: "Cancel" }); cancel.onclick = () => this.close(); const test = footer.createEl("button", { text: "Test Connection", attr: { title: this.connectionType === "docker-context" ? "Discovery must confirm the selected Docker Context before testing." : "" } }); test.disabled = this.connectionType === "docker-context" && !this.canSaveContext(); test.onclick = () => void this.test(); const save = footer.createEl("button", { text: "Save Host", cls: "mod-cta" }); save.disabled = this.connectionType === "docker-context" && !this.canSaveContext(); save.onclick = () => void this.save(); }
  private section(root: HTMLElement, title: string, cls = ""): HTMLElement { const section = root.createDiv({ cls: `dc-host-modal__section ${cls}` }); section.createEl("h3", { text: title }); return section; }
  private text(root: HTMLElement, name: string, value: string, onChange: (value: string) => void): void { new Setting(root).setName(name).addText((text) => text.setValue(value).onChange(onChange)); }
  private passwordField(root: HTMLElement): void {
    new Setting(root).setName("Password").setDesc("Used only in memory for this Obsidian session unless you explicitly opt in below.").addText((text) => { text.setValue(this.password); text.inputEl.type = this.passwordVisible ? "text" : "password"; text.inputEl.autocomplete = "current-password"; text.onChange((value) => this.password = value); }).addButton((button) => button.setButtonText(this.passwordVisible ? "Hide password" : "Show password").onClick(() => { this.passwordVisible = !this.passwordVisible; this.render(); }));
    new Setting(root).setName("Remember password on this device").setDesc("Stores this SSH password locally so Docker Connector can reconnect automatically after Obsidian restarts.\n\nSecurity warning: anyone who can access this vault, device, backups, or plugin data may be able to recover the stored password. Use only on a trusted device. Prefer SSH keys where possible.").addToggle((toggle) => toggle.setValue(this.rememberPassword).onChange((value) => void this.setRememberPassword(value)));
    if (this.passwordRemembered) new Setting(root).setName("Stored credential").setDesc("Password remembered on this device. The password is never displayed.").addButton((button) => button.setButtonText("Forget stored password").setWarning().onClick(() => void this.setRememberPassword(false)));
  }
  private async setRememberPassword(value: boolean): Promise<void> {
    this.rememberPassword = value;
    if (!value && this.passwordRemembered) { await this.plugin.forgetRememberedSshPassword(this.id); this.passwordRemembered = false; }
    this.render();
  }
  private async changeAuthentication(value: "password" | "private-key"): Promise<void> {
    const changedAwayFromPassword = this.authentication === "password" && value !== "password";
    this.authentication = value;
    this.formError = undefined;
    this.keyStatus = undefined;
    this.resolvedPublicKey = undefined;
    if (changedAwayFromPassword && this.passwordRemembered) { await this.plugin.forgetRememberedSshPassword(this.id); this.passwordRemembered = false; }
    if (changedAwayFromPassword) this.rememberPassword = false;
    this.render();
  }
  private hostKeySecurity(root: HTMLElement): void { const security = this.section(root, "Security"); const presentation = hostKeySecurityPresentation(this.fingerprint, undefined, this.mismatch); if (presentation.branch === "MISMATCH" && this.mismatch) { new Setting(security).setName("Host Key Mismatch").setDesc(presentation.description); new Setting(security).setName("Trusted Fingerprint").setDesc(this.mismatch.trustedFingerprint); new Setting(security).setName("Received Fingerprint").setDesc(this.mismatch.receivedFingerprint); return; } new Setting(security).setName("Host Key Fingerprint").setDesc(presentation.description).addText((text) => { text.setValue(presentation.fingerprint ?? "Awaiting first connection"); text.inputEl.readOnly = true; }); }
  private connectionTypeInfo(root: HTMLElement): void { const presentation = getDockerConnectionTypePresentation(this.connectionType); const info = root.createDiv({ cls: "dc-host-modal__connection-info", attr: { id: "dc-connection-type-description", role: "status", "aria-live": "polite" } }); const title = info.createDiv({ cls: "dc-host-modal__connection-info-title" }); title.createEl("strong", { text: presentation.displayName }); title.createSpan({ text: presentation.badge, cls: "dc-host-modal__connection-badge" }); info.createDiv({ text: presentation.description }); info.createDiv({ text: presentation.helper, cls: "docker-connector__muted" }); const details = info.createDiv({ cls: "dc-host-modal__connection-info-details" }); [["Authentication", presentation.authentication], ["Docker API exposure", presentation.apiExposure], ["Recommended for", presentation.recommendedFor]].forEach(([label, value]) => { const item = details.createDiv(); item.createSpan({ text: label }); item.createEl("strong", { text: value }); }); }
  private privateKeyFields(root: HTMLElement): void { new Setting(root).setName(this.privateKeyPath ? "Selected Private Key File" : "Private Key File").setDesc(this.privateKeyPath ? shortPath(this.privateKeyPath) : "Choose an OpenSSH private key file. Only its path is saved.").addButton((button) => button.setButtonText("Browse…").onClick(() => void this.choosePrivateKey())).addButton((button) => button.setButtonText("Generate SSH Key").onClick(() => this.generatePrivateKey())); if (this.keyStatus) root.createDiv({ text: `${this.keyStatus.tone === "success" ? "✓ " : ""}${this.keyStatus.message}`, cls: `dc-host-modal__key-status is-${this.keyStatus.tone}`, attr: { role: "status" } }); if (this.privateKeyPath) new Setting(root).setName("Private-Key Passphrase").setDesc("Required only for encrypted keys. It remains in memory and is never saved.").addText((text) => { text.inputEl.type = "password"; text.inputEl.autocomplete = "current-password"; text.onChange((value) => { this.privateKeyPassphrase = value; this.resolvedPublicKey = undefined; }); }).addButton((button) => button.setButtonText("Validate private key").onClick(() => void this.validateAndRenderPrivateKey())); if (this.resolvedPublicKey?.privateKeyPath === this.privateKeyPath) new Setting(root).setName("Public Key").setDesc(`${this.resolvedPublicKey.fingerprint} · ${this.resolvedPublicKey.source === "matching-file" ? "matching .pub file" : "derived from selected private key"}`).addButton((button) => button.setButtonText("Install public key").setWarning().onClick(() => void this.installPublicKey())); }
  private localFields(root: HTMLElement): void { const unix = this.localEndpoint.type === "unix-socket"; new Setting(root).setName("Endpoint Type").addText((text) => { text.setValue(unix ? "Unix Socket" : "Windows Named Pipe"); text.inputEl.readOnly = true; }); new Setting(root).setName("Docker Endpoint").setDesc("Local Docker Unix socket or Windows named pipe.").addText((text) => text.setValue(localEndpointValue(this.localEndpoint)).onChange((value) => { this.localEndpoint = unix ? { type: "unix-socket", socketPath: value } : { type: "windows-named-pipe", pipePath: value }; })); new Setting(root).addButton((button) => button.setButtonText("Detect Local Docker").onClick(() => void this.detectLocal())); if (this.localStatus) root.createDiv({ text: this.localStatus, cls: "dc-host-modal__key-status", attr: { role: "status" } }); }
  private tlsFields(root: HTMLElement): void { this.text(root, "Docker Host", this.tlsHost, (value) => { this.tlsHost = value; if (!this.tlsServerName && !/[:]/.test(value)) this.tlsServerName = value; }); this.text(root, "Docker API Port", this.tlsPort, (value) => this.tlsPort = value); this.text(root, "Server Name", this.tlsServerName, (value) => this.tlsServerName = value); const files: Array<[string, "tlsCaPath" | "tlsCertPath" | "tlsKeyPath", string, string]> = [["CA Certificate", "tlsCaPath", "Choose CA certificate", "Certificate authority used to verify the Docker server certificate."], ["Client Certificate", "tlsCertPath", "Choose client certificate", "Certificate presented to the Docker server to authenticate Docker Connector."], ["Client Private Key", "tlsKeyPath", "Choose client private key", "Private key associated with the client certificate. Only the file path is saved."]]; files.forEach(([label, field, title, description]) => new Setting(root).setName(label).setDesc(this[field] ? `${description} ${shortPath(this[field])}` : description).addButton((button) => button.setButtonText("Browse…").onClick(() => void this.chooseTlsFile(field, title)))); if (this.tlsKeyPath) new Setting(root).setName("Client-Key Passphrase").setDesc("Optional passphrase for the client private key. Kept in memory for this Obsidian session only.").addText((text) => text.setValue(this.tlsPassphrase).onChange((value) => { this.tlsPassphrase = value; void this.revalidateTls(); })); if (this.tlsValidation) root.createDiv({ text: `TLS files validated · client certificate valid until ${this.tlsValidation.clientCertificateValidTo}`, cls: "dc-host-modal__key-status is-success", attr: { role: "status" } }); else if (this.tlsValidationError) root.createDiv({ text: this.tlsValidationError, cls: "dc-host-modal__key-status is-error", attr: { role: "alert" } }); }
  private contextFields(root: HTMLElement): void { const cli = this.section(root, "Docker CLI"); cli.createDiv({ text: this.contextState, cls: "dc-host-modal__key-status", attr: { role: "status", "aria-live": "polite" } }); new Setting(cli).addButton((button) => { button.setButtonText(this.contexts.length ? "Refresh Contexts" : "Discover Contexts"); button.setDisabled(this.discovering); button.onClick(() => void this.discoverContexts()); }); if (this.editingProfile?.connectionType === "docker-context") this.savedContextDetails(root); if (this.lifecycle) { const status = this.section(root, "Context Status"); status.createEl("strong", { text: contextLifecycleLabel(this.lifecycle.state) }); status.createDiv({ text: this.lifecycle.message ?? "", attr: { role: "status", "aria-live": "polite" } }); this.lifecycle.changes.forEach((change) => status.createDiv({ text: `${change.field}: ${String(change.previousValue ?? "—")} → ${String(change.currentValue ?? "—")} (${change.severity})`, cls: "docker-connector__muted" })); } if (!this.contexts.length) return; const section = this.section(root, "Context"); new Setting(section).setName("Docker Context").addDropdown((dropdown) => { dropdown.addOption("", "Select a context"); this.contexts.forEach((context) => dropdown.addOption(context.name, `${context.name}${context.isCurrent ? " — Current" : ""}${context.supported ? "" : " — Unsupported"}`)); dropdown.setValue(this.selectedContextName ?? "").onChange((value) => { this.selectedContextName = value || undefined; const selected = this.contexts.find((context) => context.name === value); if (selected && !this.name) this.name = selected.name; this.formError = undefined; this.render(); }); }); const selected = this.selectedContext(); if (selected) section.createDiv({ text: `Endpoint: ${selected.dockerEndpoint?.displayHost ?? "Unknown"} · ${selected.dockerEndpoint?.type ?? "unknown"} · ${selected.supported ? "Supported" : "Unsupported"}`, cls: selected.supported ? "dc-host-modal__key-status is-success" : "dc-host-modal__key-status is-warning" }); }
  private savedContextDetails(root: HTMLElement): void { const profile = this.editingProfile as DockerContextProfile; const snapshot = profile.contextSnapshot; const section = this.section(root, "Saved Context Details"); [["Context Name", profile.contextName], ["Description", snapshot.description ?? "—"], ["Endpoint Type", snapshot.endpointType], ["Safe Endpoint", snapshot.endpointDisplay ?? "—"], ["Current When Saved", snapshot.isCurrentWhenSaved ? "Yes" : "No"], ["Supported State", snapshot.supported ? "Supported" : "Unsupported"], ["Imported At", snapshot.importedAt], ["Last Discovered", snapshot.lastDiscoveredAt]].forEach(([name, value]) => new Setting(section).setName(name).setDesc(value)); }
  private async discoverContexts(): Promise<void> { if (this.discovering) return; this.discovering = true; this.discoverySucceeded = false; this.contextState = "Discovering Docker Contexts…"; this.render(); try { const { resolution, contexts } = await desktopUi(this.plugin).discoverContexts(); if (this.dismissed) return; this.contexts = contexts; this.discoverySucceeded = true; this.contextState = this.contexts.length ? `Docker CLI detected · Version ${resolution.version ?? "unknown"} · Contexts available` : `Docker CLI detected · Version ${resolution.version ?? "unknown"} · No contexts found`; if (this.editingProfile?.connectionType === "docker-context") { this.lifecycle = evaluateDockerContextLifecycle(this.editingProfile, contexts, new Date().toISOString()); this.plugin.contextLifecycle.set(this.editingProfile.id, this.lifecycle); } const selectedExists = this.contexts.some((context) => context.name === this.selectedContextName); if (!selectedExists && this.editingProfile?.connectionType === "docker-context") { this.selectedContextName = undefined; this.formError = `The saved Docker Context \"${this.editingProfile.contextName}\" was not found.`; } else if (!selectedExists) this.selectedContextName = this.contexts.find((context) => context.isCurrent)?.name ?? (this.contexts.filter((context) => context.supported).length === 1 ? this.contexts.find((context) => context.supported)?.name : undefined); } catch (error) { if (!this.dismissed) { this.contextState = error instanceof Error ? error.message : "Docker CLI detected, but Docker Contexts could not be discovered."; if (this.editingProfile?.connectionType === "docker-context") { this.lifecycle = unavailableDockerContextLifecycle(this.editingProfile, error, new Date().toISOString()); this.plugin.contextLifecycle.set(this.editingProfile.id, this.lifecycle); } } } finally { this.discovering = false; if (!this.dismissed) this.render(); } }
  private async detectLocal(): Promise<void> { const found = await desktopUi(this.plugin).discoverLocalDockerEndpoints(); if (found.length === 1) { this.localEndpoint = found[0]; this.localStatus = "Local Docker endpoint detected."; } else if (!found.length) this.localStatus = "No local Docker endpoint was detected. Enter a socket or named-pipe path manually."; else this.localStatus = "Multiple local endpoints were detected; enter the preferred endpoint manually."; this.render(); }
  private async choosePrivateKey(): Promise<void> { try { const path = await desktopUi(this.plugin).choosePrivateKey(); if (path) { this.privateKeyPath = path; this.privateKeyPassphrase = ""; this.resolvedPublicKey = undefined; await this.validatePrivateKey(); } } catch (error) { this.keyStatus = { tone: "error", message: error instanceof Error ? error.message : "Private-key file selection failed." }; } this.render(); }
  private generatePrivateKey(): void { new SshKeyGenerationModal(this.plugin, (completed) => { this.privateKeyPath = completed.resolved.privateKeyPath; this.privateKeyPassphrase = completed.passphrase; this.resolvedPublicKey = completed.resolved; this.keyStatus = { tone: "success", message: `Valid Ed25519 private key · ${completed.resolved.fingerprint}` }; this.render(); }).open(); }
  private async installPublicKey(): Promise<void> { try { const resolved = await desktopUi(this.plugin).resolvePublicKeyForPrivateKey(this.privateKeyPath, this.privateKeyPassphrase || undefined); this.resolvedPublicKey = resolved; new SshPublicKeyInstallModal(this.app, this.sshPasswordInstallProfile(), resolved.publicKey, resolved.fingerprint, (result) => { this.keyStatus = { tone: "success", message: result.status === "already-installed" ? "Public key already installed. Test the selected private key before saving." : "Public key installed. Test the selected private key before saving." }; this.render(); }, (fingerprint) => { this.fingerprint = fingerprint; this.hostKeyTrust = new HostKeyTrustSession(fingerprint); this.mismatch = undefined; this.render(); }).open(); } catch (error) { this.resolvedPublicKey = undefined; this.keyStatus = { tone: "error", message: error instanceof Error ? error.message : "Could not resolve the selected public key." }; this.render(); } }
  private sshPasswordInstallProfile(): SshDockerProfile { return { id: this.id, name: this.name.trim() || "SSH key installation", description: this.description.trim() || undefined, category: this.category.trim() || undefined, enabled: this.editingProfile?.enabled ?? true, createdAt: this.createdAt, updatedAt: new Date().toISOString(), connectionType: "ssh", sshHost: this.host.trim(), sshPort: Number(this.port), sshUsername: this.username.trim(), authentication: { type: "password" }, remoteSocketPath: this.socketPath.trim(), hostKeyFingerprint: this.fingerprint }; }
  private async chooseTlsFile(field: "tlsCaPath" | "tlsCertPath" | "tlsKeyPath", title: string): Promise<void> { const path = await desktopUi(this.plugin).chooseFile(title); if (!path) return; this[field] = path; await this.revalidateTls(); }
  private async revalidateTls(): Promise<void> { this.formError = undefined; this.tlsValidation = undefined; this.tlsValidationError = undefined; if (!this.tlsCaPath || !this.tlsCertPath || !this.tlsKeyPath) { this.render(); return; } try { await this.validateTls(); } catch (error) { this.tlsValidationError = error instanceof Error ? error.message : "TLS file validation failed."; } this.render(); }
  private async validateTls(): Promise<void> { this.tlsValidation = await desktopUi(this.plugin).validateDockerTlsFiles({ caCertificatePath: this.tlsCaPath, clientCertificatePath: this.tlsCertPath, clientKeyPath: this.tlsKeyPath, clientKeyPassphrase: this.tlsPassphrase || undefined }); this.tlsValidationError = undefined; }
  private async validateAndRenderPrivateKey(): Promise<void> { await this.validatePrivateKey(); this.render(); }
  private async validatePrivateKey(): Promise<void> { this.resolvedPublicKey = undefined; try { const resolved = await desktopUi(this.plugin).resolvePublicKeyForPrivateKey(this.privateKeyPath, this.privateKeyPassphrase || undefined); this.resolvedPublicKey = resolved; this.keyStatus = { tone: "success", message: "Valid Ed25519 private key" }; } catch (error) { const code = error && typeof error === "object" ? (error as { code?: string }).code : undefined; this.keyStatus = { tone: code === "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED" ? "warning" : "error", message: code === "SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED" ? "Passphrase required" : error instanceof Error ? error.message : "Private key could not be validated." }; } }
  private selectedContext(): DiscoveredDockerContext | undefined { return this.contexts.find((context) => context.name === this.selectedContextName); }
  private canSaveContext(): boolean { return Boolean(this.name.trim() && this.discoverySucceeded && this.selectedContextName && this.contexts.some((context) => context.name === this.selectedContextName) && canSaveDiscoveredDockerContext(this.selectedContext())); }
  private profile(): DockerConnectionProfile { const clean = (value: string) => value.trim().replace(/[\r\n]+/g, ""); if (this.connectionType === "docker-context") return this.editingProfile?.connectionType === "docker-context" ? updateDockerContextProfile({ existingProfile: this.editingProfile, name: this.name, description: this.description, category: this.category, selectedContext: this.selectedContext()!, now: new Date().toISOString() }) : mapDiscoveredDockerContextToProfile({ id: this.id, name: this.name, description: this.description, category: this.category, context: this.selectedContext()!, now: new Date().toISOString() }); if (this.connectionType === "docker-tls") { if (!this.tlsValidation) throw new Error("Validate TLS files before saving."); return desktopUi(this.plugin).createDockerTlsProfile({ id: this.id, name: this.name, description: this.description, category: this.category, host: this.tlsHost, port: Number(this.tlsPort), serverName: this.tlsServerName, caCertificatePath: this.tlsCaPath, clientCertificatePath: this.tlsCertPath, clientKeyPath: this.tlsKeyPath, validation: this.tlsValidation, now: new Date().toISOString(), existing: this.editingProfile?.connectionType === "docker-tls" ? this.editingProfile : undefined }); } const base = { id: this.id, name: this.name.trim(), description: this.description.trim() || undefined, category: this.category.trim() || undefined, enabled: this.editingProfile?.enabled ?? true, createdAt: this.createdAt, updatedAt: new Date().toISOString() }; if (this.connectionType === "local") return { ...base, connectionType: "local", localEndpoint: this.localEndpoint }; return { ...base, connectionType: "ssh", sshHost: clean(this.host), sshPort: Number(this.port), sshUsername: clean(this.username), authentication: this.authentication === "password" ? { type: "password" } : { type: "private-key", privateKeyPath: clean(this.privateKeyPath) }, remoteSocketPath: clean(this.socketPath), hostKeyFingerprint: clean(this.fingerprint) || undefined }; }
  private valid(requireTrustedHostKey = true): boolean { if (!this.name.trim()) this.formError = "Friendly name is required."; else if (this.connectionType === "docker-tls" && !this.tlsValidation) this.formError = "Choose and validate the TLS certificate files before saving."; else if (this.connectionType === "docker-context" && !this.discoverySucceeded) this.formError = "Discover Docker Contexts before saving."; else if (this.connectionType === "docker-context" && !this.selectedContextName) this.formError = "Select a Docker Context to save."; else if (this.connectionType === "docker-context" && !this.contexts.some((context) => context.name === this.selectedContextName)) this.formError = "The selected Docker Context is no longer available."; else if (this.connectionType === "docker-context" && !canSaveDiscoveredDockerContext(this.selectedContext())) this.formError = "The selected Docker Context has an unsupported or unsafe endpoint."; else if (this.connectionType === "local" && !(this.localEndpoint.type === "unix-socket" ? this.localEndpoint.socketPath : this.localEndpoint.pipePath)) this.formError = "Local Docker endpoint is required."; else if (this.connectionType === "ssh" && !this.host.trim()) this.formError = "Host is required."; else if (this.connectionType === "ssh" && !this.username.trim()) this.formError = "Username is required."; else if (requireTrustedHostKey && this.connectionType === "ssh" && !this.hostKeyTrust.canSave) this.formError = "Test Connection successfully after explicitly trusting the SSH host key before saving."; else if (this.connectionType === "ssh" && this.authentication === "password" && !this.password && !this.editingProfile) this.formError = "Password is required."; else if (this.connectionType === "ssh" && this.authentication === "password" && this.rememberPassword && !this.password && !this.passwordRemembered) this.formError = "Enter the SSH password before remembering it on this device."; else if (this.connectionType === "ssh" && this.authentication === "private-key" && !this.privateKeyPath) this.formError = "Private key is required."; else { this.formError = undefined; return true; } return false; }
  private async test(): Promise<void> { await this.runConnectionTest(); }
  private async runConnectionTest(automaticRetryFingerprint?: string): Promise<void> { if (this.testing || !this.validForTest()) { this.render(); return; } this.testing = true; try { const profile = this.profile(); const credential = profile.connectionType === "ssh" ? profile.authentication.type === "password" ? this.password : this.privateKeyPassphrase || undefined : undefined; this.lastResult = await this.plugin.testConnection(profile, credential); const trust = this.hostKeyTrust.receive(this.lastResult, automaticRetryFingerprint); this.mismatch = trust.mismatch; this.render(); if (trust.pendingFingerprint) this.openTrustModal(trust.pendingFingerprint); else if (trust.mismatch) this.openMismatchModal(trust.mismatch); } catch (error) { this.formError = error instanceof Error ? error.message : "Connection test failed."; this.render(); } finally { this.testing = false; } }
  private openTrustModal(fingerprint: string): void { new SshHostKeyTrustModal(this.app, { host: this.host, port: Number(this.port), fingerprint, onTrust: () => { const retry = this.hostKeyTrust.trustAndRetry(); if (!retry) return; this.fingerprint = retry; this.mismatch = undefined; this.render(); void this.runConnectionTest(retry); }, onCancel: () => this.hostKeyTrust.cancel() }).open(); }
  private openMismatchModal(mismatch: NonNullable<HostKeyTrustWorkflowState["mismatch"]>): void { new SshHostKeyMismatchModal(this.app, { host: this.host, port: Number(this.port), trustedFingerprint: mismatch.trustedFingerprint, receivedFingerprint: mismatch.receivedFingerprint }).open(); }
  private validForTest(): boolean { if (this.connectionType === "docker-tls" && this.tlsValidationError) { this.formError = this.tlsValidationError; return false; } return this.valid(false); }
  private async save(): Promise<void> { if (this.connectionType === "docker-tls") { try { await this.validateTls(); } catch (error) { this.formError = error instanceof Error ? error.message : "TLS file validation failed."; this.render(); return; } } if (!this.valid()) { this.render(); return; } try { const profile = this.profile(); if (this.editingProfile) await this.plugin.hostManager.update(profile); else await this.plugin.hostManager.add(profile); if (profile.connectionType === "ssh" && profile.authentication.type === "password") { if (this.password) this.plugin.setRuntimePassword(this.id, this.password); if (this.rememberPassword && this.password) { await this.plugin.rememberSshPassword(this.id, this.password); this.passwordRemembered = true; } else if (!this.rememberPassword) { await this.plugin.forgetRememberedSshPassword(this.id); this.passwordRemembered = false; } } if (profile.connectionType === "ssh" && profile.authentication.type === "private-key" && this.privateKeyPassphrase) this.plugin.setRuntimePrivateKeyPassphrase(this.id, this.privateKeyPassphrase); if (profile.connectionType === "docker-tls" && this.tlsPassphrase) this.plugin.setRuntimeTlsClientKeyPassphrase(this.id, this.tlsPassphrase); this.close(); if (profile.connectionType === "docker-context") await this.plugin.retryHost(profile); else if (profile.connectionType !== "docker-tls") await this.plugin.refreshAll(); await this.onSaved(); } catch (error) { this.formError = error instanceof Error ? error.message : "Host could not be saved."; this.render(); } }
  private renderDiagnostics(root: HTMLElement, result: import("../connections/DockerTransport").DockerConnectionTestResult): void { const diagnostics = root.createDiv({ cls: "docker-connector__diagnostics dc-host-modal__diagnostics" }); diagnostics.createEl("h4", { text: result.success ? "Connection diagnostics" : `Connection diagnostics: ${result.safeErrorCode ?? "failed"}` }); for (const step of result.steps) diagnostics.createDiv({ text: `${step.status.toUpperCase()} — ${step.label}${step.message ? `: ${step.message}` : ""}`, cls: `docker-connector__diagnostic is-${step.status}` }); }
}

/** Prompts only for the selected session-only authentication credential. */
class ReconnectPasswordModal extends Modal {
  private credential = "";
  private reconnectButton?: HTMLButtonElement;
  private submitting = false;
  constructor(private readonly plugin: DockerConnectorPlugin, private readonly profile: DockerConnectionProfile, private readonly onComplete: () => Promise<void>) { super(plugin.app); }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: `Reconnect ${this.profile.name}` });
    const privateKey = this.profile.connectionType === "ssh" && this.profile.authentication.type === "private-key";
    const tls = this.profile.connectionType === "docker-tls";
    new Setting(this.contentEl).setName(tls ? "Client Key Passphrase" : privateKey ? "Private-Key Passphrase" : "SSH Password").setDesc("Used only in memory for this Obsidian session.").addText((text) => {
      text.inputEl.type = "password";
      text.inputEl.focus();
      text.onChange((value) => this.credential = value);
      // The handler is owned by the input element, which Obsidian removes with
      // the modal content; no listener survives after the dialog closes.
      text.inputEl.onkeydown = (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        void this.submit();
      };
    });
    new Setting(this.contentEl).addButton((button) => {
      button.setButtonText("Reconnect").setCta().onClick(() => void this.submit());
      this.reconnectButton = button.buttonEl;
    });
  }

  private async submit(): Promise<void> {
    if (this.submitting) return;
    if (!this.credential) { new Notice(this.profile.connectionType === "docker-tls" ? "Enter the client-key passphrase to reconnect." : this.profile.connectionType === "ssh" && this.profile.authentication.type === "private-key" ? "Enter the private-key passphrase to reconnect." : "Enter the SSH password to reconnect."); return; }
    this.submitting = true;
    this.reconnectButton?.setAttribute("disabled", "true");
    try {
      await this.plugin.reconnectHost(this.profile, this.credential);
      this.credential = "";
      await this.onComplete();
      this.close();
    } finally {
      this.submitting = false;
      this.reconnectButton?.removeAttribute("disabled");
    }
  }
}

/** Explicit, plugin-only confirmation for deleting a saved connection profile. */
class DeleteConnectionModal extends Modal {
  private deleting = false;
  constructor(private readonly plugin: DockerConnectorPlugin, private readonly profile: DockerConnectionProfile, private readonly onDeleted: () => Promise<void>) { super(plugin.app); }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Delete connection?" });
    this.contentEl.createEl("p", { text: `Remove "${this.profile.name}" from Docker Connector?` });
    this.contentEl.createDiv({ text: `Connection: ${getDockerConnectionTypeDisplayName(this.profile.connectionType)}`, cls: "docker-connector__muted" });
    this.contentEl.createEl("p", { text: "This deletes only the saved Docker Connector connection profile and its cached session data. It does not change or delete anything on the Docker host." });
    this.contentEl.createEl("p", { text: "Containers, images, volumes, networks, SSH keys, TLS certificate files, and Docker Contexts are not deleted.", cls: "docker-connector__muted" });
    if (this.plugin.hasActiveContainerAction(this.profile.id)) this.contentEl.createDiv({ text: "A container operation is currently in progress for this connection. Wait for it to finish before deleting the connection.", cls: "docker-connector__error", attr: { role: "alert" } });
    const footer = this.contentEl.createDiv({ cls: "dc-host-modal__footer" });
    const cancel = footer.createEl("button", { text: "Cancel" }); cancel.onclick = () => this.close();
    const remove = footer.createEl("button", { text: "Delete connection", cls: "mod-warning" });
    remove.disabled = this.plugin.hasActiveContainerAction(this.profile.id);
    remove.onclick = () => void this.delete();
    cancel.focus();
  }
  private async delete(): Promise<void> {
    if (this.deleting) return;
    this.deleting = true;
    try {
      await this.plugin.hostManager.remove(this.profile.id);
      this.close();
      await this.onDeleted();
      new Notice(`Deleted connection "${this.profile.name}" from Docker Connector.`);
    } catch {
      new Notice(`Could not delete connection "${this.profile.name}". The saved profile was not removed.`);
      this.deleting = false;
    }
  }
}

function shortPath(path: string): string { const segments = path.replace(/\\/g, "/").split("/").filter(Boolean); return segments.length > 2 ? `…/${segments.slice(-2).join("/")}` : path; }
function connectionSummary(profile: DockerConnectionProfile): string { if (profile.connectionType === "ssh") return `${profile.sshHost}:${profile.sshPort}`; if (profile.connectionType === "docker-context") return `${profile.contextName} · ${profile.contextSnapshot.endpointDisplay ?? profile.contextSnapshot.endpointType}`; if (profile.connectionType === "docker-tls") return `${profile.host}:${profile.port}`; return profile.localEndpoint.type === "unix-socket" ? profile.localEndpoint.socketPath : profile.localEndpoint.pipePath; }
function localEndpointValue(endpoint: import("../connections/LocalEndpointDiscovery").LocalDockerEndpoint): string { return endpoint.type === "unix-socket" ? endpoint.socketPath : endpoint.pipePath; }
