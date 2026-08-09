import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import type { DockerContainerDetails } from "../containers/ContainerModels";
import { ContainerMapper } from "../containers/ContainerMapper";
import { DockerApiClient } from "./DockerApiClient";
import { DockerConnectionFactory } from "../connections/DockerConnectionFactory";

/** Lazy, session-scoped container inspect cache. Documentation: [[Docker Connector - Container Detail Panel]]. */
export class ContainerDetailService {
  private readonly cache = new Map<string, { snapshotAt: string; details: DockerContainerDetails }>();
  constructor(private readonly connections: DockerConnectionFactory) {}
  async inspect(profile: DockerConnectionProfile, containerId: string, snapshotAt: string): Promise<DockerContainerDetails> {
    const key = `${profile.id}:${containerId}`; const cached = this.cache.get(key);
    if (cached?.snapshotAt === snapshotAt) return cached.details;
    const raw = await new DockerApiClient(this.connections.create(profile)).get<unknown>(`/containers/${containerId}/json`);
    const details = ContainerMapper.details(raw); this.cache.set(key, { snapshotAt, details }); return details;
  }
  invalidateHost(profileId: string): void { for (const key of this.cache.keys()) if (key.startsWith(`${profileId}:`)) this.cache.delete(key); }
  clear(): void { this.cache.clear(); }
}
