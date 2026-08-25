import { describe, expect, it } from "vitest";
import { detectPlatformCapabilities, isProfileSupportedOnPlatform } from "../src/platform/PlatformCapabilities";

describe("mobile capability boundary", () => {
  it("does not support any connection method on mobile", () => {
    const mobile = detectPlatformCapabilities({ isMobile: true, isDesktop: false });
    expect(mobile.supportsDockerCli).toBe(false);
    expect(mobile.supportsSshTransport).toBe(false);
    (["local", "docker-context", "ssh", "docker-tls"] as const).forEach((connectionType) => {
      expect(isProfileSupportedOnPlatform(connectionType, mobile)).toBe(false);
    });
  });
});
