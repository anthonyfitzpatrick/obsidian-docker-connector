import { Notice, setIcon } from "obsidian";
import type DockerConnectorPlugin from "../main";
import type {
  DockerConnectionProfile,
  DockerHostSnapshot,
} from "../models/DockerConnectionProfile";
import {
  activeFilterLabels,
  resultCountText,
  selectContainers,
  uniqueNetworks,
  updateKey,
} from "./ContainerSelectors";
import { dockerResourceKey, selectedInventorySnapshots } from "../models/DockerHostSnapshotSelection";
import {
  DEFAULT_CONTAINERS_VIEW_STATE,
  type ContainerDensity,
  type ContainerSortMode,
  type ContainersViewState,
  type DockerContainerDetails,
  type DockerContainerHealth,
  type DockerContainerStateFilter,
  type DockerContainerSummary,
} from "./ContainerModels";
import { renderMetricCards } from "../ui/MetricCards";
import { connectionCapabilities } from "../connections/DockerConnectionCapabilities";
import { getContainerActionCapabilities } from "./ContainerActionCapabilities";
import { getContainerUpdateEligibility } from "../services/ContainerUpdatePlan";
import { ContainerUpdateDialog } from "./ContainerUpdateDialog";

/** Interactive read-only container inventory. Documentation: [[Docker Connector - Containers View]]. */
export class ContainersTab {
  readonly state: ContainersViewState = {
    ...DEFAULT_CONTAINERS_VIEW_STATE,
    detailState: { status: "closed" },
  };
  private searchTimer?: number;
  private detailOrigin?: HTMLElement;
  constructor(
    private readonly plugin: DockerConnectorPlugin,
    private readonly rerender: () => void,
  ) {
    this.state.density = plugin.settings.containerDensity;
  }
  dispose(): void {
    if (this.searchTimer) window.clearTimeout(this.searchTimer);
  }
  route(filter?: DockerContainerStateFilter, containerId?: string): void {
    if (filter) this.state.stateFilter = filter;
    if (containerId) this.state.selectedContainerId = containerId;
  }

  render(root: HTMLElement, selectedHostId: string): void {
    const profiles = this.profiles(selectedHostId);
    const snapshots = selectedInventorySnapshots(
      this.plugin.settings.profiles,
      this.plugin.snapshots,
      selectedHostId,
    );
    const all = snapshots.flatMap((snapshot) => snapshot.containers);
    const availableUpdateKeys = new Set(
      all.flatMap((container) =>
        this.plugin.containerImageUpdateStatus(
          container.hostProfileId,
          container.id,
        )?.state === "available"
          ? [updateKey(container.hostProfileId, container.id)]
          : [],
      ),
    );
    const results = selectContainers(all, this.state, availableUpdateKeys);
    this.reconcileUpdateFilterSelection(results);
    const hostLabel =
      selectedHostId === "all"
        ? "All Docker hosts"
        : (profiles[0]?.name ?? "Selected host");
    root.addClass("dc-containers-tab");
    this.header(root, hostLabel, all, results, snapshots);
    this.metrics(root, all, availableUpdateKeys.size);
    this.toolbar(root, all, profiles);
    this.activeFilters(root);
    if (snapshots.some((snapshot) => snapshot.stale)) {
      const stale = root.createDiv({
        cls: "dc-container-stale",
        attr: { role: "status" },
      });
      stale.createSpan({
        text: "Container refresh failed. Showing the latest valid data.",
      });
      const retry = stale.createEl("button", { text: "Retry" });
      retry.onclick = () =>
        void Promise.all(
          profiles.map((profile) => this.plugin.retryHost(profile)),
        );
    }
    this.results(root, profiles, snapshots, all, results);
  }

