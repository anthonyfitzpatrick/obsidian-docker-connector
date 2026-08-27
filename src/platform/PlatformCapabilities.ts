/**
 * The single runtime boundary between portable UI/core code and the desktop
 * transports. Every connection method needs Node APIs, so one fact decides
 * whether any of them may be constructed.
 */
export interface PlatformCapabilities {
  isDesktop: boolean;
}

export type ObsidianPlatform = { isDesktop?: boolean; isMobile?: boolean };

/** Obsidian publishes its Platform helper on the renderer window; tests pass one in directly. */
function obsidianPlatform(): ObsidianPlatform | undefined {
  return typeof window === "undefined" ? undefined : (window as Window & { Platform?: ObsidianPlatform }).Platform;
}

export function detectPlatformCapabilities(platform: ObsidianPlatform = obsidianPlatform() ?? { isDesktop: true }): PlatformCapabilities {
  return { isDesktop: platform.isDesktop === true };
}

export const platformCapabilities = (): PlatformCapabilities => detectPlatformCapabilities();

export function isProfileSupportedOnPlatform(capabilities = platformCapabilities()): boolean {
  return capabilities.isDesktop;
}
