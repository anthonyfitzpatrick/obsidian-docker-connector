import { describe, expect, it } from "vitest";
import { detectPlatformCapabilities, isProfileSupportedOnPlatform } from "../src/platform/PlatformCapabilities";

describe("mobile capability boundary", () => {
  it("does not support any connection method on mobile", () => {
    const mobile = detectPlatformCapabilities({ isMobile: true, isDesktop: false });
    expect(mobile.isDesktop).toBe(false);
    expect(isProfileSupportedOnPlatform(mobile)).toBe(false);
    expect(isProfileSupportedOnPlatform(detectPlatformCapabilities({ isDesktop: true }))).toBe(true);
  });
});
