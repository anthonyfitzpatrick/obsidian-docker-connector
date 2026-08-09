import { describe, expect, it } from "vitest";
import { newerMajorMinorRelease, parseImageReference } from "../src/services/PublicImageReleaseUtils";

describe("public image release advisories", () => {
  it("parses anonymous public image references", () => {
    expect(parseImageReference("ghost:5-alpine")).toEqual({ registry: "docker.io", repository: "library/ghost", tag: "5-alpine" });
  });

  it("alerts for a major or minor release but ignores patch-only changes", () => {
    expect(newerMajorMinorRelease("5.2.1-alpine", ["5.2.9-alpine", "5.3.0-alpine"])).toBe("5.3");
    expect(newerMajorMinorRelease("5.2.1-alpine", ["5.2.9-alpine"])).toBeUndefined();
    expect(newerMajorMinorRelease("8.4", ["8.4.9", "9.0.1"])).toBe("9.0");
  });
});
