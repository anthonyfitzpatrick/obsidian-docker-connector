import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { DockerConnectionError } from "../connections/DockerTransport";
import { DockerConnectionFactory } from "../connections/DockerConnectionFactory";
import { DockerApiClient } from "./DockerApiClient";
import { getContainerImageUpdateTarget } from "./ContainerUpdatePlan";

/**
 * Advisory container-image update checker.
 *
 * Availability is not eligibility: this service pulls an eligible image through
 * the Docker daemon and compares image IDs, but it never stops, recreates, or
 * starts a container. Results are memory-only and expire after 24 hours; a
 * separate confirmed update transaction decides whether any change is allowed.
 */
export const DEFAULT_CONTAINER_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export type ContainerImageUpdateState = "not-checked" | "checking" | "available" | "current" | "error" | "unsupported";
export interface ContainerImageUpdateStatus { profileId: string; containerId: string; containerName: string; imageReference: string; state: ContainerImageUpdateState; currentImageId?: string; remoteImageId?: string; lastCheckedAt?: string; nextCheckAt?: string; errorCode?: string; safeMessage?: string; }
export interface ContainerImageUpdateCheckResult { status: ContainerImageUpdateStatus; pullPerformed: boolean; }

/** A typed, non-container-mutating update check. DockerApiClient itself remains GET-only. */
export class ContainerImageUpdateService {
  private readonly statuses = new Map<string, ContainerImageUpdateStatus>();
  private readonly checks = new Map<string, Promise<ContainerImageUpdateCheckResult>>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners = new Set<(status: ContainerImageUpdateStatus) => void>();
  constructor(private readonly connections: DockerConnectionFactory, private readonly now: () => number = Date.now) {}
  getStatus(profileId: string, containerId: string): ContainerImageUpdateStatus | undefined { return this.statuses.get(key(profileId, containerId)); }
  onStatusChange(listener: (status: ContainerImageUpdateStatus) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  clearStatus(profileId: string, containerId: string): void { this.controllers.get(key(profileId, containerId))?.abort(); this.controllers.delete(key(profileId, containerId)); this.statuses.delete(key(profileId, containerId)); }
  clearProfile(profileId: string): void { for (const id of [...new Set([...this.statuses.keys(), ...this.controllers.keys()])]) if (id.startsWith(`${profileId}:`)) this.clearStatus(profileId, id.slice(profileId.length + 1)); }
  clearAll(): void { this.controllers.forEach((controller) => controller.abort()); this.controllers.clear(); this.statuses.clear(); this.listeners.clear(); }
  isStale(profileId: string, containerId: string): boolean { const next = this.getStatus(profileId, containerId)?.nextCheckAt; const nextTime = next ? Date.parse(next) : Number.NaN; return !Number.isFinite(nextTime) || nextTime <= this.now(); }
  markCurrent(profileId: string, containerId: string, containerName: string, imageReference: string, imageId: string): void { this.clearStatus(profileId, containerId); const checked = new Date(this.now()).toISOString(); this.setStatus({ profileId, containerId, containerName, imageReference, state: "current", currentImageId: imageId, remoteImageId: imageId, lastCheckedAt: checked, nextCheckAt: new Date(this.now() + DEFAULT_CONTAINER_UPDATE_CHECK_INTERVAL_MS).toISOString() }); }
  async check(profile: DockerConnectionProfile, containerId: string, force = false, signal?: AbortSignal): Promise<ContainerImageUpdateCheckResult> { const id = key(profile.id, containerId); if (!force && !this.isStale(profile.id, containerId)) return { status: this.statuses.get(id)!, pullPerformed: false }; const existing = this.checks.get(id); if (existing) return existing; const controller = new AbortController(); if (signal?.aborted) controller.abort(); const abort = () => controller.abort(); signal?.addEventListener("abort", abort, { once: true }); const promise = this.run(profile, containerId, controller).finally(() => { signal?.removeEventListener("abort", abort); this.checks.delete(id); this.controllers.delete(id); }); this.checks.set(id, promise); this.controllers.set(id, controller); return promise; }
  private async run(profile: DockerConnectionProfile, containerId: string, controller: AbortController): Promise<ContainerImageUpdateCheckResult> { const id = key(profile.id, containerId); let status: ContainerImageUpdateStatus = { profileId: profile.id, containerId, containerName: containerId.slice(0, 12), imageReference: "unknown", state: "checking" }; this.setStatus(status); try { throwIfAborted(controller); const transport = this.connections.create(profile), api = new DockerApiClient(transport); const raw = await api.get<unknown>(`/containers/${containerId}/json`); throwIfAborted(controller); const target = getContainerImageUpdateTarget(raw); status = { ...status, containerName: target.containerName, imageReference: target.imageReference, currentImageId: target.currentImageId }; this.setStatus(status); throwIfAborted(controller); await transport.request<string>({ method: "POST", path: `/images/create?fromImage=${encodeURIComponent(repository(target.imageReference))}&tag=${encodeURIComponent(tag(target.imageReference))}`, responseType: "text" }); throwIfAborted(controller); const images = await api.get<Array<{ Id?: string; RepoTags?: string[] }>>("/images/json"); throwIfAborted(controller); const remoteImageId = images.find((image) => image.RepoTags?.includes(target.imageReference))?.Id; if (!remoteImageId) throw new DockerConnectionError("CONTAINER_UPDATE_CHECK_IMAGE_RESOLUTION_FAILED", "Docker pulled the image but its image ID could not be resolved."); const checked = new Date(this.now()).toISOString(); status = { ...status, state: remoteImageId === target.currentImageId ? "current" : "available", remoteImageId, lastCheckedAt: checked, nextCheckAt: new Date(this.now() + DEFAULT_CONTAINER_UPDATE_CHECK_INTERVAL_MS).toISOString(), errorCode: undefined, safeMessage: undefined }; this.setStatus(status); return { status, pullPerformed: true }; } catch (error) { if (controller.signal.aborted) { this.statuses.delete(id); return { status, pullPerformed: false }; } const typed = classify(error); const unsupported = typed.code === "CONTAINER_UPDATE_IMAGE_UNPULLABLE" || typed.code === "CONTAINER_UPDATE_CONFIG_UNSUPPORTED"; status = { ...status, state: unsupported ? "unsupported" : "error", errorCode: typed.code, safeMessage: typed.message, lastCheckedAt: new Date(this.now()).toISOString(), nextCheckAt: unsupported ? undefined : new Date(this.now() + DEFAULT_CONTAINER_UPDATE_CHECK_INTERVAL_MS).toISOString() }; this.setStatus(status); return { status, pullPerformed: false }; } }
  private setStatus(status: ContainerImageUpdateStatus): void { this.statuses.set(key(status.profileId, status.containerId), status); this.listeners.forEach((listener) => listener(status)); }
}
function key(profileId: string, containerId: string): string { return `${profileId}:${containerId}`; }
function throwIfAborted(controller: AbortController): void { if (controller.signal.aborted) throw new DockerConnectionError("CONTAINER_UPDATE_CHECK_CANCELLED", "Container update check was cancelled."); }
function repository(reference: string): string { return reference.slice(0, reference.lastIndexOf(":")); }
function tag(reference: string): string { return reference.slice(reference.lastIndexOf(":") + 1); }
function classify(error: unknown): DockerConnectionError { if (error instanceof DockerConnectionError) return error; return new DockerConnectionError("CONTAINER_UPDATE_CHECK_PULL_FAILED", "Docker could not check the configured image for updates."); }
