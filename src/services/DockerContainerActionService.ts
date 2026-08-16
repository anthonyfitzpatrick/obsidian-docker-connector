import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";
import { DockerConnectionError } from "../connections/DockerTransport";
import { DockerConnectionFactory } from "../connections/DockerConnectionFactory";
import { DockerApiClient } from "./DockerApiClient";
import { buildContainerRecreatePlan, containerUpdatePreview, validateContainerRecreatePlan, type ContainerRecreatePlan, type ContainerUpdatePreview } from "./ContainerUpdatePlan";

/** Named, user-initiated operations; there is intentionally no generic action type. */
export type ContainerAction = "start" | "stop" | "shutdown" | "restart" | "update";
export type ContainerActionState = "idle" | "starting" | "stopping" | "shutting-down" | "restarting" | "pulling-image" | "preparing-update" | "recreating" | "verifying" | "succeeded" | "failed";
export interface ContainerActionFailure { action: ContainerAction; errorCode: string; safeMessage: string; safeDetails?: { httpStatus?: number; dockerMessage?: string; }; }
/** Safe state for UI rendering. It omits inspect payloads, environment values, and credentials. */
export interface ContainerActionProgress { action: ContainerAction; state: ContainerActionState; errorCode?: string; safeMessage?: string; failure?: ContainerActionFailure; }
export type ContainerUpdateStage = "inspecting" | "validating" | "pulling-image" | "comparing-images" | "stopping-original" | "creating-backup" | "creating-replacement" | "connecting-networks" | "starting-replacement" | "verifying" | "removing-backup" | "rolling-back" | "completed" | "failed";
export interface ContainerUpdateProgressEvent { attemptId: string; profileId: string; containerId: string; stage: ContainerUpdateStage; state: "running" | "complete" | "warning" | "failed"; timestamp: string; safeMessage?: string; }
/** Bounded unload result; a timeout is reported honestly rather than claiming rollback completed. */
export interface UpdateUnloadRecoveryResult { status: "no-active-updates" | "recovered" | "timed-out"; startedAt: string; finishedAt: string; durationMs: number; transactionResults: Array<{ profileId: string; containerId: string; status: string; errorCode?: string; safeRecoveryInstructions?: string }>; }
export const DEFAULT_UPDATE_UNLOAD_RECOVERY_TIMEOUT_MS = 15_000;
export const DEFAULT_UPDATE_HEALTH_VERIFICATION_TIMEOUT_MS = 30_000;
export const DEFAULT_UPDATE_HEALTH_VERIFICATION_INTERVAL_MS = 1_000;
/**
 * Result of a guarded update transaction. Success becomes authoritative only
 * after the replacement starts and verifies; failures retain or restore the
 * original container whenever the transaction has crossed its mutation boundary.
 */
export type ContainerUpdateResult = { status: "updated"; oldContainerId: string; newContainerId: string; oldImageId: string; newImageId: string } | { status: "updated-with-backup-retained"; oldContainerId: string; newContainerId: string; backupContainerName: string; oldImageId: string; newImageId: string } | { status: "already-current"; containerId: string; imageId: string } | { status: "failed-before-mutation"; errorCode: string } | { status: "failed-rolled-back"; originalContainerId: string; errorCode: string } | { status: "failed-rollback-incomplete"; errorCode: string; safeRecoveryInstructions: string } | { status: "cancelled" };
const CONTAINER_ID = /^[a-f0-9]{12,64}$/i;

/**
 * Sole Docker mutation boundary.
 *
 * Container management is disabled by default and every public action calls
 * guard(), so showing a control in the UI never grants authority. Updates use
 * inspect → validate → pull → compare → stop → backup rename → recreate →
 * reconnect networks → start → verify → cleanup. Rollback never force-deletes
 * volumes; a failed cleanup retains the stopped backup for explicit inspection.
 */
