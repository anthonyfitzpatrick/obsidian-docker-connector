import { describe, expect, it, vi } from "vitest";
import { canSaveDiscoveredDockerContext, mapDiscoveredDockerContextToProfile, updateDockerContextProfile } from "../src/connections/DockerContextProfileMapper";
import type { DiscoveredDockerContext } from "../src/connections/DockerContextDiscovery";
import { DockerHostManager } from "../src/services/DockerHostManager";

const context: DiscoveredDockerContext = {
  name: "staging",
  description: " Staging\ncontext ",
  isCurrent: true,
  dockerEndpoint: { rawHost: "ssh://deploy@example.test", displayHost: "deploy@example.test", type: "ssh", skipTlsVerify: false, hasTlsMaterial: true },
  supported: true
};

function profileFor(value = context) {
  return mapDiscoveredDockerContextToProfile({ id: "context-id", name: " Staging Docker ", description: " A safe description\n", category: " Team ", context: value, now: "2026-08-05T12:00:00.000Z" });
}

describe("Docker Context profile persistence", () => {
  it("maps only the safe discovered context snapshot", () => {
    const profile = profileFor();
    expect(profile).toEqual({ id: "context-id", name: "Staging Docker", description: "A safe description", category: "Team", connectionType: "docker-context", contextName: "staging", contextSnapshot: { description: "Stagingcontext", isCurrentWhenSaved: true, endpointType: "ssh", endpointDisplay: "example.test", skipTlsVerify: false, supported: true, importedAt: "2026-08-05T12:00:00.000Z", lastDiscoveredAt: "2026-08-05T12:00:00.000Z" }, enabled: true, createdAt: "2026-08-05T12:00:00.000Z", updatedAt: "2026-08-05T12:00:00.000Z" });
    const serialized = JSON.stringify(profile);
    ["rawHost", "password", "privateKey", "certificate", "environment", "localEndpoint", "sshHost"].forEach((value) => expect(serialized).not.toContain(value));
  });

  it("accepts supported endpoints and rejects unsafe, unknown, erroneous, or absent selections", () => {
    (["unix-socket", "windows-named-pipe", "ssh", "tcp-tls"] as const).forEach((type) => expect(canSaveDiscoveredDockerContext({ ...context, dockerEndpoint: { ...context.dockerEndpoint!, type } })).toBe(true));
    expect(canSaveDiscoveredDockerContext({ ...context, dockerEndpoint: { ...context.dockerEndpoint!, type: "tcp-insecure" } })).toBe(false);
    expect(canSaveDiscoveredDockerContext({ ...context, dockerEndpoint: { ...context.dockerEndpoint!, type: "unknown" } })).toBe(false);
    expect(canSaveDiscoveredDockerContext({ ...context, error: "context unavailable" })).toBe(false);
    expect(canSaveDiscoveredDockerContext(undefined)).toBe(false);
  });

  it("persists a valid profile as an untested profile without using connection services", async () => {
    const connectionFactory = { create: vi.fn() };
    const refreshAll = vi.fn();
    const contextLifecycle = { clear: vi.fn() };
    const plugin = { settings: { profiles: [] as ReturnType<typeof profileFor>[] }, snapshots: new Map(), connectionFactory, refreshAll, contextLifecycle, disconnectProfile: async () => undefined, invalidateProfileRefresh: vi.fn(), saveSettings: async () => undefined };
    await new DockerHostManager(plugin as never).add(profileFor());
    expect(plugin.settings.profiles).toEqual([profileFor()]);
    expect(plugin.snapshots.size).toBe(0);
    expect(connectionFactory.create).not.toHaveBeenCalled();
    expect(refreshAll).not.toHaveBeenCalled();
    expect(contextLifecycle.clear).toHaveBeenCalledWith("context-id");
    expect(plugin.invalidateProfileRefresh).toHaveBeenCalledWith("context-id");
  });

  it("rolls back the in-memory list when settings persistence fails", async () => {
    const existing = profileFor();
    const plugin = { settings: { profiles: [existing] }, snapshots: new Map(), contextLifecycle: { clear: vi.fn() }, disconnectProfile: async () => undefined, saveSettings: async () => { throw new Error("disk unavailable"); } };
    await expect(new DockerHostManager(plugin as never).add(profileFor())).rejects.toThrow("disk unavailable");
    expect(plugin.settings.profiles).toEqual([existing]);
  });

  it("updates only editable Context fields while preserving identity and safe persistence boundaries", () => {
    const existing = { ...profileFor(), enabled: false, createdAt: "2026-01-01T00:00:00.000Z" };
    const selected: DiscoveredDockerContext = { ...context, name: "production", description: "Production", isCurrent: false, dockerEndpoint: { ...context.dockerEndpoint!, displayHost: "admin@prod.example.test", type: "tcp-tls", skipTlsVerify: true } };
    const updated = updateDockerContextProfile({ existingProfile: existing, name: "Production Docker", description: "Primary", category: "Operations", selectedContext: selected, now: "2026-08-05T13:00:00.000Z" });
    expect(updated).toMatchObject({ id: "context-id", createdAt: "2026-01-01T00:00:00.000Z", enabled: false, updatedAt: "2026-08-05T13:00:00.000Z", name: "Production Docker", description: "Primary", category: "Operations", contextName: "production", contextSnapshot: { description: "Production", endpointType: "tcp-tls", endpointDisplay: "prod.example.test", skipTlsVerify: true, isCurrentWhenSaved: false } });
    expect(updated.contextSnapshot).not.toBe(selected as never);
    expect(JSON.stringify(updated)).not.toContain("rawHost");
  });

  it("updates an existing profile without duplication and rolls back a failed update", async () => {
    const existing = profileFor();
    const changed = updateDockerContextProfile({ existingProfile: existing, name: "Changed", selectedContext: { ...context, name: "other" }, now: "2026-08-05T13:00:00.000Z" });
    const contextLifecycle = { clear: vi.fn() };
    const plugin = { settings: { profiles: [existing] }, snapshots: new Map(), contextLifecycle, hasActiveContainerAction: vi.fn(() => false), disconnectProfile: async () => undefined, invalidateProfileRefresh: vi.fn(), saveSettings: async () => undefined };
    await new DockerHostManager(plugin as never).update(changed);
    expect(plugin.settings.profiles).toEqual([changed]);
    expect(contextLifecycle.clear).toHaveBeenCalledWith("context-id");
    expect(plugin.invalidateProfileRefresh).toHaveBeenCalledWith("context-id");

    const failing = { settings: { profiles: [existing] }, snapshots: new Map(), contextLifecycle: { clear: vi.fn() }, hasActiveContainerAction: vi.fn(() => false), disconnectProfile: async () => undefined, invalidateProfileRefresh: vi.fn(), saveSettings: async () => { throw new Error("disk unavailable"); } };
    await expect(new DockerHostManager(failing as never).update(changed)).rejects.toThrow("disk unavailable");
    expect(failing.settings.profiles).toEqual([existing]);
  });
});
