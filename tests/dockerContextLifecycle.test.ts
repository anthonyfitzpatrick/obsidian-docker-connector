import { describe, expect, it } from "vitest";
import { DockerContextLifecycleCache, evaluateDockerContextLifecycle, unavailableDockerContextLifecycle } from "../src/connections/DockerContextLifecycle";
import type { DiscoveredDockerContext } from "../src/connections/DockerContextDiscovery";
import type { DockerContextProfile } from "../src/models/DockerConnectionProfile";

const profile: DockerContextProfile = { id: "context", name: "Context", connectionType: "docker-context", contextName: "saved", enabled: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", contextSnapshot: { endpointType: "ssh", endpointDisplay: "host.example", skipTlsVerify: false, supported: true, isCurrentWhenSaved: false, importedAt: "2026-01-01T00:00:00.000Z", lastDiscoveredAt: "2026-01-01T00:00:00.000Z" } };
const context: DiscoveredDockerContext = { name: "saved", isCurrent: false, dockerEndpoint: { rawHost: "ssh://user@host.example", displayHost: "user@host.example", type: "ssh", skipTlsVerify: false, hasTlsMaterial: false }, supported: true };
const now = "2026-08-05T14:00:00.000Z";

describe("Docker Context lifecycle evaluation", () => {
  it("reports an unchanged Context without mutating saved or discovery data", () => {
    const before = JSON.stringify([profile, context]);
    expect(evaluateDockerContextLifecycle(profile, [context], now)).toMatchObject({ state: "unchanged", changes: [] });
    expect(JSON.stringify([profile, context])).toBe(before);
  });
  it("reports a missing Context without selecting another Context", () => expect(evaluateDockerContextLifecycle(profile, [{ ...context, name: "current", isCurrent: true }], now)).toMatchObject({ state: "missing", errorCode: "DOCKER_CONTEXT_NOT_FOUND" }));
  it("detects only safe endpoint metadata changes", () => {
    expect(evaluateDockerContextLifecycle(profile, [{ ...context, dockerEndpoint: { ...context.dockerEndpoint!, type: "tcp-tls", displayHost: "host.example" } }], now).changes.map((change) => change.field)).toEqual(["endpoint-type"]);
    expect(evaluateDockerContextLifecycle(profile, [{ ...context, dockerEndpoint: { ...context.dockerEndpoint!, displayHost: "user@other.example" } }], now).changes.map((change) => change.field)).toEqual(["endpoint-display"]);
    expect(evaluateDockerContextLifecycle(profile, [{ ...context, dockerEndpoint: { ...context.dockerEndpoint!, skipTlsVerify: true } }], now).changes[0]).toMatchObject({ field: "skip-tls-verify", severity: "danger" });
    expect(evaluateDockerContextLifecycle(profile, [{ ...context, isCurrent: true, description: "changed only" }], now).state).toBe("unchanged");
  });
  it("gives insecure and unknown current Contexts unsupported precedence", () => {
    expect(evaluateDockerContextLifecycle(profile, [{ ...context, dockerEndpoint: { ...context.dockerEndpoint!, type: "tcp-insecure" }, supported: false }], now)).toMatchObject({ state: "unsupported", errorCode: "DOCKER_CONTEXT_INSECURE_TCP" });
    expect(evaluateDockerContextLifecycle(profile, [{ ...context, dockerEndpoint: { ...context.dockerEndpoint!, type: "unknown" }, supported: false }], now)).toMatchObject({ state: "unsupported", errorCode: "DOCKER_CONTEXT_UNSUPPORTED" });
    expect(evaluateDockerContextLifecycle(profile, [{ ...context, supported: false }], now)).toMatchObject({ state: "unsupported", currentSnapshot: { supported: false } });
  });
  it("keeps saved metadata available for CLI and discovery failures", () => {
    expect(unavailableDockerContextLifecycle(profile, { code: "DOCKER_CLI_NOT_FOUND" }, now)).toMatchObject({ state: "cli-unavailable", errorCode: "DOCKER_CLI_NOT_FOUND" });
    expect(unavailableDockerContextLifecycle(profile, { code: "DOCKER_CONTEXT_LIST_INVALID" }, now)).toMatchObject({ state: "discovery-error", errorCode: "DOCKER_CONTEXT_LIST_INVALID" });
  });
  it("caches only lifecycle results by profile ID and clears them", () => {
    const cache = new DockerContextLifecycleCache(); const result = evaluateDockerContextLifecycle(profile, [context], now);
    cache.set(profile.id, result); expect(cache.get(profile.id)).toEqual(result); expect(JSON.stringify(cache.get(profile.id))).not.toContain("rawHost"); cache.clear(profile.id); expect(cache.get(profile.id)).toBeUndefined();
  });
});