export class DockerContainerActionService {
  private readonly progress = new Map<string, ContainerActionProgress>();
  private readonly activeUpdates = new Map<string, AbortController>();
  private readonly drainWaiters = new Set<() => void>();
  private readonly updateProgressListeners = new Set<(event: ContainerUpdateProgressEvent) => void>();
  private acceptingActions = true;
  constructor(private readonly connections: DockerConnectionFactory, private readonly managementEnabled: (profileId: string) => boolean, private readonly now: () => number = Date.now, private readonly wait: (milliseconds: number) => Promise<void> = delay) {}
  state(profileId: string, containerId: string): ContainerActionProgress | undefined { return this.progress.get(key(profileId, containerId)); }
  onUpdateProgress(listener: (event: ContainerUpdateProgressEvent) => void): () => void { this.updateProgressListeners.add(listener); return () => this.updateProgressListeners.delete(listener); }
  async preflight(profile: DockerConnectionProfile, containerId: string): Promise<ContainerUpdatePreview> { this.guard(profile, containerId); const api = new DockerApiClient(this.connections.create(profile)); const raw = await api.get<unknown>(`/containers/${containerId}/json`); return containerUpdatePreview(raw, validateContainerRecreatePlan(buildContainerRecreatePlan(raw))); }
  isActive(profileId: string, containerId: string): boolean { const state = this.state(profileId, containerId)?.state; return Boolean(state && !["idle", "succeeded", "failed"].includes(state)); }
  /** A profile with a running lifecycle action cannot be removed safely. */
  hasActiveProfile(profileId: string): boolean { return [...this.progress.entries()].some(([id, progress]) => id.startsWith(`${profileId}:`) && !["idle", "succeeded", "failed"].includes(progress.state)) || [...this.activeUpdates.keys()].some((id) => id.startsWith(`${profileId}:`)); }
  clear(profileId?: string): void { if (!profileId) { this.progress.clear(); return; } for (const id of this.progress.keys()) if (id.startsWith(`${profileId}:`)) this.progress.delete(id); }
  cancelUpdate(profileId: string, containerId: string): void { this.activeUpdates.get(key(profileId, containerId))?.abort(); }
  cancelAllUpdates(): void { this.activeUpdates.forEach((controller) => controller.abort()); }
  activeUpdateCount(): number { return this.activeUpdates.size; }
  async recoverActiveUpdates(timeoutMs = DEFAULT_UPDATE_UNLOAD_RECOVERY_TIMEOUT_MS): Promise<UpdateUnloadRecoveryResult> { const startedAt = new Date().toISOString(), started = Date.now(), active = [...this.activeUpdates.keys()].map(parseKey); this.acceptingActions = false; if (!active.length) return recovery("no-active-updates", startedAt, started, []); this.cancelAllUpdates(); let timer: ReturnType<typeof setTimeout> | undefined; /* Unload cannot wait indefinitely for a daemon that has disappeared. Cancellation still follows the normal rollback path while this bounded wait is active. */ const timeout = new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }); const settled = await Promise.race([this.waitForDrain().then(() => true), timeout]); if (timer) clearTimeout(timer); return recovery(settled ? "recovered" : "timed-out", startedAt, started, active.map((item) => ({ ...item, status: settled ? "recovered" : "timed-out", ...(settled ? {} : { errorCode: "CONTAINER_UPDATE_UNLOAD_RECOVERY_TIMEOUT", safeRecoveryInstructions: `Update recovery did not finish for container ${item.containerId}. Reopen Docker Connector and verify the original container before another update.` }) }))); }
  async start(profile: DockerConnectionProfile, containerId: string): Promise<void> { await this.execute(profile, containerId, "start", `/containers/${encodeURIComponent(containerId)}/start`); }
  async stop(profile: DockerConnectionProfile, containerId: string, timeoutSeconds: number, graceful = false): Promise<void> { await this.execute(profile, containerId, graceful ? "shutdown" : "stop", `/containers/${encodeURIComponent(containerId)}/stop?t=${validTimeout(timeoutSeconds)}`); }
  async restart(profile: DockerConnectionProfile, containerId: string, timeoutSeconds: number): Promise<void> { await this.execute(profile, containerId, "restart", `/containers/${encodeURIComponent(containerId)}/restart?t=${validTimeout(timeoutSeconds)}`); }
  async update(profile: DockerConnectionProfile, containerId: string, confirm = true, signal?: AbortSignal, attemptId: string = crypto.randomUUID()): Promise<ContainerUpdateResult> {
    this.guard(profile, containerId); const transactionKey = key(profile.id, containerId); const controller = new AbortController(); if (signal?.aborted) controller.abort(); const abort = () => controller.abort(); signal?.addEventListener("abort", abort, { once: true }); this.activeUpdates.set(transactionKey, controller); this.progress.set(transactionKey, { action: "update", state: "preparing-update" }); this.emit(attemptId, profile.id, containerId, "inspecting", "running", "Inspecting container");
    let plan: ContainerRecreatePlan | undefined; let backupName: string | undefined; let replacementId: string | undefined; let replacementCreateResponseUncertain = false;
    const mutation = { originalStopped: false, originalRenamed: false, replacementCreated: false, replacementStarted: false, replacementVerified: false, backupRemoved: false };
    try {
      this.checkCancelled(controller); const transport = this.connections.create(profile), api = new DockerApiClient(transport);
      const raw = await api.get<unknown>(`/containers/${containerId}/json`); this.emit(attemptId, profile.id, containerId, "inspecting", "complete"); this.emit(attemptId, profile.id, containerId, "validating", "running", "Validating configuration"); plan = validateContainerRecreatePlan(buildContainerRecreatePlan(raw)); this.emit(attemptId, profile.id, containerId, "validating", "complete");
      this.checkCancelled(controller);
      this.progress.set(key(profile.id, containerId), { action: "update", state: "pulling-image" }); this.emit(attemptId, profile.id, containerId, "pulling-image", "running", "Pulling image");
      await this.mutate(transport, "POST", `/images/create?fromImage=${encodeURIComponent(repository(plan.imageReference))}&tag=${encodeURIComponent(tag(plan.imageReference))}`, undefined, "text");
      this.checkCancelled(controller); this.emit(attemptId, profile.id, containerId, "pulling-image", "complete"); this.emit(attemptId, profile.id, containerId, "comparing-images", "running", "Comparing image versions");
      const images = await api.get<Array<{ Id?: string; RepoTags?: string[] }>>("/images/json"); const newImageId = images.find((image) => image.RepoTags?.includes(plan!.imageReference))?.Id;
      if (!newImageId) throw new DockerConnectionError("CONTAINER_UPDATE_IMAGE_RESOLUTION_FAILED", "Docker pulled the image but its new image ID could not be resolved."); this.emit(attemptId, profile.id, containerId, "comparing-images", "complete");
      if (newImageId === plan.originalImageId && !confirm) return { status: "already-current", containerId, imageId: newImageId };
      if (!confirm) return { status: "cancelled" };
      backupName = `${plan.originalName}.docker-connector-backup-${Math.random().toString(36).slice(2, 10)}`;
      const existing = await api.get<Array<{ Names?: string[] }>>("/containers/json?all=true"); if (existing.some((container) => container.Names?.some((name) => name.replace(/^\//, "") === backupName))) throw new DockerConnectionError("CONTAINER_UPDATE_BACKUP_NAME_CONFLICT", "A safe backup name is already in use. Retry the update.");
      if (plan.wasRunning) { this.emit(attemptId, profile.id, containerId, "stopping-original", "running", "Stopping original container"); await this.mutate(transport, "POST", `/containers/${containerId}/stop?t=${plan.stopTimeout}`, undefined, "empty"); mutation.originalStopped = true; this.emit(attemptId, profile.id, containerId, "stopping-original", "complete"); }
      this.checkCancelled(controller);
      this.emit(attemptId, profile.id, containerId, "creating-backup", "running", "Creating rollback backup"); await this.mutate(transport, "POST", `/containers/${containerId}/rename?name=${encodeURIComponent(backupName)}`, undefined, "empty"); mutation.originalRenamed = true; this.emit(attemptId, profile.id, containerId, "creating-backup", "complete");
      this.checkCancelled(controller);
      this.emit(attemptId, profile.id, containerId, "creating-replacement", "running", "Creating replacement container"); const created = await this.mutate<{ Id?: string }>(transport, "POST", `/containers/create?name=${encodeURIComponent(plan.originalName)}`, JSON.stringify(plan.createPayload), "json"); replacementId = created.Id; if (!replacementId) { replacementCreateResponseUncertain = true; throw new DockerConnectionError("CONTAINER_UPDATE_CREATE_FAILED", "Docker did not return an ID for the replacement container."); } mutation.replacementCreated = true; this.emit(attemptId, profile.id, containerId, "creating-replacement", "complete");
      for (const network of plan.networks.slice(1)) { this.checkCancelled(controller); this.emit(attemptId, profile.id, containerId, "connecting-networks", "running", "Restoring network connections"); await this.mutate(transport, "POST", `/networks/${encodeURIComponent(network.id)}/connect`, JSON.stringify({ Container: replacementId, EndpointConfig: network.aliases.length ? { Aliases: network.aliases } : undefined }), "empty"); this.emit(attemptId, profile.id, containerId, "connecting-networks", "complete"); }
      if (plan.wasRunning) { this.emit(attemptId, profile.id, containerId, "starting-replacement", "running", "Starting replacement container"); await this.mutate(transport, "POST", `/containers/${replacementId}/start`, undefined, "empty"); mutation.replacementStarted = true; this.emit(attemptId, profile.id, containerId, "starting-replacement", "complete"); }
      this.checkCancelled(controller);
      this.emit(attemptId, profile.id, containerId, "verifying", "running", "Verifying replacement container"); await this.verifyReplacement(api, replacementId, plan, controller); mutation.replacementVerified = true; this.emit(attemptId, profile.id, containerId, "verifying", "complete");
      try { this.emit(attemptId, profile.id, containerId, "removing-backup", "running", "Removing rollback backup"); await this.mutate(transport, "DELETE", `/containers/${containerId}?v=false&force=false`, undefined, "empty"); mutation.backupRemoved = true; this.emit(attemptId, profile.id, containerId, "removing-backup", "complete"); } catch { this.progress.set(key(profile.id, containerId), { action: "update", state: "succeeded" }); this.emit(attemptId, profile.id, containerId, "completed", "warning", "Replacement is running; rollback backup was retained."); return { status: "updated-with-backup-retained", oldContainerId: containerId, newContainerId: replacementId, backupContainerName: backupName, oldImageId: plan.originalImageId, newImageId }; }
      this.progress.set(key(profile.id, containerId), { action: "update", state: "succeeded" }); this.emit(attemptId, profile.id, containerId, "completed", "complete", "Update complete"); return { status: "updated", oldContainerId: containerId, newContainerId: replacementId, oldImageId: plan.originalImageId, newImageId };
    } catch (error) {
      const typed = error instanceof DockerConnectionError ? error : new DockerConnectionError("CONTAINER_UPDATE_PULL_FAILED", "The container update could not be completed.");
      if (!plan || (!mutation.originalStopped && !mutation.originalRenamed)) { this.progress.set(key(profile.id, containerId), updateFailureProgress(typed)); return typed.code === "CONTAINER_UPDATE_CANCELLED" ? { status: "cancelled" } : { status: "failed-before-mutation", errorCode: typed.code }; }
      if (mutation.replacementVerified && typed.code === "CONTAINER_UPDATE_CANCELLED") return { status: "updated-with-backup-retained", oldContainerId: containerId, newContainerId: replacementId!, backupContainerName: backupName!, oldImageId: plan.originalImageId, newImageId: "unknown" };
      this.progress.set(key(profile.id, containerId), { action: "update", state: "verifying", safeMessage: "Rolling back the container update." }); this.emit(attemptId, profile.id, containerId, "rolling-back", "running", "Update failed. Restoring original container.");
      try { const transport = this.connections.create(profile), api = new DockerApiClient(transport); if (mutation.replacementCreated && replacementId) { if (mutation.replacementStarted) { try { await this.mutate(transport, "POST", `/containers/${replacementId}/stop?t=10`, undefined, "empty"); } catch {} } await this.mutate(transport, "DELETE", `/containers/${replacementId}?v=false&force=false`, undefined, "empty"); } if (mutation.originalRenamed) await this.mutate(transport, "POST", `/containers/${containerId}/rename?name=${encodeURIComponent(plan.originalName)}`, undefined, "empty"); if (plan.wasRunning && mutation.originalStopped) await this.mutate(transport, "POST", `/containers/${containerId}/start`, undefined, "empty"); const original = await api.get<{ State?: { Running?: boolean } }>(`/containers/${containerId}/json`); if (plan.wasRunning && !original.State?.Running) throw new DockerConnectionError("CONTAINER_UPDATE_ROLLBACK_FAILED", "The original container did not return to its prior running state."); if (replacementCreateResponseUncertain) throw new DockerConnectionError("CONTAINER_UPDATE_ROLLBACK_FAILED", "Docker created a replacement but did not return its identity. Manual recovery is required."); this.progress.set(key(profile.id, containerId), updateFailureProgress(typed)); return { status: "failed-rolled-back", originalContainerId: containerId, errorCode: typed.code }; }
      catch { const rollback = new DockerConnectionError("CONTAINER_UPDATE_ROLLBACK_FAILED", "Rollback could not complete. The original backup container needs manual recovery."); this.progress.set(key(profile.id, containerId), updateFailureProgress(rollback)); return { status: "failed-rollback-incomplete", errorCode: "CONTAINER_UPDATE_ROLLBACK_FAILED", safeRecoveryInstructions: `Original ${plan.originalName} (${containerId}) may remain as ${backupName ?? plan.originalName}; verify the replacement ${replacementId ?? "container"} before restoring it.` }; }
    } finally { plan = undefined; signal?.removeEventListener("abort", abort); this.activeUpdates.delete(transactionKey); if (!this.activeUpdates.size) { for (const resolve of this.drainWaiters) resolve(); this.drainWaiters.clear(); } }
  }
  private async execute(profile: DockerConnectionProfile, containerId: string, action: Exclude<ContainerAction, "update">, path: string): Promise<void> {
    this.guard(profile, containerId);
    if (this.isActive(profile.id, containerId)) throw new DockerConnectionError("CONTAINER_ACTION_ALREADY_RUNNING", "Another action is already running for this container.");
    const state: ContainerActionState = action === "start" ? "starting" : action === "restart" ? "restarting" : action === "shutdown" ? "shutting-down" : "stopping";
    this.progress.set(key(profile.id, containerId), { action, state });
    try { await this.connections.create(profile).request<void>({ method: "POST", path, responseType: "empty" }); this.progress.set(key(profile.id, containerId), { action, state: "succeeded" }); }
    catch (error) { const typed = actionFailure(action, error); this.progress.set(key(profile.id, containerId), { action, state: "failed", errorCode: typed.code, safeMessage: typed.message, failure: { action, errorCode: typed.code, safeMessage: typed.message, safeDetails: { httpStatus: typed.httpStatus, dockerMessage: typed.details } } }); throw typed; }
  }
  private async verifyReplacement(api: DockerApiClient, replacementId: string, plan: ContainerRecreatePlan, controller: AbortController): Promise<void> {
    const started = this.now();
    while (true) {
      this.checkCancelled(controller);
      const replacement = await api.get<{ State?: { Running?: boolean; Health?: { Status?: string } } }>(`/containers/${replacementId}/json`);
      if (plan.wasRunning && !replacement.State?.Running) throw new DockerConnectionError("CONTAINER_UPDATE_VERIFY_FAILED", "The replacement container did not reach its expected running state.");
      const health = replacement.State?.Health?.Status;
      if (!plan.healthcheck || health !== "starting") {
        if (plan.healthcheck && health === "unhealthy") throw new DockerConnectionError("CONTAINER_UPDATE_HEALTH_TIMEOUT", "The replacement container reported an unhealthy state.");
        return;
      }
      if (this.now() - started >= DEFAULT_UPDATE_HEALTH_VERIFICATION_TIMEOUT_MS) throw new DockerConnectionError("CONTAINER_UPDATE_HEALTH_TIMEOUT", "The replacement container did not become healthy before verification timed out.");
      await this.wait(DEFAULT_UPDATE_HEALTH_VERIFICATION_INTERVAL_MS);
    }
  }
  private guard(profile: DockerConnectionProfile, containerId: string): void { if (!this.acceptingActions) throw new DockerConnectionError("PLUGIN_UNLOADING", "Docker Connector is unloading and cannot start a new container action."); if (!this.managementEnabled(profile.id)) throw new DockerConnectionError("CONTAINER_ACTIONS_DISABLED", "Container management is not enabled for this connection in the current session."); if (!CONTAINER_ID.test(containerId)) throw new DockerConnectionError("CONTAINER_NOT_FOUND", "The selected container identity is invalid."); if (this.isActive(profile.id, containerId)) throw new DockerConnectionError("CONTAINER_ACTION_ALREADY_RUNNING", "Another action is already running for this container."); }
  private waitForDrain(): Promise<void> { if (!this.activeUpdates.size) return Promise.resolve(); return new Promise((resolve) => this.drainWaiters.add(resolve)); }
  private checkCancelled(controller: AbortController): void { if (controller.signal.aborted) throw new DockerConnectionError("CONTAINER_UPDATE_CANCELLED", "Container update was cancelled."); }
  private emit(attemptId: string, profileId: string, containerId: string, stage: ContainerUpdateStage, state: ContainerUpdateProgressEvent["state"], safeMessage?: string): void { const event = { attemptId, profileId, containerId, stage, state, timestamp: new Date().toISOString(), safeMessage }; this.updateProgressListeners.forEach((listener) => listener(event)); }
  private async mutate<T>(transport: { request<T>(request: { method: "POST" | "DELETE"; path: string; body?: string; responseType: "json" | "text" | "empty" }): Promise<T> }, method: "POST" | "DELETE", path: string, body: string | undefined, responseType: "json" | "text" | "empty"): Promise<T> { if (!/^\/images\/create\?fromImage=|^\/containers\/[a-f0-9]{12,64}\/(?:stop|rename|start)|^\/containers\/create\?name=|^\/networks\/[A-Za-z0-9_.-]+\/connect|^\/containers\/[a-f0-9]{12,64}\?v=false&force=false/.test(path)) throw new DockerConnectionError("CONTAINER_UPDATE_UNSUPPORTED", "This mutation route is not permitted by the container update transaction."); return transport.request<T>({ method, path, body, responseType }); }
}
function key(profileId: string, containerId: string): string { return `${profileId}:${containerId}`; }
function validTimeout(value: number): number { if (!Number.isInteger(value) || ![10, 30, 60].includes(value)) throw new DockerConnectionError("CONTAINER_STOP_FAILED", "Choose a supported shutdown timeout."); return value; }
function actionFailure(action: Exclude<ContainerAction, "update">, error: unknown): DockerConnectionError {
  const typed = error instanceof DockerConnectionError ? error : new DockerConnectionError(action === "start" ? "CONTAINER_START_FAILED" : action === "restart" ? "CONTAINER_RESTART_FAILED" : "CONTAINER_STOP_FAILED", "Docker did not accept the requested container action.");
  if (action !== "start") return typed;
  if (typed.httpStatus === 304) return new DockerConnectionError("CONTAINER_START_CONFLICT", "Container is already running.", typed.details, typed.httpStatus);
  if (typed.httpStatus === 404) return new DockerConnectionError("CONTAINER_NOT_FOUND", "The container no longer exists on this Docker host.", typed.details, typed.httpStatus);
  if (typed.httpStatus === 409) return new DockerConnectionError("CONTAINER_START_CONFLICT", "The container cannot be started because its state or configuration conflicts with the request.", typed.details, typed.httpStatus);
  if (typed.httpStatus === 500) return new DockerConnectionError("CONTAINER_START_FAILED", "Docker could not start the container.", typed.details, typed.httpStatus);
  return typed.code === "DOCKER_HTTP_FAILED" ? new DockerConnectionError("CONTAINER_START_FAILED", "Docker could not start the container.", typed.details, typed.httpStatus) : typed;
}
function updateFailureProgress(error: DockerConnectionError): ContainerActionProgress { return { action: "update", state: "failed", errorCode: error.code, safeMessage: error.message, failure: { action: "update", errorCode: error.code, safeMessage: error.message, safeDetails: { httpStatus: error.httpStatus, dockerMessage: error.details } } }; }
function repository(reference: string): string { return reference.slice(0, reference.lastIndexOf(":")); }
function tag(reference: string): string { return reference.slice(reference.lastIndexOf(":") + 1); }
function parseKey(value: string): { profileId: string; containerId: string } { const point = value.lastIndexOf(":"); return { profileId: value.slice(0, point), containerId: value.slice(point + 1) }; }
function recovery(status: UpdateUnloadRecoveryResult["status"], startedAt: string, started: number, transactionResults: UpdateUnloadRecoveryResult["transactionResults"]): UpdateUnloadRecoveryResult { const finishedAt = new Date().toISOString(); return { status, startedAt, finishedAt, durationMs: Date.now() - started, transactionResults }; }
function delay(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
