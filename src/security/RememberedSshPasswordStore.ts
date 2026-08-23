import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";

/**
 * Explicitly opted-in SSH passwords persisted in Obsidian plugin data.
 *
 * Obsidian's Community Plugin API exposes no supported keychain or secure
 * credential API. This store is therefore intentionally small, separate from
 * profiles, and honest about its local-at-rest storage boundary.
 */
export class RememberedSshPasswordStore {
  private readonly passwords = new Map<string, string>();

  load(value: unknown, profiles: DockerConnectionProfile[]): void {
    this.passwords.clear();
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const passwordProfiles = new Set(profiles.filter((profile) => profile.connectionType === "ssh" && profile.authentication.type === "password").map((profile) => profile.id));
    for (const [profileId, password] of Object.entries(value)) if (passwordProfiles.has(profileId) && typeof password === "string" && password.length > 0) this.passwords.set(profileId, password);
  }

  get(profileId: string): string | undefined { return this.passwords.get(profileId); }
  has(profileId: string): boolean { return this.passwords.has(profileId); }
  set(profileId: string, password: string): void { if (password) this.passwords.set(profileId, password); else this.passwords.delete(profileId); }
  take(profileId: string): string | undefined { const password = this.passwords.get(profileId); this.passwords.delete(profileId); return password; }
  restore(profileId: string, password: string | undefined): void { if (password) this.passwords.set(profileId, password); }
  serialize(): Record<string, string> { return Object.fromEntries(this.passwords); }
}

export function rememberedPasswordInvalidated(previous: DockerConnectionProfile, next: DockerConnectionProfile): boolean {
  if (previous.connectionType !== "ssh" || previous.authentication.type !== "password") return false;
  if (next.connectionType !== "ssh" || next.authentication.type !== "password") return true;
  return previous.sshHost !== next.sshHost || previous.sshUsername !== next.sshUsername;
}
