import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DockerHostManager } from "./services/DockerHostManager";
import { DockerInspectionService } from "./services/DockerInspectionService";
import { DockerConnectionFactory } from "./connections/DockerConnectionFactory";
import { DEFAULT_SETTINGS, DockerConnectorSettings, DockerConnectorSettingTab } from "./settings/settings";
import type { DockerConnectionProfile, DockerHostSnapshot } from "./models/DockerConnectionProfile";
import { migrateProfiles } from "./settings/migration";
import { DockerApiClient } from "./services/DockerApiClient";
import { DockerDashboardView, DOCKER_CONNECTOR_VIEW } from "./views/DockerDashboardView";
import { normalizeProfile } from "./utils/profileValidation";
import { ContainerDetailService } from "./services/ContainerDetailService";
import type { DockerContainerDetails } from "./containers/ContainerModels";
import { ImageDetailService } from "./services/ImageDetailService";
import type { DockerImageDetails } from "./images/ImageModels";
import { VolumeDetailService } from "./services/VolumeDetailService";
import type { DockerVolumeDetails } from "./volumes/VolumeModels";
import { PublicImageReleaseService } from "./services/PublicImageReleaseService";
import { DockerContextDiscoveryService } from "./connections/DockerContextDiscovery";
import { DockerContextLifecycleCache, evaluateDockerContextLifecycle, unavailableDockerContextLifecycle } from "./connections/DockerContextLifecycle";
import type { DockerContextProfile } from "./models/DockerConnectionProfile";
import { connectionCapabilities } from "./connections/DockerConnectionCapabilities";
import { DockerContainerActionService, type ContainerActionProgress, type ContainerUpdateProgressEvent } from "./services/DockerContainerActionService";
import { getContainerUpdateEligibility, type ContainerUpdatePreview } from "./services/ContainerUpdatePlan";
import { ContainerImageUpdateService, type ContainerImageUpdateStatus } from "./services/ContainerImageUpdateService";

/** Describes a persisted preference change that an open view may need to reflect. */
export type DockerConnectorSettingsChange = { key: keyof DockerConnectorSettings; previousValue: unknown; value: unknown };

/**
 * Docker Connector plugin entry point.
 *
 * This class owns only Obsidian lifecycle work, persisted non-secret settings,
 * and the current in-memory host snapshots. Transport construction, Docker API
 * policy, and container mutations live in dedicated services so a UI change
 * cannot accidentally expand the plugin's authority.
 *
 * Security notes:
 * - `settings` contains connection metadata only; passwords and passphrases are
 *   held by DockerConnectionFactory's runtime credential store and are cleared
 *   during unload.
 * - The dashboard's visibility is never authorization. The mutation service
 *   rechecks the opt-in setting before every typed action.
 * - Refresh work is best-effort. Failures become bounded host snapshots rather
 *   than rejecting from lifecycle callbacks and destabilising Obsidian.
 */
