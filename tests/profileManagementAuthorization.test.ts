import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { ProfileManagementAuthorization } from "../src/security/ProfileManagementAuthorization";
import { DockerContainerActionService } from "../src/services/DockerContainerActionService";
import type { DockerConnectionProfile } from "../src/models/DockerConnectionProfile";

const profile = (id: string): DockerConnectionProfile => ({ id, name: id, connectionType: "local", enabled: true, createdAt: "", updatedAt: "", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" } });
const containerId = "a".repeat(64);

describe("profile-scoped container management", () => {
  it("keeps profile authorizations isolated and clears them on session reset", () => {
    const authorization = new ProfileManagementAuthorization();
    authorization.enable("a"); authorization.enable("c");
    expect(authorization.isEnabled("a")).toBe(true); expect(authorization.isEnabled("b")).toBe(false); expect(authorization.isEnabled("c")).toBe(true);
    authorization.disable("a"); expect(authorization.isEnabled("a")).toBe(false); expect(authorization.isEnabled("c")).toBe(true);
    authorization.clear(); expect(authorization.isEnabled("c")).toBe(false);
  });
  it("starts every fresh authorization store read-only", () => { expect(new ProfileManagementAuthorization().isEnabled("a")).toBe(false); });
  it("removes authorization immediately when a profile is deleted", () => { const authorization = new ProfileManagementAuthorization(); authorization.enable("gone"); authorization.disable("gone"); expect(authorization.isEnabled("gone")).toBe(false); });
  it("permits multiple explicit profile authorizations without transferring them", () => { const authorization = new ProfileManagementAuthorization(); authorization.enable("a"); authorization.enable("c"); expect(["a", "b", "c"].map((id) => authorization.isEnabled(id))).toEqual([true, false, true]); });
  it("does not authorize an aggregate environment identity", () => { const authorization = new ProfileManagementAuthorization(); authorization.enable("a"); expect(authorization.isEnabled("all")).toBe(false); });
  it("gates every typed mutation by the owning profile ID", async () => {
    const authorization = new ProfileManagementAuthorization(); authorization.enable("a");
    const request = vi.fn().mockResolvedValue(undefined);
    const service = new DockerContainerActionService({ create: vi.fn(() => ({ request })) } as never, (id) => authorization.isEnabled(id));
    await service.start(profile("a"), containerId);
    await expect(service.start(profile("b"), containerId)).rejects.toMatchObject({ code: "CONTAINER_ACTIONS_DISABLED" });
    await expect(service.stop(profile("b"), containerId, 10)).rejects.toMatchObject({ code: "CONTAINER_ACTIONS_DISABLED" });
    await expect(service.stop(profile("b"), containerId, 30, true)).rejects.toMatchObject({ code: "CONTAINER_ACTIONS_DISABLED" });
    await expect(service.restart(profile("b"), containerId, 10)).rejects.toMatchObject({ code: "CONTAINER_ACTIONS_DISABLED" });
    await expect(service.update(profile("b"), containerId)).rejects.toMatchObject({ code: "CONTAINER_ACTIONS_DISABLED" });
  });
  it("uses profile IDs at the backend gate and never persists a global management toggle", async () => {
    const [main, settings, actions, containers, dashboard] = await Promise.all([readFile("src/main.ts", "utf8"), readFile("src/settings/settings.ts", "utf8"), readFile("src/services/DockerContainerActionService.ts", "utf8"), readFile("src/containers/ContainersTab.ts", "utf8"), readFile("src/views/DockerDashboardView.ts", "utf8")]);
    expect(main).toMatch(/new ProfileManagementAuthorization/); expect(main).toMatch(/managementAuthorization\.clear\(\)/); expect(main).toMatch(/clearProfileManagementAuthorization\(profileId\)/);
    expect(settings).not.toMatch(/Container management/); expect(settings).not.toMatch(/containerManagementEnabled/);
    expect(actions).toMatch(/managementEnabled\(profile\.id\)/); expect(containers).toMatch(/isProfileManagementEnabled\(profile\.id\)/);
    expect(dashboard).toMatch(/Enable management for this session/); expect(dashboard).toMatch(/selectedHostId === "all"/);
  });
});
