import type { DockerContextProfile, DockerContextProfileSnapshot } from "../models/DockerConnectionProfile";
import type { DiscoveredDockerContext } from "./DockerContextDiscovery";
import { canSaveDiscoveredDockerContext, mapDiscoveredDockerContextSnapshot } from "./DockerContextProfileMapper";

export type DockerContextLifecycleState = "not-tested" | "unchanged" | "missing" | "changed" | "unsupported" | "cli-unavailable" | "discovery-error";
export interface DockerContextSnapshotChange { field: "endpoint-type" | "endpoint-display" | "skip-tls-verify" | "supported"; previousValue: string | boolean | undefined; currentValue: string | boolean | undefined; severity: "info" | "warning" | "danger"; }
export interface DockerContextLifecycleResult { state: DockerContextLifecycleState; savedContextName: string; currentSnapshot?: DockerContextProfileSnapshot; changes: DockerContextSnapshotChange[]; errorCode?: string; message?: string; checkedAt?: string; }

/** Compares persisted safe metadata with a read-only Docker CLI discovery result. */
export function evaluateDockerContextLifecycle(profile: DockerContextProfile, contexts: readonly DiscoveredDockerContext[], now: string): DockerContextLifecycleResult {
  const current = contexts.find((context) => context.name === profile.contextName);
  if (!current) return result(profile, "missing", now, [], "DOCKER_CONTEXT_NOT_FOUND", `The Docker context "${profile.contextName}" no longer exists in the local Docker CLI configuration.`);
  if (!canSaveDiscoveredDockerContext(current)) {
    const insecure = current.dockerEndpoint?.type === "tcp-insecure";
    return result(profile, "unsupported", now, [], insecure ? "DOCKER_CONTEXT_INSECURE_TCP" : "DOCKER_CONTEXT_UNSUPPORTED", insecure ? "The Docker context now uses insecure TCP and cannot be used." : "The Docker context is unsupported and cannot be used.", current);
  }
  const snapshot = mapDiscoveredDockerContextSnapshot(current, now, profile.contextSnapshot.importedAt);
  const changes = compare(profile.contextSnapshot, snapshot);
  return result(profile, changes.length ? "changed" : "unchanged", now, changes, changes.length ? "DOCKER_CONTEXT_CHANGED" : undefined, changes.length ? "Review the changes below before saving." : "The Docker Context matches the saved connection metadata.", current);
}

export function unavailableDockerContextLifecycle(profile: DockerContextProfile, error: unknown, now: string): DockerContextLifecycleResult {
  const code = error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "DOCKER_CONTEXT_DISCOVERY_FAILED";
  const cliUnavailable = code === "DOCKER_CLI_NOT_FOUND" || code === "DOCKER_CLI_EXECUTION_FAILED";
  return result(profile, cliUnavailable ? "cli-unavailable" : "discovery-error", now, [], code, cliUnavailable ? "Saved Context details are shown. Current metadata could not be checked." : "Docker Context discovery failed. Saved Context details are shown.");
}

/** Bounded transient cache; it deliberately stores no raw discovery objects. */
export class DockerContextLifecycleCache {
  private readonly values = new Map<string, DockerContextLifecycleResult>();
  get(profileId: string): DockerContextLifecycleResult | undefined { return this.values.get(profileId); }
  set(profileId: string, value: DockerContextLifecycleResult): void { this.values.set(profileId, value); }
  clear(profileId?: string): void { if (profileId) this.values.delete(profileId); else this.values.clear(); }
}

function result(profile: DockerContextProfile, state: DockerContextLifecycleState, now: string, changes: DockerContextSnapshotChange[], errorCode?: string, message?: string, current?: DiscoveredDockerContext): DockerContextLifecycleResult {
  return { state, savedContextName: profile.contextName, currentSnapshot: current ? currentSnapshot(current, now, profile.contextSnapshot.importedAt) : undefined, changes, errorCode, message, checkedAt: now };
}
function currentSnapshot(context: DiscoveredDockerContext, now: string, importedAt: string): DockerContextProfileSnapshot | undefined {
  if (canSaveDiscoveredDockerContext(context)) return mapDiscoveredDockerContextSnapshot(context, now, importedAt);
  const endpoint = context.dockerEndpoint;
  if (!endpoint) return undefined;
  return { description: clean(context.description), isCurrentWhenSaved: context.isCurrent, endpointType: endpoint.type, endpointDisplay: clean(endpoint.displayHost.replace(/^[^@]+@/, "")), skipTlsVerify: endpoint.skipTlsVerify, supported: false, importedAt, lastDiscoveredAt: now };
}
function clean(value: string | undefined): string | undefined { const cleaned = value?.trim().replace(/[\x00-\x1F\x7F]/g, ""); return cleaned || undefined; }
function compare(previous: DockerContextProfileSnapshot, current: DockerContextProfileSnapshot): DockerContextSnapshotChange[] {
  const fields: Array<[DockerContextSnapshotChange["field"], string | boolean | undefined, string | boolean | undefined]> = [["endpoint-type", previous.endpointType, current.endpointType], ["endpoint-display", previous.endpointDisplay, current.endpointDisplay], ["skip-tls-verify", previous.skipTlsVerify, current.skipTlsVerify], ["supported", previous.supported, current.supported]];
  return fields.filter(([, left, right]) => left !== right).map(([field, previousValue, currentValue]) => ({ field, previousValue, currentValue, severity: field === "endpoint-display" ? "info" : field === "skip-tls-verify" && previousValue === false && currentValue === true || field === "supported" && currentValue === false ? "danger" : "warning" }));
}
