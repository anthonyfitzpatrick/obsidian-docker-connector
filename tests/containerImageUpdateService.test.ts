import { describe, expect, it, vi } from "vitest";
import { ContainerImageUpdateService, DEFAULT_CONTAINER_UPDATE_CHECK_INTERVAL_MS } from "../src/services/ContainerImageUpdateService";
import type { DockerConnectionProfile } from "../src/models/DockerConnectionProfile";

const profile: DockerConnectionProfile = { id: "host", name: "Host", connectionType: "local", enabled: true, createdAt: "x", updatedAt: "x", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" } };
const id = "a".repeat(64);
const inspect = { Id: id, Name: "/ghost", Config: { Image: "ghost:5-alpine", Env: ["SECRET=value"], Labels: {} }, Image: "sha256:old", State: { Running: true }, HostConfig: {}, Mounts: [], NetworkSettings: { Networks: { bridge: { NetworkID: "bridge" } } } };
function subject(remote = "sha256:new", now = 1_000) { const request = vi.fn(async (call: { method: string; path: string }) => { if (call.path.endsWith(`/containers/${id}/json`)) return inspect; if (call.path === "/images/json") return [{ Id: remote, RepoTags: ["ghost:5-alpine"] }]; return ""; }); return { service: new ContainerImageUpdateService({ create: vi.fn(() => ({ request })) } as never, () => now), request }; }

describe("ContainerImageUpdateService", () => {
  it("clears a profile's in-flight update-check status without allowing an aborted check to republish it", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const request = vi.fn(async () => { await pending; return { Id: id, Name: "/ghost", Config: { Image: "ghost:5-alpine" }, Image: "sha256:old", State: { Running: true }, HostConfig: {}, Mounts: [], NetworkSettings: { Networks: { bridge: {} } } }; });
    const service = new ContainerImageUpdateService({ create: vi.fn(() => ({ request })) } as never);
    const check = service.check(profile, id, true);
    service.clearProfile(profile.id);
    release?.();
    await check;
    expect(service.getStatus(profile.id, id)).toBeUndefined();
  });
  it("does not republish after deletion when an image pull completes after cancellation", async () => {
    let releasePull: (() => void) | undefined;
    const pullPending = new Promise<void>((resolve) => { releasePull = resolve; });
    const request = vi.fn(async (call: { path: string }) => {
      if (call.path.endsWith(`/containers/${id}/json`)) return inspect;
      if (call.path.startsWith("/images/create")) { await pullPending; return ""; }
      if (call.path === "/images/json") return [{ Id: "sha256:new", RepoTags: ["ghost:5-alpine"] }];
      return undefined;
    });
    const service = new ContainerImageUpdateService({ create: vi.fn(() => ({ request })) } as never);
    const published: string[] = [];
    service.onStatusChange((status) => published.push(status.state));
    const check = service.check(profile, id, true);
    await vi.waitFor(() => expect(request.mock.calls.some(([call]) => (call as { path: string }).path.startsWith("/images/create"))).toBe(true));
    service.clearProfile(profile.id);
    releasePull?.();
    await check;
    expect(service.getStatus(profile.id, id)).toBeUndefined();
    expect(published).not.toContain("available");
  });
  it("publishes available when the pulled image differs without container mutation", async () => { const { service, request } = subject(); const result = await service.check(profile, id); expect(result).toMatchObject({ pullPerformed: true, status: { state: "available", currentImageId: "sha256:old", remoteImageId: "sha256:new", lastCheckedAt: new Date(1_000).toISOString(), nextCheckAt: new Date(1_000 + DEFAULT_CONTAINER_UPDATE_CHECK_INTERVAL_MS).toISOString() } }); expect(request.mock.calls.map(([call]) => call)).toEqual(expect.arrayContaining([expect.objectContaining({ method: "GET", path: `/containers/${id}/json` }), expect.objectContaining({ method: "POST", path: "/images/create?fromImage=ghost&tag=5-alpine" }), expect.objectContaining({ method: "GET", path: "/images/json" })])); expect(request.mock.calls.some(([call]) => /\/containers\/.+\/(?:start|stop|restart|rename)|\/containers\/create|DELETE/.test(call.path))).toBe(false); expect(JSON.stringify(result)).not.toContain("SECRET"); });
  it("publishes current for identical image IDs and skips a fresh duplicate check", async () => { const { service, request } = subject("sha256:old"); await expect(service.check(profile, id)).resolves.toMatchObject({ status: { state: "current" } }); await expect(service.check(profile, id)).resolves.toMatchObject({ pullPerformed: false, status: { state: "current" } }); expect(request).toHaveBeenCalledTimes(3); });
  it("coalesces duplicate checks and isolates hosts", async () => { const { service, request } = subject(); await Promise.all([service.check(profile, id, true), service.check(profile, id, true)]); expect(request.mock.calls.filter(([call]) => call.path.startsWith("/images/create")).length).toBe(1); const other = { ...profile, id: "other" }; await service.check(other, id, true); expect(request.mock.calls.filter(([call]) => call.path.startsWith("/images/create")).length).toBe(2); });
  it("uses the 24-hour boundary and safely retries invalid freshness timestamps", () => { const { service } = subject("sha256:old", 1_000); service.markCurrent(profile.id, id, "ghost", "ghost:5-alpine", "sha256:old"); expect(service.isStale(profile.id, id)).toBe(false); const status = service.getStatus(profile.id, id)!; status.nextCheckAt = new Date(1_000).toISOString(); expect(service.isStale(profile.id, id)).toBe(true); status.nextCheckAt = "not-a-date"; expect(service.isStale(profile.id, id)).toBe(true); status.nextCheckAt = new Date(2_000).toISOString(); expect(service.isStale(profile.id, id)).toBe(false); });
  it("reports availability for Compose-managed containers without authorizing a standalone update", async () => { const compose = { ...inspect, Config: { ...inspect.Config, Labels: { "com.docker.compose.project": "site" } } }; const request = vi.fn(async (call: { path: string }) => call.path.endsWith(`/containers/${id}/json`) ? compose : call.path === "/images/json" ? [{ Id: "sha256:new", RepoTags: ["ghost:5-alpine"] }] : ""); const service = new ContainerImageUpdateService({ create: vi.fn(() => ({ request })) } as never); await expect(service.check(profile, id)).resolves.toMatchObject({ pullPerformed: true, status: { state: "available" } }); expect(request.mock.calls.some(([call]) => /\/containers\/.+\/(?:start|stop|restart|rename)|\/containers\/create|DELETE/.test(call.path))).toBe(false); });
  it("records unpullable images as unsupported without leaving checking state", async () => { const unpullable = { ...inspect, Config: { ...inspect.Config, Image: "ghost" } }; const request = vi.fn(async (call: { path: string }) => call.path.endsWith(`/containers/${id}/json`) ? unpullable : []); const service = new ContainerImageUpdateService({ create: vi.fn(() => ({ request })) } as never); await expect(service.check(profile, id)).resolves.toMatchObject({ pullPerformed: false, status: { state: "unsupported", errorCode: "CONTAINER_UPDATE_IMAGE_UNPULLABLE" } }); });
  it("moves a trusted replacement to current and clears old status", () => { const { service } = subject(); service.markCurrent(profile.id, id, "ghost", "ghost:5-alpine", "sha256:old"); service.clearStatus(profile.id, id); service.markCurrent(profile.id, "b".repeat(64), "ghost", "ghost:5-alpine", "sha256:new"); expect(service.getStatus(profile.id, id)).toBeUndefined(); expect(service.getStatus(profile.id, "b".repeat(64))).toMatchObject({ state: "current", currentImageId: "sha256:new" }); });
});