export default class DockerConnectorPlugin extends Plugin {
  settings: DockerConnectorSettings = DEFAULT_SETTINGS;
  readonly snapshots = new Map<string, DockerHostSnapshot>();
  readonly hostManager = new DockerHostManager(this);
  private readonly connectionFactory = new DockerConnectionFactory();
  private readonly inspectionService = new DockerInspectionService(this.connectionFactory);
  private readonly containerDetailService = new ContainerDetailService(this.connectionFactory);
  private readonly imageDetailService = new ImageDetailService(this.connectionFactory);
  private readonly volumeDetailService = new VolumeDetailService(this.connectionFactory);
  readonly publicImageReleases = new PublicImageReleaseService();
  readonly contextLifecycle = new DockerContextLifecycleCache();
  readonly containerActions = new DockerContainerActionService(this.connectionFactory, () => this.settings.containerManagementEnabled);
  readonly containerImageUpdates = new ContainerImageUpdateService(this.connectionFactory);
  private refreshTimer?: number;
  private refreshGeneration = 0;
  private refreshPromise?: Promise<void>;
  private unloading = false;
  private readonly settingsListeners = new Set<(change: DockerConnectorSettingsChange) => void>();
  private settingsSaveChain: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    try {
      await this.loadSettings();
    } catch {
      // A corrupted data.json must not prevent Obsidian from starting. We keep
      // the safe defaults in memory and let the user repair configuration later.
      this.settings = DEFAULT_SETTINGS;
      new Notice("Docker Connector could not load its saved settings; safe defaults are in use.");
    }
    this.register(this.containerImageUpdates.onStatusChange(() => { if (!this.unloading) this.refreshOpenDashboard(); }));
    this.registerView(DOCKER_CONNECTOR_VIEW, (leaf) => new DockerDashboardView(leaf, this));
    this.addRibbonIcon("container", "Open Docker Connector", () => this.activateDashboard());
    this.addCommand({ id: "open-dashboard", name: "Open dashboard", callback: () => this.activateDashboard() });
    this.addCommand({ id: "refresh-hosts", name: "Refresh all Docker hosts", callback: () => this.refreshAll() });
    this.addSettingTab(new DockerConnectorSettingTab(this.app, this));
    this.configureRefresh();
    void this.refreshAll().catch(() => undefined);
  }

  /**
   * Stops new work before dismantling transports. Active update transactions get
   * a bounded chance to follow their normal cancellation/rollback path; cleanup
   * then clears credentials and caches even if a transport has become unhealthy.
   */
  async onunload(): Promise<void> {
    this.unloading = true;
    if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    await this.containerActions.recoverActiveUpdates();
    this.containerActions.clear();
    this.containerImageUpdates.clearAll();
    this.containerDetailService.clear();
    this.imageDetailService.clear();
    this.volumeDetailService.clear();
    this.publicImageReleases.clear();
    this.contextLifecycle.clear();
    await this.connectionFactory.disconnectAll();
    this.app.workspace.detachLeavesOfType(DOCKER_CONNECTOR_VIEW);
  }
  async loadSettings(): Promise<void> {
    const persisted = await this.loadData() as (Partial<DockerConnectorSettings> & { hosts?: unknown[]; reportFolder?: unknown }) | null;
    const requiresMigration = !Array.isArray(persisted?.profiles) || persisted.profiles.some((profile) => !profile || typeof profile !== "object" || !("connectionType" in profile) || ("connectionType" in profile && profile.connectionType === "ssh" && !("authentication" in profile)));
    const profiles = requiresMigration ? migrateProfiles(persisted) : persisted.profiles ?? [];
    const hasRetiredReportFolder = Boolean(persisted && Object.prototype.hasOwnProperty.call(persisted, "reportFolder"));
    const { hosts: _legacyHosts, reportFolder: _removedReportFolder, ...modernSettings } = persisted ?? {};
    // Never spread arbitrary persisted values over defaults. Old or manually
    // edited data.json files are untrusted input and must not create invalid
    // timer values or silently enable container management.
    this.settings = {
      profiles,
      automaticRefresh: typeof modernSettings.automaticRefresh === "boolean" ? modernSettings.automaticRefresh : DEFAULT_SETTINGS.automaticRefresh,
      refreshIntervalMinutes: validRefreshInterval(modernSettings.refreshIntervalMinutes),
      integrateWithTheme: typeof modernSettings.integrateWithTheme === "boolean" ? modernSettings.integrateWithTheme : DEFAULT_SETTINGS.integrateWithTheme,
      containerDensity: modernSettings.containerDensity === "compact" || modernSettings.containerDensity === "comfortable" ? modernSettings.containerDensity : DEFAULT_SETTINGS.containerDensity,
      containerManagementEnabled: modernSettings.containerManagementEnabled === true
    };
    if ((requiresMigration && profiles.length > 0) || hasRetiredReportFolder) await this.saveSettings();
  }
  async saveSettings(): Promise<void> {
    const save = this.settingsSaveChain.then(async () => {
      await this.saveData(this.settings);
    });
    this.settingsSaveChain = save.catch(() => undefined);
    await save;
  }
  onSettingsChanged(listener: (change: DockerConnectorSettingsChange) => void): () => void { this.settingsListeners.add(listener); return () => this.settingsListeners.delete(listener); }
  async setContainerManagementEnabled(value: boolean): Promise<boolean> {
    const previousValue = this.settings.containerManagementEnabled;
    if (previousValue === value) return value;
    this.settings.containerManagementEnabled = value;
    try {
      await this.saveSettings();
      if (this.settings.containerManagementEnabled !== value) throw new Error("Container management setting did not retain the requested value.");
    } catch (error) {
      this.settings.containerManagementEnabled = previousValue;
      throw error;
    }
    this.emitSettingsChanged({ key: "containerManagementEnabled", previousValue, value });
    return this.settings.containerManagementEnabled;
  }
  private emitSettingsChanged(change: DockerConnectorSettingsChange): void { for (const listener of this.settingsListeners) listener(change); }
  refreshDashboard(): void { this.refreshOpenDashboard(); }
  configureRefresh(): void {
    if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    if (this.settings.automaticRefresh) {
      // registerInterval lets Obsidian clear the long-lived timer if teardown is
      // interrupted. We also clear it when the user changes this setting.
      this.refreshTimer = this.registerInterval(window.setInterval(() => void this.refreshAll().catch(() => undefined), this.settings.refreshIntervalMinutes * 60_000));
    }
  }
  async refreshAll(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    const refresh = this.runRefresh();
    this.refreshPromise = refresh;
    try { await refresh; } finally { if (this.refreshPromise === refresh) this.refreshPromise = undefined; }
  }
  private async runRefresh(): Promise<void> {
    const generation = ++this.refreshGeneration;
    const results = await Promise.all(this.settings.profiles.filter((profile) => profile.enabled && connectionCapabilities(profile).supportsAutomaticRefresh).map((profile) => this.inspectionService.inspectHost(profile)));
    if (this.unloading || generation !== this.refreshGeneration) return;
    for (const snapshot of results) {
      // A profile can be deleted while an earlier read-only refresh is still
      // completing. Never republish state for a profile that no longer exists.
      if (!this.settings.profiles.some((profile) => profile.id === snapshot.hostId)) continue;
      const previous = this.snapshots.get(snapshot.hostId);
      const retained = snapshot.status === "offline" && previous?.status === "online" ? { ...previous, status: "offline" as const, stale: true, refreshedAt: snapshot.refreshedAt, error: snapshot.error } : snapshot;
      this.snapshots.set(snapshot.hostId, retained);
      this.containerDetailService.invalidateHost(snapshot.hostId); this.imageDetailService.invalidateHost(snapshot.hostId); this.volumeDetailService.invalidateHost(snapshot.hostId);
      const profile = this.settings.profiles.find((item) => item.id === snapshot.hostId); if (profile) this.scheduleContainerImageUpdateChecks(profile, retained);
    }
    this.refreshOpenDashboard();
  }
  async activateDashboard(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(DOCKER_CONNECTOR_VIEW)[0];
    if (!leaf) leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: DOCKER_CONNECTOR_VIEW, active: true });
    workspace.revealLeaf(leaf);
  }
  async testConnection(profile: DockerConnectionProfile, credential?: string) {
    const normalized = normalizeProfile(profile);
    if (credential !== undefined) this.setRuntimeCredential(normalized, credential);
    return new DockerApiClient(this.connectionFactory.create(normalized)).testConnection();
  }
  async reconnectHost(profile: DockerConnectionProfile, credential?: string): Promise<void> {
    const normalized = normalizeProfile(profile);
    if (credential !== undefined) this.setRuntimeCredential(normalized, credential);
    const snapshot = await this.inspectionService.inspectHost(normalized);
    if (!this.settings.profiles.some((item) => item.id === normalized.id)) return;
    this.snapshots.set(normalized.id, snapshot);
    this.refreshOpenDashboard();
  }
  async retryHost(profile: DockerConnectionProfile, scheduleUpdateChecks = true): Promise<void> {
    const snapshot = await this.inspectionService.inspectHost(normalizeProfile(profile));
    if (!this.settings.profiles.some((item) => item.id === profile.id)) return;
    const previous = this.snapshots.get(profile.id);
    const retained = snapshot.status === "offline" && previous?.status === "online" ? { ...previous, status: "offline" as const, stale: true, refreshedAt: snapshot.refreshedAt, error: snapshot.error } : snapshot; this.snapshots.set(profile.id, retained); this.containerDetailService.invalidateHost(profile.id); this.imageDetailService.invalidateHost(profile.id); this.volumeDetailService.invalidateHost(profile.id); if (scheduleUpdateChecks) this.scheduleContainerImageUpdateChecks(profile, retained);
    this.refreshOpenDashboard();
  }
  async disconnectProfile(profileId: string): Promise<void> { await this.connectionFactory.disconnect(profileId); }
  hasActiveContainerAction(profileId: string): boolean { return this.containerActions.hasActiveProfile(profileId); }
  /** Clears every runtime-only record owned by a deleted connection profile. */
  clearDeletedProfileState(profileId: string): void {
    this.snapshots.delete(profileId);
    this.contextLifecycle.clear(profileId);
    this.containerDetailService.invalidateHost(profileId);
    this.imageDetailService.invalidateHost(profileId);
    this.volumeDetailService.invalidateHost(profileId);
    this.containerImageUpdates.clearProfile(profileId);
    this.containerActions.clear(profileId);
  }
  async refreshContextMetadata(profile: DockerContextProfile) {
    const now = new Date().toISOString();
    try { const result = evaluateDockerContextLifecycle(profile, await new DockerContextDiscoveryService().discover(), now); this.contextLifecycle.set(profile.id, result); return result; }
    catch (error) { const result = unavailableDockerContextLifecycle(profile, error, now); this.contextLifecycle.set(profile.id, result); return result; }
    finally { this.refreshOpenDashboard(); }
  }
  async inspectContainer(profile: DockerConnectionProfile, containerId: string, snapshotAt: string): Promise<DockerContainerDetails> { return this.containerDetailService.inspect(profile, containerId, snapshotAt); }
  containerActionState(profileId: string, containerId: string): ContainerActionProgress | undefined { return this.containerActions.state(profileId, containerId); }
  containerImageUpdateStatus(profileId: string, containerId: string): ContainerImageUpdateStatus | undefined { return this.containerImageUpdates.getStatus(profileId, containerId); }
  async checkContainerImageUpdate(profile: DockerConnectionProfile, containerId: string, force = true) { return this.containerImageUpdates.check(profile, containerId, force); }
  onContainerUpdateProgress(listener: (event: ContainerUpdateProgressEvent) => void): () => void { return this.containerActions.onUpdateProgress(listener); }
  async preflightContainerUpdate(profile: DockerConnectionProfile, containerId: string): Promise<ContainerUpdatePreview> { return this.containerActions.preflight(profile, containerId); }
  async startContainer(profile: DockerConnectionProfile, containerId: string): Promise<void> { await this.containerActions.start(profile, containerId); await this.retryHost(profile); }
  async stopContainer(profile: DockerConnectionProfile, containerId: string, timeoutSeconds: number, graceful = false): Promise<void> { await this.containerActions.stop(profile, containerId, timeoutSeconds, graceful); await this.retryHost(profile); }
  async restartContainer(profile: DockerConnectionProfile, containerId: string, timeoutSeconds: number): Promise<void> { await this.containerActions.restart(profile, containerId, timeoutSeconds); await this.retryHost(profile); }
  async updateContainer(profile: DockerConnectionProfile, containerId: string, confirm = true, attemptId?: string) { const result = await this.containerActions.update(profile, containerId, confirm, undefined, attemptId); await this.retryHost(profile, false); if (result.status === "updated" || result.status === "updated-with-backup-retained") { this.containerImageUpdates.clearStatus(profile.id, containerId); const replacement = this.snapshots.get(profile.id)?.containers.find((container) => container.id === result.newContainerId); this.containerImageUpdates.markCurrent(profile.id, result.newContainerId, replacement?.displayName ?? result.newContainerId.slice(0, 12), replacement?.image ?? "unknown", result.newImageId); } else if (result.status === "already-current") { const container = this.snapshots.get(profile.id)?.containers.find((item) => item.id === containerId); if (container) this.containerImageUpdates.markCurrent(profile.id, containerId, container.displayName, container.image, result.imageId); } return result; }
  async inspectImage(profile: DockerConnectionProfile, snapshot: DockerHostSnapshot, imageId: string): Promise<DockerImageDetails> { return this.imageDetailService.inspect(profile, snapshot, imageId); }
  async inspectVolume(profile: DockerConnectionProfile, snapshot: DockerHostSnapshot, name: string): Promise<DockerVolumeDetails> { return this.volumeDetailService.inspect(profile, snapshot, name); }
  /** Stores a session-only password after a newly created host receives its final ID. */
  setRuntimePassword(profileId: string, password: string): void { this.connectionFactory.setRuntimePassword(profileId, password); }
  clearRuntimePassword(profileId: string): void { this.connectionFactory.clearRuntimePassword(profileId); }
  setRuntimePrivateKeyPassphrase(profileId: string, passphrase: string): void { this.connectionFactory.setRuntimePrivateKeyPassphrase(profileId, passphrase); }
  setRuntimeTlsClientKeyPassphrase(profileId: string, passphrase: string): void { this.connectionFactory.setRuntimeTlsClientKeyPassphrase(profileId, passphrase); }
  clearRuntimeCredentials(profileId: string): void { this.connectionFactory.clearRuntimeCredentials(profileId); }
  private setRuntimeCredential(profile: DockerConnectionProfile, credential: string): void { if (profile.connectionType === "ssh" && profile.authentication.type === "password") this.setRuntimePassword(profile.id, credential); else if (profile.connectionType === "ssh") this.setRuntimePrivateKeyPassphrase(profile.id, credential); else if (profile.connectionType === "docker-tls") this.setRuntimeTlsClientKeyPassphrase(profile.id, credential); }
  private scheduleContainerImageUpdateChecks(profile: DockerConnectionProfile, snapshot: DockerHostSnapshot): void { if (this.unloading || !this.settings.containerManagementEnabled || snapshot.status !== "online") return; snapshot.containers.forEach((container) => { const eligibility = getContainerUpdateEligibility(container.image, container.labels); if (eligibility.eligible && this.containerImageUpdates.isStale(profile.id, container.id)) void this.containerImageUpdates.check(profile, container.id).catch(() => undefined); }); }
  private refreshOpenDashboard(): void { this.app.workspace.getLeavesOfType(DOCKER_CONNECTOR_VIEW).forEach((leaf) => void (leaf.view as DockerDashboardView).render()); }
}

/** Keeps corrupted persisted values from creating a zero, negative, or runaway refresh loop. */
function validRefreshInterval(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 24 * 60
    ? Math.floor(value)
    : DEFAULT_SETTINGS.refreshIntervalMinutes;
}
