import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DockerHostManager } from "./services/DockerHostManager";
import { DockerInspectionService } from "./services/DockerInspectionService";
import { DockerConnectionFactory } from "./connections/DockerConnectionFactory";
import { DEFAULT_SETTINGS, DockerConnectorSettings, DockerConnectorSettingTab } from "./settings/settings";
import { ProfileManagementAuthorization } from "./security/ProfileManagementAuthorization";
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
import { desktopUi } from "./platform/DesktopUiAdapter";
import { DockerContextLifecycleCache, evaluateDockerContextLifecycle, unavailableDockerContextLifecycle } from "./connections/DockerContextLifecycle";
import type { DockerContextProfile } from "./models/DockerConnectionProfile";
import { connectionCapabilities } from "./connections/DockerConnectionCapabilities";
import { DockerContainerActionService, type ContainerActionProgress, type ContainerUpdateProgressEvent } from "./services/DockerContainerActionService";
import { getContainerUpdateEligibility, type ContainerUpdatePreview } from "./services/ContainerUpdatePlan";
import { ContainerImageUpdateService, type ContainerImageUpdateStatus } from "./services/ContainerImageUpdateService";
import { StartupRefreshCoordinator } from "./lifecycle/StartupRefreshCoordinator";
import { ProfileRefreshTracker } from "./services/ProfileRefreshTracker";
import { RememberedSshPasswordStore } from "./security/RememberedSshPasswordStore";

/** Describes a persisted preference change that an open view may need to reflect. */
export type DockerConnectorSettingsChange = { key: keyof DockerConnectorSettings | "managementAuthorization"; previousValue: unknown; value: unknown };

