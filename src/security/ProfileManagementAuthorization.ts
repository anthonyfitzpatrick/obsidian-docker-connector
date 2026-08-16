/** In-memory, session-only authorization for explicit container mutations. */
export class ProfileManagementAuthorization {
  private readonly enabledProfileIds = new Set<string>();
  isEnabled(profileId: string): boolean { return this.enabledProfileIds.has(profileId); }
  enable(profileId: string): void { this.enabledProfileIds.add(profileId); }
  disable(profileId: string): void { this.enabledProfileIds.delete(profileId); }
  revokeOnConnectionLoss(profileId: string, status: HostConnectionStatus): boolean { if (status === "online" || !this.isEnabled(profileId)) return false; this.disable(profileId); return true; }
  clear(): void { this.enabledProfileIds.clear(); }
}
import type { HostConnectionStatus } from "../models/DockerConnectionProfile";
