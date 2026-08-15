import { describe, expect, it } from "vitest";
import { ProfileRefreshTracker } from "../src/services/ProfileRefreshTracker";

describe("ProfileRefreshTracker", () => {
  it("lets only the latest same-profile request publish", () => {
    const tracker = new ProfileRefreshTracker();
    const older = tracker.begin("host-a");
    const newer = tracker.begin("host-a");

    expect(tracker.isCurrent("host-a", older)).toBe(false);
    expect(tracker.isCurrent("host-a", newer)).toBe(true);
  });

  it("keeps refresh authority isolated by stable profile ID", () => {
    const tracker = new ProfileRefreshTracker();
    const hostA = tracker.begin("host-a");
    const hostB = tracker.begin("host-b");

    tracker.begin("host-a");
    expect(tracker.isCurrent("host-a", hostA)).toBe(false);
    expect(tracker.isCurrent("host-b", hostB)).toBe(true);
  });

  it("invalidates an in-flight response when a profile is edited or deleted", () => {
    const tracker = new ProfileRefreshTracker();
    const beforeChange = tracker.begin("host-a");

    tracker.clear("host-a");
    expect(tracker.isCurrent("host-a", beforeChange)).toBe(false);

    const afterRecreate = tracker.begin("host-a");
    expect(afterRecreate).not.toBe(beforeChange);
    expect(tracker.isCurrent("host-a", afterRecreate)).toBe(true);
  });
});