/**
 * Docker Connector plugin entry point.
 *
 * This class owns Obsidian lifecycle work, persisted settings, and the current
 * in-memory host snapshots. Transport construction, Docker API
 * policy, and container mutations live in dedicated services so a UI change
 * cannot accidentally expand the plugin's authority.
 *
 * Security notes:
 * - Profile settings contain connection metadata only. Runtime credentials are
 *   cleared during unload; explicitly opted-in SSH passwords are separately
 *   stored in plugin data and rehydrated into runtime memory on startup.
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
  readonly managementAuthorization = new ProfileManagementAuthorization();
  readonly containerActions = new DockerContainerActionService(this.connectionFactory, (profileId) => this.isProfileManagementEnabled(profileId));
  readonly containerImageUpdates = new ContainerImageUpdateService(this.connectionFactory);
  private refreshTimer?: number;
  private refreshGeneration = 0;
  private readonly profileRefreshes = new ProfileRefreshTracker();
  private readonly startupRefresh = new StartupRefreshCoordinator();
  private refreshPromise?: Promise<void>;
  private unloading = false;
  private readonly settingsListeners = new Set<(change: DockerConnectorSettingsChange) => void>();
  private settingsSaveChain: Promise<void> = Promise.resolve();
  private readonly rememberedSshPasswords = new RememberedSshPasswordStore();

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
    // A plugin reload can occur after Obsidian has already completed layout.
    // Start the normal read-only refresh immediately as well as registering the
    // layout-ready path; refreshAll deduplicates overlapping calls.
    this.runStartupRefresh();
    // Obsidian recommends deferring network and other expensive startup work
    // until the workspace is ready. Registration remains synchronous, while
    // host inspection cannot delay opening the user's vault.
    this.app.workspace.onLayoutReady(() => {
      if (!this.unloading) this.runStartupRefresh();
    });
  }

  /**
   * Stops new work before dismantling transports. Active update transactions get
   * a bounded chance to follow their normal cancellation/rollback path; cleanup
   * then clears credentials and caches even if a transport has become unhealthy.
   */
  async onunload(): Promise<void> {
    this.unloading = true;
    this.managementAuthorization.clear();
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
    const persistedProfiles = Array.isArray(persisted?.profiles) ? persisted.profiles : [];
    const requiresMigration = !Array.isArray(persisted?.profiles) || persistedProfiles.some((profile) => !profile || typeof profile !== "object" || !("connectionType" in profile) || ("connectionType" in profile && profile.connectionType === "ssh" && !("authentication" in profile)));
    // data.json is user-controlled input. Run every record through the
    // migration and validation boundary, even when it appears current, so a
    // partially edited or unknown profile cannot crash a view or reach a
    // transport. Duplicate/blank IDs are rejected because all runtime state
    // is keyed by this stable profile ID.
    const migratedProfiles = migrateProfiles(persisted);
    const seenProfileIds = new Set<string>();
    const profiles = migratedProfiles.flatMap((profile) => {
      try {
        const normalized = normalizeProfile(profile);
        if (!normalized.id || seenProfileIds.has(normalized.id)) return [];
        seenProfileIds.add(normalized.id);
        return [normalized];
      } catch {
        return [];
      }
    });
    const repairedProfiles = migratedProfiles.length !== persistedProfiles.length || profiles.length !== migratedProfiles.length;
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
    };
    this.rememberedSshPasswords.load((persisted as { rememberedSshPasswords?: unknown } | null)?.rememberedSshPasswords, profiles);
    for (const profile of profiles) {
      const password = this.rememberedSshPasswords.get(profile.id);
      if (password) this.setRuntimePassword(profile.id, password);
    }
    if (requiresMigration || repairedProfiles || hasRetiredReportFolder) await this.saveSettings();
  }
  async saveSettings(): Promise<void> {
    const save = this.settingsSaveChain.then(async () => {
      await this.saveData({ ...this.settings, rememberedSshPasswords: this.rememberedSshPasswords.serialize() });
    });
    this.settingsSaveChain = save.catch(() => undefined);
    await save;
  }
  onSettingsChanged(listener: (change: DockerConnectorSettingsChange) => void): () => void { this.settingsListeners.add(listener); return () => this.settingsListeners.delete(listener); }
  isProfileManagementEnabled(profileId: string): boolean { return this.managementAuthorization.isEnabled(profileId) && this.snapshots.get(profileId)?.status === "online"; }
  setProfileManagementEnabled(profileId: string, enabled: boolean): boolean {
    const profile = this.settings.profiles.find((item) => item.id === profileId);
    if (!profile || this.snapshots.get(profileId)?.status !== "online" || !connectionCapabilities(profile).supportsContainerActions) return false;
    const previousValue = this.managementAuthorization.isEnabled(profileId);
    if (enabled) this.managementAuthorization.enable(profileId); else this.managementAuthorization.disable(profileId);
    this.emitSettingsChanged({ key: "managementAuthorization", previousValue, value: enabled });
    return true;
  }
  clearProfileManagementAuthorization(profileId: string): void { const previousValue = this.managementAuthorization.isEnabled(profileId); this.managementAuthorization.disable(profileId); if (previousValue) this.emitSettingsChanged({ key: "managementAuthorization", previousValue, value: false }); }
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
    const operations = this.settings.profiles
      .filter((profile) => profile.enabled && connectionCapabilities(profile).supportsAutomaticRefresh)
      .map((profile) => ({ profile, token: this.profileRefreshes.begin(profile.id) }));
    const results = await Promise.all(operations.map(({ profile }) => this.inspectionService.inspectHost(profile)));
    if (this.unloading || generation !== this.refreshGeneration) return;
    for (const [index, snapshot] of results.entries()) {
      const operation = operations[index];
      // A profile can be deleted while an earlier read-only refresh is still
      // completing. An edit or a newer retry can likewise supersede this
      // request, so never republish a stale snapshot for the stable profile ID.
      if (!operation || snapshot.hostId !== operation.profile.id || !this.profileRefreshes.isCurrent(snapshot.hostId, operation.token) || !this.settings.profiles.some((profile) => profile.id === snapshot.hostId)) continue;
      const previous = this.snapshots.get(snapshot.hostId);
      const retained = snapshot.status === "offline" && previous?.status === "online" ? { ...previous, status: "offline" as const, stale: true, refreshedAt: snapshot.refreshedAt, error: snapshot.error } : snapshot;
      this.publishSnapshot(snapshot.hostId, retained);
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
    const token = this.profileRefreshes.begin(normalized.id);
    const snapshot = await this.inspectionService.inspectHost(normalized);
    if (!this.profileRefreshes.isCurrent(normalized.id, token) || !this.settings.profiles.some((item) => item.id === normalized.id)) return;
    this.publishSnapshot(normalized.id, snapshot);
    this.refreshOpenDashboard();
  }
  async retryHost(profile: DockerConnectionProfile, scheduleUpdateChecks = true): Promise<void> {
    const normalized = normalizeProfile(profile);
    const token = this.profileRefreshes.begin(normalized.id);
    const snapshot = await this.inspectionService.inspectHost(normalized);
    if (!this.profileRefreshes.isCurrent(normalized.id, token) || !this.settings.profiles.some((item) => item.id === normalized.id)) return;
    const previous = this.snapshots.get(profile.id);
    const retained = snapshot.status === "offline" && previous?.status === "online" ? { ...previous, status: "offline" as const, stale: true, refreshedAt: snapshot.refreshedAt, error: snapshot.error } : snapshot; this.publishSnapshot(profile.id, retained); this.containerDetailService.invalidateHost(profile.id); this.imageDetailService.invalidateHost(profile.id); this.volumeDetailService.invalidateHost(profile.id); if (scheduleUpdateChecks) this.scheduleContainerImageUpdateChecks(profile, retained);
    this.refreshOpenDashboard();
  }
  async disconnectProfile(profileId: string): Promise<void> { await this.connectionFactory.disconnect(profileId); }
  /** Prevents in-flight inspection of a profile's previous configuration from publishing. */
  invalidateProfileRefresh(profileId: string): void { this.profileRefreshes.clear(profileId); }
  hasActiveContainerAction(profileId: string): boolean { return this.containerActions.hasActiveProfile(profileId); }
  /** Clears every runtime-only record owned by a deleted connection profile. */
  clearDeletedProfileState(profileId: string): void {
    this.clearProfileManagementAuthorization(profileId);
    this.profileRefreshes.clear(profileId);
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
    try { const result = evaluateDockerContextLifecycle(profile, (await desktopUi(this).discoverContexts()).contexts, now); this.contextLifecycle.set(profile.id, result); return result; }
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
  hasRememberedSshPassword(profileId: string): boolean { return this.rememberedSshPasswords.has(profileId); }
  async rememberSshPassword(profileId: string, password: string): Promise<void> {
    this.rememberedSshPasswords.set(profileId, password);
    this.setRuntimePassword(profileId, password);
    await this.saveSettings();
  }
  async forgetRememberedSshPassword(profileId: string): Promise<void> {
    this.takeRememberedSshPassword(profileId);
    await this.saveSettings();
  }
  /** Removes persisted and runtime password material so the caller can persist the accompanying profile change. */
  takeRememberedSshPassword(profileId: string): string | undefined {
    const password = this.rememberedSshPasswords.take(profileId);
    this.clearRuntimePassword(profileId);
    return password;
  }
  restoreRememberedSshPassword(profileId: string, password: string | undefined): void {
    this.rememberedSshPasswords.restore(profileId, password);
    if (password) this.setRuntimePassword(profileId, password);
  }
  private setRuntimeCredential(profile: DockerConnectionProfile, credential: string): void { if (profile.connectionType === "ssh" && profile.authentication.type === "password") this.setRuntimePassword(profile.id, credential); else if (profile.connectionType === "ssh") this.setRuntimePrivateKeyPassphrase(profile.id, credential); else if (profile.connectionType === "docker-tls") this.setRuntimeTlsClientKeyPassphrase(profile.id, credential); }
  private scheduleContainerImageUpdateChecks(profile: DockerConnectionProfile, snapshot: DockerHostSnapshot): void { if (this.unloading || !this.managementAuthorization.isEnabled(profile.id) || snapshot.status !== "online") return; snapshot.containers.forEach((container) => { const eligibility = getContainerUpdateEligibility(container.image, container.labels); if (eligibility.eligible && this.containerImageUpdates.isStale(profile.id, container.id)) void this.containerImageUpdates.check(profile, container.id).catch(() => undefined); }); }
  private refreshOpenDashboard(): void { this.app.workspace.getLeavesOfType(DOCKER_CONNECTOR_VIEW).forEach((leaf) => void (leaf.view as DockerDashboardView).render()); }
  private publishSnapshot(profileId: string, snapshot: DockerHostSnapshot): void { if (this.managementAuthorization.revokeOnConnectionLoss(profileId, snapshot.status)) this.emitSettingsChanged({ key: "managementAuthorization", previousValue: true, value: false }); this.snapshots.set(profileId, snapshot); }
  private runStartupRefresh(): void { const refresh = this.startupRefresh.run(() => this.refreshAll()); if (refresh) void refresh.catch(() => undefined); }
}

/** Keeps corrupted persisted values from creating a zero, negative, or runaway refresh loop. */
function validRefreshInterval(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 24 * 60
    ? Math.floor(value)
    : DEFAULT_SETTINGS.refreshIntervalMinutes;
}
