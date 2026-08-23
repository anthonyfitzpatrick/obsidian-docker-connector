import { describe, expect, it, vi } from "vitest";
import { DockerHostManager } from "../src/services/DockerHostManager";
import type { LocalDockerProfile, SshDockerProfile } from "../src/models/DockerConnectionProfile";

const profile = (id: string): LocalDockerProfile => ({ id, name: id, connectionType: "local", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" }, enabled: true, createdAt: "", updatedAt: "" });

function subject(profiles = [profile("one"), profile("two")]) {
  const plugin = { settings: { profiles }, saveSettings: vi.fn(async () => undefined), hasActiveContainerAction: vi.fn(() => false), disconnectProfile: vi.fn(async () => undefined), invalidateProfileRefresh: vi.fn(), clearRuntimeCredentials: vi.fn(), clearDeletedProfileState: vi.fn(), refreshDashboard: vi.fn(), contextLifecycle: { clear: vi.fn() }, takeRememberedSshPassword: vi.fn(), restoreRememberedSshPassword: vi.fn() };
  return { plugin, manager: new DockerHostManager(plugin as never) };
}

describe("DockerHostManager profile deletion", () => {
  it("removes only the requested stable profile ID after persistence and clears plugin-owned runtime state", async () => {
    const { plugin, manager } = subject();
    await manager.remove("one");
    expect(plugin.settings.profiles.map((item) => item.id)).toEqual(["two"]);
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    expect(plugin.invalidateProfileRefresh).not.toHaveBeenCalled();
    expect(plugin.disconnectProfile).toHaveBeenCalledWith("one");
    expect(plugin.clearRuntimeCredentials).toHaveBeenCalledWith("one");
    expect(plugin.takeRememberedSshPassword).toHaveBeenCalledWith("one");
    expect(plugin.clearDeletedProfileState).toHaveBeenCalledWith("one");
    expect(plugin.refreshDashboard).toHaveBeenCalledOnce();
  });
  it("removes a remembered password before a saved SSH identity changes and restores it if persistence fails", async () => {
    const ssh: SshDockerProfile = { id: "ssh", name: "SSH", enabled: true, createdAt: "", updatedAt: "", connectionType: "ssh", sshHost: "one.example.test", sshPort: 22, sshUsername: "user", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock", hostKeyFingerprint: "SHA256:test" };
    const { plugin, manager } = subject([ssh] as never);
    plugin.takeRememberedSshPassword.mockReturnValue("remembered");
    await manager.update({ ...ssh, sshHost: "two.example.test" });
    expect(plugin.takeRememberedSshPassword).toHaveBeenCalledWith("ssh");

    plugin.saveSettings.mockRejectedValueOnce(new Error("disk unavailable"));
    await expect(manager.update({ ...ssh, sshUsername: "other" })).rejects.toThrow("disk unavailable");
    expect(plugin.restoreRememberedSshPassword).toHaveBeenCalledWith("ssh", "remembered");
  });
  it("restores the visible profile and leaves runtime state alone when persistence fails", async () => {
    const { plugin, manager } = subject();
    plugin.saveSettings.mockRejectedValueOnce(new Error("disk unavailable"));
    await expect(manager.remove("one")).rejects.toThrow("disk unavailable");
    expect(plugin.settings.profiles.map((item) => item.id)).toEqual(["one", "two"]);
    expect(plugin.disconnectProfile).not.toHaveBeenCalled();
    expect(plugin.clearRuntimeCredentials).not.toHaveBeenCalled();
  });
  it("blocks deletion while a container operation is active", async () => {
    const { plugin, manager } = subject(); plugin.hasActiveContainerAction.mockReturnValue(true);
    await expect(manager.remove("one")).rejects.toThrow("currently in progress");
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });
  it("blocks connection edits while an active container operation still needs its transport", async () => {
    const { plugin, manager } = subject(); plugin.hasActiveContainerAction.mockReturnValue(true);
    await expect(manager.update({ ...profile("one"), name: "Changed" })).rejects.toThrow("currently in progress");
    expect(plugin.saveSettings).not.toHaveBeenCalled();
    expect(plugin.disconnectProfile).not.toHaveBeenCalled();
  });
});
