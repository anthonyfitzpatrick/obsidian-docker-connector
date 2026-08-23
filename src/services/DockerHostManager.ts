import type DockerConnectorPlugin from "../main";
import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { normalizeProfile } from "../utils/profileValidation";
import { rememberedPasswordInvalidated } from "../security/RememberedSshPasswordStore";

/** Persists validated non-secret connection profiles only. */
export class DockerHostManager {
  constructor(private readonly plugin: DockerConnectorPlugin) {}
  async add(profile: DockerConnectionProfile): Promise<void> {
    const profiles = this.plugin.settings.profiles;
    this.plugin.settings.profiles = [...profiles, normalizeProfile(profile)];
    try { await this.plugin.saveSettings(); this.plugin.clearProfileManagementAuthorization?.(profile.id); this.plugin.invalidateProfileRefresh(profile.id); await this.plugin.disconnectProfile(profile.id); this.plugin.contextLifecycle.clear(profile.id); } catch (error) { this.plugin.settings.profiles = profiles; throw error; }
  }
  async update(profile: DockerConnectionProfile): Promise<void> {
    if (this.plugin.hasActiveContainerAction(profile.id)) throw new Error("A container operation is currently in progress for this connection. Wait for it to finish before editing the connection.");
    const profiles = this.plugin.settings.profiles;
    const normalized = normalizeProfile(profile);
    const previous = profiles.find((item) => item.id === normalized.id);
    const removedPassword = previous && rememberedPasswordInvalidated(previous, normalized) ? this.plugin.takeRememberedSshPassword(normalized.id) : undefined;
    this.plugin.settings.profiles = profiles.map((item) => item.id === normalized.id ? normalized : item);
    try { await this.plugin.saveSettings(); this.plugin.clearProfileManagementAuthorization?.(profile.id); this.plugin.invalidateProfileRefresh(profile.id); await this.plugin.disconnectProfile(profile.id); this.plugin.contextLifecycle.clear(profile.id); } catch (error) { this.plugin.settings.profiles = profiles; if (removedPassword !== undefined) this.plugin.restoreRememberedSshPassword(normalized.id, removedPassword); throw error; }
  }
  /** Removes only Docker Connector's saved profile and its runtime state. */
  async remove(profileId: string): Promise<void> {
    const profiles = this.plugin.settings.profiles;
    if (!profiles.some((profile) => profile.id === profileId)) return;
    if (this.plugin.hasActiveContainerAction(profileId)) throw new Error("A container operation is currently in progress for this connection. Wait for it to finish before deleting the connection.");
    const removedPassword = this.plugin.takeRememberedSshPassword(profileId);
    this.plugin.settings.profiles = profiles.filter((profile) => profile.id !== profileId);
    try { await this.plugin.saveSettings(); }
    catch (error) { this.plugin.settings.profiles = profiles; if (removedPassword !== undefined) this.plugin.restoreRememberedSshPassword(profileId, removedPassword); throw error; }
    // Persist first: a failed save must leave both the visible profile and its
    // in-memory state intact. Afterwards cleanup is entirely plugin-owned.
    await this.plugin.disconnectProfile(profileId);
    this.plugin.clearRuntimeCredentials(profileId);
    this.plugin.clearDeletedProfileState(profileId);
    this.plugin.refreshDashboard();
  }
}
