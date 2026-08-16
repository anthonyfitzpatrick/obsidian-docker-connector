import { describe, expect, it } from "vitest";
import { StartupRefreshCoordinator } from "../src/lifecycle/StartupRefreshCoordinator";

describe("StartupRefreshCoordinator", () => {
  it("runs the initial startup refresh exactly once across plugin-load and layout-ready hooks", async () => {
    const coordinator = new StartupRefreshCoordinator();
    let calls = 0;
    const refresh = () => Promise.resolve(++calls);

    await expect(coordinator.run(refresh)).resolves.toBe(1);
    expect(coordinator.run(refresh)).toBeUndefined();
    expect(calls).toBe(1);
  });

  it("does not repeat a failed startup request from the second startup hook", async () => {
    const coordinator = new StartupRefreshCoordinator();
    const refresh = () => Promise.reject(new Error("EPROTO"));

    await expect(coordinator.run(refresh)).rejects.toThrow("EPROTO");
    expect(coordinator.run(refresh)).toBeUndefined();
  });
});
