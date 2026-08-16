/** In-memory, session-only authorization for explicit container mutations. */
export class ProfileManagementAuthorization {
  private readonly enabledProfileIds = new Set<string>();
  isEnabled(profileId: string): boolean { return this.enabledProfileIds.has(profileId); }
  enable(profileId: string): void { this.enabledProfileIds.add(profileId); }
  disable(profileId: string): void { this.enabledProfileIds.delete(profileId); }
  clear(): void { this.enabledProfileIds.clear(); }
}