  private header(
    root: HTMLElement,
    hostLabel: string,
    all: DockerContainerSummary[],
    results: DockerContainerSummary[],
    snapshots: DockerHostSnapshot[],
  ): void {
    const header = root.createDiv({
      cls: "dc-container-header docker-connector__containers-header",
    });
    const copy = header.createDiv();
    copy.createEl("h1", { text: "Containers" });
    copy.createDiv({
      text: resultCountText(results.length, all.length),
      cls: "dc-container-result-count",
      attr: { "aria-live": "polite" },
    });
    copy.createSpan({ text: hostLabel, cls: "docker-connector__muted" });
  }
  private metrics(
    root: HTMLElement,
    all: DockerContainerSummary[],
    availableCount: number,
  ): void {
    const running = all.filter((item) => item.state === "running").length;
    const stopped = all.filter((item) =>
      ["exited", "dead", "created"].includes(item.state),
    ).length;
    renderMetricCards(
      root,
      [
        {
          label: "Containers",
          value: all.length,
          detail: "All container states",
          icon: "container",
          active: this.state.stateFilter === "all",
          onClick: () => {
            this.state.stateFilter = "all";
            this.rerender();
          },
        },
        {
          label: "Running",
          value: running,
          detail: "Currently running",
          icon: "circle-play",
          tone: "success",
          active: this.state.stateFilter === "running",
          onClick: () => {
            this.state.stateFilter = "running";
            this.rerender();
          },
        },
        {
          label: "Stopped",
          value: stopped,
          detail: "Not currently running",
          icon: "circle-stop",
          tone: "muted",
          active: this.state.stateFilter === "stopped",
          onClick: () => {
            this.state.stateFilter = "stopped";
            this.rerender();
          },
        },
        {
          label: "Updates Available",
          value: availableCount,
          detail: availableCount
            ? "Containers needing updates"
            : "Everything is up to date.",
          icon: "arrow-up-circle",
          tone: availableCount ? "warning" : "muted",
          active: this.state.updatesOnly,
          ariaLabel: "Show only containers with available updates",
          onClick: () => {
            this.state.updatesOnly = !this.state.updatesOnly;
            this.rerender();
          },
        },
      ],
      "Container summary",
    );
  }
  private toolbar(
    root: HTMLElement,
    all: DockerContainerSummary[],
    profiles: DockerConnectionProfile[],
  ): void {
    const toolbar = root.createDiv({
      cls: "dc-container-toolbar docker-connector__containers-toolbar",
    });
    const search = toolbar.createDiv({ cls: "dc-container-search" });
    const icon = search.createSpan();
    setIcon(icon, "search");
    const input = search.createEl("input", {
      type: "search",
      value: this.state.searchQuery,
      placeholder: "Search containers…",
      attr: { "aria-label": "Search containers" },
    });
    input.oninput = () => {
      if (this.searchTimer) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.state.searchQuery = input.value;
        this.rerender();
      }, 180);
    };
    input.onkeydown = (event) => {
      if (event.key === "Escape") {
        input.value = "";
        this.state.searchQuery = "";
        this.rerender();
      }
    };
    if (this.state.searchQuery) {
      const clear = search.createEl("button", {
        attr: { "aria-label": "Clear container search", title: "Clear search" },
      });
      setIcon(clear, "x");
      clear.onclick = () => {
        this.state.searchQuery = "";
        this.rerender();
      };
    }
    this.select(
      toolbar,
      "State",
      this.state.stateFilter,
      [
        ["all", "All states"],
        ["running", "Running"],
        ["stopped", "Stopped"],
        ["exited", "Exited"],
        ["created", "Created"],
        ["paused", "Paused"],
        ["restarting", "Restarting"],
        ["removing", "Removing"],
        ["dead", "Dead"],
        ["unknown", "Unknown"],
      ],
      (value) => {
        this.state.stateFilter = value as DockerContainerStateFilter;
        this.rerender();
      },
    );
    const healthKnown = all.some((container) => container.health !== "none");
    this.select(
      toolbar,
      "Health",
      this.state.healthFilter,
      [
        ["all", "All health"],
        ["healthy", "Healthy"],
        ["unhealthy", "Unhealthy"],
        ["starting", "Starting"],
        ["none", "No health check"],
        ["unknown", "Unknown"],
      ],
      (value) => {
        this.state.healthFilter = value as typeof this.state.healthFilter;
        this.rerender();
      },
      !healthKnown,
    );
    this.select(
      toolbar,
      "Network",
      this.state.networkFilter ?? "all",
      [
        ["all", "All networks"],
        ...uniqueNetworks(all).map((name) => [name, name] as [string, string]),
      ],
      (value) => {
        this.state.networkFilter = value === "all" ? null : value;
        this.rerender();
      },
    );
    this.select(
      toolbar,
      "Sort",
      this.state.sortMode,
      [
        ["name-asc", "Name A–Z"],
        ["name-desc", "Name Z–A"],
        ["state", "State"],
        ["health", "Health"],
        ["created-newest", "Created newest"],
        ["created-oldest", "Created oldest"],
        ["image-asc", "Image A–Z"],
        ["uptime-longest", "Uptime longest"],
        ["uptime-shortest", "Uptime shortest"],
        ["restart-highest", "Restart count highest"],
        ["restart-lowest", "Restart count lowest"],
      ],
      (value) => {
        this.state.sortMode = value as ContainerSortMode;
        this.rerender();
      },
    );
    const density = toolbar.createDiv({
      cls: "dc-container-density",
      attr: { role: "group", "aria-label": "Container density" },
    });
    (["comfortable", "compact"] as ContainerDensity[]).forEach((mode) => {
      const button = density.createEl("button", {
        text: mode === "comfortable" ? "Comfortable" : "Compact",
        cls: this.state.density === mode ? "is-active" : "",
        attr: { "aria-pressed": String(this.state.density === mode) },
      });
      button.onclick = async () => {
        this.state.density = mode;
        this.plugin.settings.containerDensity = mode;
        await this.plugin.saveSettings();
        this.rerender();
      };
    });
    const refresh = toolbar.createEl("button", {
      cls: "dc-container-refresh",
      attr: { "aria-label": "Refresh selected Docker host", title: "Refresh" },
    });
    setIcon(refresh, "refresh-cw");
    refresh.onclick = async () => {
      refresh.disabled = true;
      await Promise.all(
        profiles.map((profile) => this.plugin.retryHost(profile)),
      );
      refresh.disabled = false;
      this.reconcileSelection();
      this.rerender();
    };
  }
  private activeFilters(root: HTMLElement): void {
    const active = activeFilterLabels(this.state);
    if (!active.length) return;
    const bar = root.createDiv({
      cls: "dc-active-filters",
      attr: { "aria-label": "Active container filters" },
    });
    bar.createSpan({ text: "Active filters" });
    active.forEach((filter) => {
      const chip = bar.createEl("button", {
        text: `${filter.label} ×`,
        attr: { "aria-label": `Remove ${filter.label} filter` },
      });
      chip.onclick = () => {
        if (filter.id === "search") this.state.searchQuery = "";
        if (filter.id === "state") this.state.stateFilter = "all";
        if (filter.id === "health") this.state.healthFilter = "all";
        if (filter.id === "network") this.state.networkFilter = null;
        if (filter.id === "updates") this.state.updatesOnly = false;
        this.rerender();
      };
    });
    const clear = bar.createEl("button", {
      text: "Clear all",
      cls: "dc-clear-filters",
    });
    clear.onclick = () => {
      Object.assign(this.state, {
        ...DEFAULT_CONTAINERS_VIEW_STATE,
        density: this.state.density,
        detailState: this.state.detailState,
      });
      this.rerender();
    };
  }
  private results(
    root: HTMLElement,
    profiles: DockerConnectionProfile[],
    snapshots: DockerHostSnapshot[],
    all: DockerContainerSummary[],
    results: DockerContainerSummary[],
  ): void {
    const panel = root.createDiv({
      cls: `dc-container-results docker-connector__containers-results is-${this.state.density}`,
    });
    const offline = profiles.find(
      (profile) => this.plugin.snapshots.get(profile.id)?.status === "offline",
    );
    const auth = profiles.find(
      (profile) =>
        this.plugin.snapshots.get(profile.id)?.status ===
        "authentication-required",
    );
    if (!profiles.length) {
      this.empty(panel, "Select a Docker host to view containers.");
      return;
    }
    if (!snapshots.length && auth) {
      this.empty(panel, "Reconnect to this Docker host to load containers.");
      return;
    }
    if (!snapshots.length && offline) {
      this.empty(panel, "The selected Docker host is offline.");
      return;
    }
    if (!all.length) {
      this.empty(
        panel,
        this.hasFilters()
          ? "No containers match the current filters."
          : "No containers were returned by this Docker host.",
      );
      return;
    }
    if (!results.length) {
      if (this.state.updatesOnly) {
        this.empty(
          panel,
          "Everything is up to date",
          false,
          "No containers currently have a newer image available.",
        );
        return;
      }
      this.empty(
        panel,
        this.state.searchQuery
          ? "No containers match your search."
          : "No containers match the current filters.",
        true,
      );
      return;
    }
    const layout = panel.createDiv({
      cls: `dc-container-layout docker-connector__containers-layout${this.state.selectedContainerId ? " is-detail-open" : ""}`,
    });
    const list = layout.createDiv({
      cls: "dc-container-list docker-connector__containers-list",
      attr: { "aria-label": "Container results" },
    });
    results.forEach((container) => this.row(list, container));
    if (
      this.state.selectedContainerId &&
      this.state.detailState.status === "closed"
    ) {
      const selected = all.find(
        (container) => this.matchesSelected(container),
      );
      if (selected) void this.openDetails(selected, list);
    }
    if (this.state.selectedContainerId)
      this.detail(layout, profiles, snapshots);
  }
  private row(root: HTMLElement, container: DockerContainerSummary): void {
    const selected = this.matchesSelected(container);
    const row = root.createEl("button", {
      cls: `docker-connector__container-card${selected ? " is-selected" : ""}`,
      attr: {
        "aria-label": `${container.displayName}, ${container.state}, ${container.health}`,
        "aria-pressed": String(selected),
      },
    });
    row.onclick = () => void this.openDetails(container, row);
    const header = row.createDiv({
      cls: "docker-connector__container-card-header",
    });
    const identity = header.createDiv({
      cls: "docker-connector__container-card-identity",
    });
    const state = identity.createSpan({
      cls: `dc-container-state-dot container-${container.state}`,
    });
    setIcon(state, stateIcon(container.state));
    identity.createEl("strong", {
      text: container.displayName,
      cls: "docker-connector__container-card-name",
    });
    const badges = header.createDiv({
      cls: "docker-connector__container-card-badges",
    });
    badges.appendChild(badge(container.state, stateLabel(container)));
    badges.appendChild(badge(container.health, healthLabel(container.health)));
    const secondary = row.createDiv({
      cls: "docker-connector__container-card-secondary docker-connector__muted",
    });
    secondary.createSpan({
      text: `Image · ${displayImage(container.image)}`,
      attr: { title: container.image },
    });
    const id = row.createSpan({
      text: container.shortId,
      cls: "docker-connector__container-card-id dc-container-id",
      attr: {
        "aria-label": `Copy full ID for ${container.displayName}`,
        role: "button",
        tabindex: "0",
      },
    });
    const copyId = (event: Event) => {
      event.stopPropagation();
      void navigator.clipboard.writeText(container.id);
      new Notice("Container ID copied");
    };
    id.onclick = copyId;
    id.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        copyId(event);
      }
    };
    const metadata = row.createDiv({
      cls: "docker-connector__container-card-metadata",
    });
    metadata.createSpan({
      text: container.statusText,
      cls: "docker-connector__container-card-status",
    });
    if (container.restartCount && container.restartCount > 0)
      metadata.createSpan({
        text: `${container.restartCount} restarts`,
        cls: "docker-connector__container-card-restarts",
      });
    if (this.state.density === "comfortable") {
      const host = this.plugin.settings.profiles.find(
        (profile) => profile.id === container.hostProfileId,
      );
      metadata.createSpan({
        text: `Host · ${host?.name ?? container.hostProfileId}`,
        cls: "docker-connector__container-card-host",
      });
      metadata.createSpan({
        text: networksText(container),
        cls: "docker-connector__container-card-network",
      });
      metadata.createSpan({
        text: portsText(container.ports),
        cls: "docker-connector__container-card-ports",
      });
      metadata.createSpan({
        text: container.createdTimestamp
          ? `Created ${relativeUnix(container.createdTimestamp)}`
          : "Unknown time",
        cls: "docker-connector__container-card-created",
      });
    }
  }
  private detail(
    root: HTMLElement,
    profiles: DockerConnectionProfile[],
    snapshots: DockerHostSnapshot[],
  ): void {
    const id = this.state.selectedContainerId!;
    const summary = snapshots
      .flatMap((snapshot) => snapshot.containers)
      .find((container) => this.matchesSelected(container, id));
    if (!summary) {
      this.closeDetail();
      return;
    }
    const profile = profiles.find((item) => item.id === summary.hostProfileId);
    const snapshot = snapshots.find(
      (item) => item.hostId === summary.hostProfileId,
    );
    if (!profile || !snapshot) return;
    const panel = root.createEl("aside", {
      cls: "dc-container-detail-panel docker-connector__containers-detail",
      attr: {
        "aria-label": `Details for ${summary.displayName}`,
        tabindex: "-1",
      },
    });
    const head = panel.createDiv({ cls: "dc-container-detail-header" });
    const copy = head.createDiv();
    copy.createEl("h2", { text: summary.displayName });
    copy.createSpan({ text: summary.image, cls: "docker-connector__muted" });
    head.appendChild(badge(summary.state, stateLabel(summary)));
    const copyId = head.createEl("button", {
      attr: {
        "aria-label": "Copy full container ID",
        title: "Copy container ID",
      },
    });
    setIcon(copyId, "copy");
    copyId.onclick = () => {
      void navigator.clipboard.writeText(summary.id);
      new Notice("Container ID copied");
    };
    const refresh = head.createEl("button", {
      attr: {
        "aria-label": "Refresh container details",
        title: "Refresh details",
      },
    });
    setIcon(refresh, "refresh-cw");
    refresh.onclick = () =>
      void this.loadDetail(profile, snapshot, summary, true);
    const close = head.createEl("button", {
      attr: { "aria-label": "Close container details", title: "Close details" },
    });
    setIcon(close, "x");
    close.onclick = () => this.closeDetail();
    panel.onkeydown = (event) => {
      if (event.key === "Escape") this.closeDetail();
    };
    if (this.state.detailState.status === "loading") {
      panel.createDiv({
        text: "Loading read-only inspection details…",
        cls: "dc-container-loading",
        attr: { "aria-live": "polite" },
      });
      return;
    }
    if (this.state.detailState.status === "error") {
      panel.createDiv({
        text: this.state.detailState.error,
        cls: "dc-container-error",
      });
      const retry = panel.createEl("button", { text: "Retry details" });
      retry.onclick = () =>
        void this.loadDetail(profile, snapshot, summary, true);
      return;
    }
    if (this.state.detailState.status === "ready")
      this.detailSections(
        panel,
        this.state.detailState.details,
        summary,
        profile,
        snapshot,
      );
  }
  private detailSections(
    panel: HTMLElement,
    details: DockerContainerDetails,
    summary: DockerContainerSummary,
    profile: DockerConnectionProfile,
    snapshot: DockerHostSnapshot,
  ): void {
    this.actions(panel, details, summary, profile, snapshot);
    this.detailSection(panel, "Overview", [
      ["Image", displayImage(details.image)],
      ["Created", formatDate(details.createdAt)],
      ["Docker host", profile.name],
    ]);
    this.detailSection(
      panel,
      "State",
      [
        ["State", details.state.status],
        ["Started", formatDate(details.state.startedAt)],
        ["Restart count", details.state.restartCount?.toString()],
        ["Health", details.state.health?.status],
        ["Exit code", details.state.exitCode?.toString()],
      ],
      false,
    );
    this.detailSection(
      panel,
      "Configuration",
      [
        ["Entrypoint", details.entrypoint.join(" ")],
        ["Command", details.command],
        ["Arguments", details.args.join(" ")],
        ["Working directory", details.workingDirectory],
        ["Configured user", details.configuredUser],
        ["Restart policy", details.restartPolicy?.name],
        ["Read-only filesystem", boolText(details.readOnlyRootFilesystem)],
        ["Privileged", boolText(details.privileged)],
      ],
      true,
    );
    const networkRows: Array<[string, string | undefined]> =
      details.networks.flatMap(
        (network): Array<[string, string | undefined]> => [
          [
            network.name,
            network.ipAddress
              ? `IP: ${network.ipAddress}${network.gateway ? ` · Gateway: ${network.gateway}` : ""}`
              : "No IP reported",
          ],
          ...(network.aliases.length
            ? [["Aliases", network.aliases.join(", ")] as [string, string]]
            : []),
        ],
      );
    this.detailSection(panel, "Networking", networkRows, true);
    this.detailSection(
      panel,
      "Storage",
      details.mounts.map((mount): [string, string] => [
        `${mount.type}: ${mount.destination}`,
        [
          mount.name ?? mount.source,
          mount.readOnly ? "read-only" : "read/write",
        ]
          .filter(Boolean)
          .join(" · "),
      ]),
      true,
    );
    const metadataRows: Array<[string, string | undefined]> = [
      ["Compose project", details.labels["com.docker.compose.project"]],
      ["Compose service", details.labels["com.docker.compose.service"]],
      [
        "Environment variable names",
        details.environmentVariableNames.join(", ") || "None reported",
      ],
      ...Object.entries(details.labels).map(
        ([key, value]): [string, string] => [key, value],
      ),
    ];
    this.detailSection(panel, "Metadata", metadataRows, true);
    const diagnostics = panel.createEl("details", {
      cls: "dc-container-detail-section",
    });
    diagnostics.createEl("summary", { text: "Safe diagnostics" });
    diagnostics.createDiv({ text: `Host profile: ${profile.id}` });
    diagnostics.createDiv({ text: `Snapshot: ${snapshot.refreshedAt}` });
    diagnostics.createDiv({
      text: `Inspect endpoint: /containers/${summary.id}/json`,
    });
    details.mapperWarnings.forEach((warning) =>
      diagnostics.createDiv({ text: warning, cls: "docker-connector__muted" }),
    );
  }
  private actions(
    panel: HTMLElement,
    details: DockerContainerDetails,
    summary: DockerContainerSummary,
    profile: DockerConnectionProfile,
    snapshot: DockerHostSnapshot,
  ): void {
    const section = panel.createEl("section", {
      cls: "dc-container-detail-section dc-container-actions",
      attr: { "aria-label": "Container actions" },
    });
    section.createEl("h3", { text: "Actions" });
    const active = this.plugin.containerActionState(profile.id, summary.id);
    const updateEligibility = getContainerUpdateEligibility(
      summary.image,
      details.labels,
    );
    const inProgress = Boolean(
      active && !["failed", "succeeded", "idle"].includes(active.state),
    );
    const managementEnabled = this.plugin.isProfileManagementEnabled(
      profile.id,
    );
    const capabilities = getContainerActionCapabilities({
      managementEnabled,
      hostStatus: snapshot.status,
      connection: connectionCapabilities(profile),
      containerState: summary.state,
      activeAction: inProgress,
      updateEligibility,
    });
    if (!managementEnabled) {
      section.createDiv({
        text: "Read-only mode. Enable Container management for this connection on its Connections card to change containers.",
        cls: "docker-connector__muted",
      });
      return;
    }
    section.createDiv({
      text: "Container management enabled",
      cls: "dc-container-action-status",
    });
    const controls = section.createDiv({
      cls: "dc-container-action-controls",
      attr: {
        role: "group",
        "aria-label": `Actions for ${summary.displayName}`,
      },
    });
    const handlers: Record<string, () => Promise<void>> = {};
    const add = (
      actionKey: string,
      label: string,
      icon: string,
      variant: string,
      action: () => Promise<void>,
      enabled: boolean,
      reason?: string,
    ) => {
      handlers[actionKey] = action;
      const button = controls.createEl("button", {
        cls: `dc-container-action-button is-${variant}`,
        attr: {
          "aria-label": `${label} ${summary.displayName}`,
          title: enabled
            ? `${label} this container.`
            : (reason ?? "Unavailable"),
          ...(!enabled && reason
            ? { "aria-describedby": `dc-action-reason-${summary.id}` }
            : {}),
        },
      });
      const image = button.createSpan({
        cls: "dc-container-action-icon",
        attr: { "aria-hidden": "true" },
      });
      setIcon(image, icon);
      button.createSpan({ text: label });
      button.disabled = !enabled || inProgress;
      button.onclick = () => void action();
    };
    if (["running", "restarting"].includes(summary.state)) {
      add(
        "shutdown",
        "Shut down",
        "power",
        "shutdown",
        () =>
          this.confirmAction(
            "Shut down container gracefully?",
            summary,
            profile,
            () => this.plugin.stopContainer(profile, summary.id, 30, true),
          ),
        capabilities.canShutdown,
        capabilities.reason,
      );
      add(
        "stop",
        "Stop",
        "square",
        "stop",
        () =>
          this.confirmAction("Stop container?", summary, profile, () =>
            this.plugin.stopContainer(profile, summary.id, 10),
          ),
        capabilities.canStop,
        capabilities.reason,
      );
      add(
        "restart",
        "Restart",
        "rotate-cw",
        "restart",
        () =>
          this.confirmAction("Restart container?", summary, profile, () =>
            this.plugin.restartContainer(profile, summary.id, 10),
          ),
        capabilities.canRestart,
        capabilities.reason,
      );
    } else
      add(
        "start",
        "Start",
        "play",
        "start",
        () =>
          this.confirmAction("Start container?", summary, profile, () =>
            this.plugin.startContainer(profile, summary.id),
          ),
        capabilities.canStart,
        capabilities.reason,
      );
    this.imageUpdate(
      section,
      profile,
      summary,
      capabilities.canUpdate,
      capabilities.updateReason ?? capabilities.reason,
    );
    if (inProgress && active)
      section.createDiv({
        text: `${title(active.state)}…`,
        cls: "dc-container-action-progress",
        attr: { "aria-live": "polite" },
      });
    if (active?.state === "failed" && active.failure) {
      const failure = section.createDiv({
        cls: "dc-container-action-failure",
        attr: { role: "alert" },
      });
      failure.createEl("strong", { text: "Action failed" });
      failure.createDiv({
        text: `Could not ${active.failure.action} “${summary.displayName}”.`,
      });
      failure.createDiv({ text: active.failure.safeMessage });
      failure.createSpan({
        text: active.failure.safeDetails?.httpStatus
          ? `${active.failure.errorCode} · HTTP ${active.failure.safeDetails.httpStatus}`
          : active.failure.errorCode,
        cls: "docker-connector__muted",
      });
      const actions = failure.createDiv({
        cls: "dc-container-action-failure-actions",
      });
      const retry = handlers[active.failure.action];
      if (retry) {
        const button = actions.createEl("button", {
          text: "Retry",
          attr: {
            "aria-label": `Retry ${active.failure.action} for ${summary.displayName}`,
          },
        });
        button.onclick = () => void retry();
      }
      const diagnostics = failure.createEl("details");
      diagnostics.createEl("summary", { text: "View diagnostics" });
      diagnostics.createDiv({ text: `Profile: ${profile.id}` });
      diagnostics.createDiv({ text: `Action: ${active.failure.action}` });
      diagnostics.createDiv({ text: `Container: ${summary.shortId}` });
      diagnostics.createDiv({ text: `Error: ${active.failure.errorCode}` });
      if (active.failure.safeDetails?.httpStatus)
        diagnostics.createDiv({
          text: `HTTP status: ${active.failure.safeDetails.httpStatus}`,
        });
      if (active.failure.safeDetails?.dockerMessage)
        diagnostics.createDiv({
          text: active.failure.safeDetails.dockerMessage,
        });
    }
  }
  private imageUpdate(
    section: HTMLElement,
    profile: DockerConnectionProfile,
    summary: DockerContainerSummary,
    eligible: boolean,
    eligibilityReason?: string,
  ): void {
    const status = this.plugin.containerImageUpdateStatus(
      profile.id,
      summary.id,
    ) ?? {
      profileId: profile.id,
      containerId: summary.id,
      containerName: summary.displayName,
      imageReference: summary.image,
      state: "not-checked" as const,
    };
    const panel = section.createEl("section", {
      cls: "dc-container-image-update",
      attr: { "aria-label": "Image update" },
    });
    panel.createEl("h4", { text: "Image update" });
    const check = async () => {
      const pending = this.plugin.checkContainerImageUpdate(
        profile,
        summary.id,
        true,
      );
      this.rerender();
      await pending;
      this.rerender();
    };
    const row = (
      icon: string,
      titleText: string,
      description: string,
      live = false,
    ) => {
      const head = panel.createDiv({
        cls: "dc-container-image-update-status",
        attr: live ? { "aria-live": "polite" } : {},
      });
      const glyph = head.createSpan({ attr: { "aria-hidden": "true" } });
      setIcon(glyph, icon);
      const text = head.createDiv();
      text.createEl("strong", { text: titleText });
      text.createSpan({ text: description, cls: "docker-connector__muted" });
    };
    const add = (
      label: string,
      action: () => Promise<void>,
      disabled = false,
      variant?: string,
    ) => {
      const button = panel.createEl("button", {
        text: label,
        cls: `dc-container-action-button${variant ? ` is-${variant}` : ""}`,
        attr: { "aria-label": `${label} for ${summary.displayName}` },
      });
      button.disabled = disabled;
      button.onclick = () => void action();
    };
    if (status.state === "not-checked") {
      row(
        "circle-help",
        "Update status not checked",
        "Docker Connector has not yet checked this image.",
      );
      add("Check now", check);
      return;
    }
    if (status.state === "checking") {
      row(
        "loader-circle",
        "Checking for updates…",
        "Docker Connector is checking the configured image.",
        true,
      );
      if (status.lastCheckedAt)
        panel.createDiv({
          text: `Last checked: ${formatDate(status.lastCheckedAt)}`,
          cls: "docker-connector__muted",
        });
      add("Check now", check, true);
      return;
    }
    if (status.state === "available") {
      row(
        "arrow-up-circle",
        "Update available",
        "A different image ID is available.",
      );
      this.updateRows(panel, status);
      if (eligible)
        add(
          "Update",
          async () => {
            new ContainerUpdateDialog(
              this.plugin,
              profile,
              summary,
              (newId) => {
                if (newId) {
                  this.state.selectedContainerId = newId;
                  this.state.detailState = { status: "closed" };
                }
                this.rerender();
              },
            ).open();
          },
          false,
          "update",
        );
      else
        row(
          "ban",
          "Update unavailable",
          eligibilityReason ?? "This container cannot be safely updated.",
        );
      add("Check again", check);
      return;
    }
    if (status.state === "current") {
      row("circle-check", "Image is current", "No newer image is available.");
      this.updateRows(panel, status);
      add("Check now", check);
      return;
    }
    if (status.state === "error") {
      row(
        "triangle-alert",
        "Could not check for updates",
        status.safeMessage ?? "The configured image could not be checked.",
      );
      if (status.errorCode)
        panel.createDiv({
          text: status.errorCode,
          cls: "docker-connector__muted",
        });
      add("Retry check", check);
      return;
    }
    row(
      "ban",
      "Update unavailable",
      status.safeMessage ?? "This image cannot be checked safely.",
    );
  }
  private updateRows(
    panel: HTMLElement,
    status: {
      imageReference: string;
      currentImageId?: string;
      remoteImageId?: string;
      lastCheckedAt?: string;
      nextCheckAt?: string;
    },
  ): void {
    const rows = panel.createDiv({ cls: "dc-container-image-update-rows" });
    [
      ["Image", status.imageReference],
      [
        "Current image",
        status.currentImageId?.replace(/^sha256:/, "").slice(0, 12),
      ],
      [
        "Available image",
        status.remoteImageId?.replace(/^sha256:/, "").slice(0, 12),
      ],
      ["Last checked", formatDate(status.lastCheckedAt)],
      ["Next check", formatDate(status.nextCheckAt)],
    ]
      .filter(([, value]) => Boolean(value))
      .forEach(([label, value]) => {
        const row = rows.createDiv();
        row.createSpan({ text: label });
        row.createSpan({ text: value! });
      });
  }
  private async confirmAction(
    titleText: string,
    summary: DockerContainerSummary,
    profile: DockerConnectionProfile,
    action: () => Promise<void>,
  ): Promise<void> {
    if (
      !window.confirm(
        `${titleText}\n\nContainer: ${summary.displayName}\nImage: ${displayImage(summary.image)}\nDocker host: ${profile.name}`,
      )
    )
      return;
    try {
      const operation = action();
      this.rerender();
      await operation;
      new Notice(
        `${summary.displayName}: Docker action accepted and refreshed.`,
      );
      this.rerender();
    } catch (error) {
      new Notice(
        error instanceof Error ? error.message : "Docker action failed.",
      );
      this.rerender();
    }
  }
  private detailSection(
    panel: HTMLElement,
    title: string,
    rows: Array<[string, string | undefined]>,
    collapsible = false,
  ): void {
    const section = collapsible
      ? panel.createEl("details", { cls: "dc-container-detail-section" })
      : panel.createEl("section", { cls: "dc-container-detail-section" });
    if (collapsible) section.createEl("summary", { text: title });
    else section.createEl("h3", { text: title });
    const content = section.createDiv();
    rows
      .filter(([, value]) => Boolean(value))
      .forEach(([label, value]) => {
        const row = content.createDiv({ cls: "dc-container-detail-row" });
        row.createSpan({ text: label });
        row.createSpan({ text: value! });
      });
  }
  private async openDetails(
    container: DockerContainerSummary,
    origin: HTMLElement,
  ): Promise<void> {
    this.state.selectedContainerId = this.key(container);
    this.detailOrigin = origin;
    const profile = this.plugin.settings.profiles.find(
      (item) => item.id === container.hostProfileId,
    );
    const snapshot = this.plugin.snapshots.get(container.hostProfileId);
    if (profile && snapshot)
      await this.loadDetail(profile, snapshot, container);
  }
  private async loadDetail(
    profile: DockerConnectionProfile,
    snapshot: DockerHostSnapshot,
    container: DockerContainerSummary,
    force = false,
  ): Promise<void> {
    if (
      !force &&
      this.state.detailState.status === "ready" &&
      this.state.detailState.containerId === this.key(container)
    )
      return;
    this.state.detailState = { status: "loading", containerId: this.key(container) };
    this.rerender();
    try {
      const details = await this.plugin.inspectContainer(
        profile,
        container.id,
        snapshot.refreshedAt,
      );
      this.state.detailState = {
        status: "ready",
        containerId: this.key(container),
        details,
      };
      this.rerender();
    } catch (error) {
      this.state.detailState = {
        status: "error",
        containerId: this.key(container),
        error:
          error instanceof Error
            ? error.message
            : "Container details could not be loaded.",
      };
      this.rerender();
    }
  }
  private closeDetail(): void {
    this.state.selectedContainerId = null;
    this.state.detailState = { status: "closed" };
    this.rerender();
    this.detailOrigin?.focus();
    this.detailOrigin = undefined;
  }
  private reconcileSelection(): void {
    if (
      this.state.selectedContainerId &&
      ![...this.plugin.snapshots.values()].some((snapshot) =>
        snapshot.containers.some(
          (container) => this.matchesSelected(container),
        ),
      )
    )
      this.closeDetail();
  }
  private select(
    root: HTMLElement,
    label: string,
    value: string,
    options: Array<[string, string]>,
    onchange: (value: string) => void,
    disabled = false,
  ): void {
    const control = root.createEl("label", { cls: "dc-container-select" });
    control.createSpan({ text: label });
    const select = control.createEl("select", {
      attr: { "aria-label": `${label} container filter` },
    });
    options.forEach(([optionValue, text]) =>
      select.createEl("option", { value: optionValue, text }),
    );
    select.value = value;
    select.disabled = disabled;
    select.onchange = () => onchange(select.value);
  }
  private reconcileUpdateFilterSelection(
    results: DockerContainerSummary[],
  ): void {
    if (
      !this.state.updatesOnly ||
      !this.state.selectedContainerId ||
      results.some(
          (container) => this.matchesSelected(container),
      )
    )
      return;
    this.state.selectedContainerId = results[0] ? this.key(results[0]) : null;
    this.state.detailState = { status: "closed" };
  }
  private empty(
    root: HTMLElement,
    message: string,
    clear = false,
    detail?: string,
  ): void {
    const empty = root.createDiv({ cls: "dc-container-empty" });
    empty.createSpan({ text: message });
    if (detail)
      empty.createSpan({ text: detail, cls: "docker-connector__muted" });
    if (clear) {
      const button = empty.createEl("button", { text: "Clear filters" });
      button.onclick = () => {
        Object.assign(this.state, {
          ...DEFAULT_CONTAINERS_VIEW_STATE,
          density: this.state.density,
          detailState: this.state.detailState,
        });
        this.rerender();
      };
    }
    if (this.state.updatesOnly && detail) {
      const button = empty.createEl("button", { text: "Show all containers" });
      button.onclick = () => {
        this.state.updatesOnly = false;
        this.rerender();
      };
    }
  }
  private profiles(selectedHostId: string): DockerConnectionProfile[] {
    return selectedHostId === "all"
      ? this.plugin.settings.profiles
      : this.plugin.settings.profiles.filter(
          (profile) => profile.id === selectedHostId,
        );
  }
  private key(container: DockerContainerSummary): string {
    const snapshot = this.plugin.snapshots.get(container.hostProfileId);
    return snapshot
      ? dockerResourceKey(snapshot, container.id)
      : `profile:${container.hostProfileId}\u0000${container.id}`;
  }
  private matchesSelected(container: DockerContainerSummary, selected = this.state.selectedContainerId): boolean {
    return selected === this.key(container) || selected === container.id;
  }
  private hasFilters(): boolean {
    return Boolean(
      this.state.searchQuery ||
      this.state.stateFilter !== "all" ||
      this.state.healthFilter !== "all" ||
      this.state.networkFilter ||
      this.state.updatesOnly,
    );
  }
}

