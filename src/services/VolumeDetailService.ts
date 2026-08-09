import type { DockerConnectionProfile, DockerHostSnapshot } from "../models/DockerConnectionProfile"; import { DockerConnectionFactory } from "../connections/DockerConnectionFactory"; import { DockerApiClient } from "./DockerApiClient"; import { VolumeMapper } from "../volumes/VolumeMapper"; import type { DockerVolumeDetails } from "../volumes/VolumeModels";

/**
 * Lazy, snapshot-scoped volume inspection cache.
 *
 * A volume detail is read only when a user opens it and is associated with the
 * snapshot that supplied the volume list.  Invalidating a host after refresh
 * prevents detail data from an older Docker state being shown as current.
 */
export class VolumeDetailService { private cache = new Map<string, { at: string; value: DockerVolumeDetails }>(); constructor(private readonly connections: DockerConnectionFactory) {} async inspect(profile: DockerConnectionProfile, snapshot: DockerHostSnapshot, name: string) { const key = `${profile.id}:${name}`, hit = this.cache.get(key); if (hit?.at === snapshot.refreshedAt) return hit.value; const summary = snapshot.volumes.find((v) => v.name === name); const raw = await new DockerApiClient(this.connections.create(profile)).get<unknown>(`/volumes/${name}`); const value = VolumeMapper.details(raw, summary?.referencingContainers ?? []); this.cache.set(key, { at: snapshot.refreshedAt, value }); return value; } invalidateHost(id: string) { for (const key of this.cache.keys()) if (key.startsWith(`${id}:`)) this.cache.delete(key); } clear() { this.cache.clear(); } }
