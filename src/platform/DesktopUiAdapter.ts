import type { desktopUiServices } from "./DesktopUiServices";
import { platformCapabilities } from "./PlatformCapabilities";
import { desktopPluginArtifactPath } from "./DesktopPluginArtifact";

export type DesktopUiServices = typeof desktopUiServices;
type PluginRuntime = { app: { vault: { adapter: unknown } }; manifest: { dir?: string } };
export function desktopUi(plugin: PluginRuntime): DesktopUiServices {
  if (!platformCapabilities().isDesktop) throw new Error("DESKTOP_UI_UNAVAILABLE");
  const load = (globalThis as { require?: (id: string) => unknown }).require;
  const artifact = desktopPluginArtifactPath(plugin.app.vault.adapter, plugin.manifest.dir, "desktop-ui.js");
  if (!load || !artifact) throw new Error("DESKTOP_UI_LOADER_UNAVAILABLE");
  return (load(artifact) as { desktopUiServices: DesktopUiServices }).desktopUiServices;
}