function badge(status: string, label: string): HTMLElement {
  const element = document.createElement("span");
  element.addClass("dc-container-badge", `is-${status}`);
  element.setText(label);
  return element;
}
function stateLabel(container: DockerContainerSummary): string {
  return container.state === "exited" && container.exitCode !== undefined
    ? `Exited (${container.exitCode})`
    : title(container.state);
}
function healthLabel(health: DockerContainerHealth): string {
  return health === "none" ? "No health check" : title(health);
}
function stateIcon(state: string): string {
  return (
    (
      {
        running: "play-circle",
        exited: "stop-circle",
        paused: "pause-circle",
        restarting: "rotate-cw",
        dead: "circle-x",
      } as Record<string, string>
    )[state] ?? "circle-help"
  );
}
function portsText(ports: DockerContainerSummary["ports"]): string {
  if (!ports.length) return "No published ports";
  const visible = ports
    .slice(0, 2)
    .map(
      (port) =>
        `${port.privatePort}/${port.protocol}${port.publicPort ? ` → ${port.ip ?? ""}:${port.publicPort}` : ""}`,
    );
  return `${visible.join(", ")}${ports.length > 2 ? ` · +${ports.length - 2} more` : ""}`;
}
function networksText(container: DockerContainerSummary): string {
  const names = container.networks.slice(0, 2).map((network) => network.name);
  return names.length
    ? `${names.join(", ")}${container.networks.length > 2 ? ` · +${container.networks.length - 2} more` : ""}`
    : "No networks";
}
function displayImage(image: string): string {
  const name = image.split("/").at(-1) ?? image;
  return name || "Unknown image";
}
function relativeUnix(timestamp: number): string {
  return relativeTime(new Date(timestamp * 1000).toISOString());
}
function relativeTime(value: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (!Number.isFinite(seconds)) return "Unknown time";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}
function title(value: string): string {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string | undefined): string | undefined {
  if (!value || Number.isNaN(new Date(value).getTime())) return undefined;
  return new Date(value).toLocaleString();
}
function boolText(value: boolean | undefined): string | undefined {
  return value === undefined ? undefined : value ? "Yes" : "No";
}
