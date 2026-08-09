import type DockerConnectorPlugin from "../main";
import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { normalizeProfile } from "../utils/profileValidation";

/** Persists validated non-secret connection profiles only. */
export class DockerHostManager {
  constructor(private readonly plugin: DockerConnectorPlugin) {}
  async add(profile: DockerConnectionProfile): Promise<void> {
    const profiles = this.plugin.settings.profiles;
    this.plugin.settings.profiles = [...profiles, normalizeProfile(profile)];
    try { await this.plugin.saveSettings(); await this.plugin.disconnectProfile(profile.id); this.plugin.contextLifecycle.clear(profile.id); } catch (error) { this.plugin.settings.profiles = profiles; throw error; }
  }
  async update(profile: DockerConnectionProfile): Promise<void> {
    const profiles = this.plugin.settings.profiles;
    const normalized = normalizeProfile(profile);
    this.plugin.settings.profiles = profiles.map((item) => item.id === normalized.id ? normalized : item);
    try { await this.plugin.saveSettings(); await this.plugin.disconnectProfile(profile.id); this.plugin.contextLifecycle.clear(profile.id); } catch (error) { this.plugin.settings.profiles = profiles; throw error; }
  }
  async remove(profileId: string): Promise<void> { this.plugin.settings.profiles = this.plugin.settings.profiles.filter((profile) => profile.id !== profileId); this.plugin.snapshots.delete(profileId); this.plugin.contextLifecycle.clear(profileId); this.plugin.clearRuntimeCredentials(profileId); await this.plugin.disconnectProfile(profileId); await this.plugin.saveSettings(); }
}
