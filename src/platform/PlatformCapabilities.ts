/**
 * The single runtime boundary between portable UI/core code and host-specific
 * transports.  Mobile intentionally exposes only the HTTPS gateway path.
 */
export interface PlatformCapabilities {
  isDesktop: boolean;
  isMobile: boolean;
  supportsLocalDockerSocket: boolean;
  supportsNamedPipe: boolean;
  supportsDockerCli: boolean;
  supportsSshTransport: boolean;
  supportsNodeTls: boolean;
  supportsFilePathCredentials: boolean;
  supportsMobileRemoteTransport: boolean;
  supportsContainerManagement: boolean;
}

export type ObsidianPlatform = { isDesktop?: boolean; isMobile?: boolean };

export function detectPlatformCapabilities(platform: ObsidianPlatform = (globalThis as { Platform?: ObsidianPlatform }).Platform ?? { isDesktop: true }): PlatformCapabilities {
  const isDesktop = platform.isDesktop === true;
  return {
    isDesktop,
    isMobile: !isDesktop && platform.isMobile === true,
    supportsLocalDockerSocket: isDesktop,
    supportsNamedPipe: isDesktop,
    supportsDockerCli: isDesktop,
    supportsSshTransport: isDesktop,
    supportsNodeTls: isDesktop,
    supportsFilePathCredentials: isDesktop,
    // Gateway requests use the Web Fetch API and normal HTTPS, both available
    // in Obsidian's mobile WebView.
    supportsMobileRemoteTransport: true,
    supportsContainerManagement: isDesktop
  };
}

export const platformCapabilities = (): PlatformCapabilities => detectPlatformCapabilities();

export function isProfileSupportedOnPlatform(
  connectionType: "local" | "ssh" | "docker-context" | "docker-tls" | "gateway",
  capabilities = platformCapabilities()
): boolean {
  if (connectionType === "gateway") return capabilities.supportsMobileRemoteTransport;
  return capabilities.isDesktop;
}
