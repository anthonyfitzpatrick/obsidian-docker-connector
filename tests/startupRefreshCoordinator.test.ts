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

  it("retries from the layout-ready hook when the early startup request fails", async () => {
    const coordinator = new StartupRefreshCoordinator();
    let calls = 0;
    const refresh = () => ++calls === 1 ? Promise.reject(new Error("EPROTO")) : Promise.resolve("online");

    await expect(coordinator.run(refresh)).rejects.toThrow("EPROTO");
    await expect(coordinator.run(refresh)).resolves.toBe("online");
    expect(calls).toBe(2);
  });

  it("does not overlap refresh attempts while the first startup request is running", async () => {
    const coordinator = new StartupRefreshCoordinator();
    let resolve!: (value: string) => void;
    const first = coordinator.run(() => new Promise<string>((done) => { resolve = done; }));

    expect(coordinator.run(() => Promise.resolve("second"))).toBeUndefined();
    resolve("first");
    await expect(first).resolves.toBe("first");
  });
});
