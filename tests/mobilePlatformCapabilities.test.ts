import { describe, expect, it } from "vitest";
import { detectPlatformCapabilities, isProfileSupportedOnPlatform } from "../src/platform/PlatformCapabilities";
import { migrateProfiles } from "../src/settings/migration";

describe("mobile capability boundary", () => {
  it("keeps desktop transports unavailable while allowing the HTTPS gateway", () => {
    const mobile = detectPlatformCapabilities({ isMobile: true, isDesktop: false });
    expect(mobile.supportsDockerCli).toBe(false);
    expect(mobile.supportsSshTransport).toBe(false);
    expect(isProfileSupportedOnPlatform("gateway", mobile)).toBe(true);
    expect(isProfileSupportedOnPlatform("ssh", mobile)).toBe(false);
  });
  it("preserves synced desktop and gateway profiles without secrets", () => {
    const profiles = migrateProfiles({ profiles: [{ id: "desktop", name: "Local", connectionType: "local", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" } }, { id: "gateway", name: "Mobile", connectionType: "gateway", gatewayUrl: "https://docker.example.test" }] });
    expect(profiles.map((profile) => profile.connectionType)).toEqual(["local", "gateway"]);
    expect(JSON.stringify(profiles)).not.toContain("token");
  });
});
