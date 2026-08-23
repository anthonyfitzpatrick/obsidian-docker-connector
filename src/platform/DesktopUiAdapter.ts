import type { desktopUiServices } from "./DesktopUiServices";
import { platformCapabilities } from "./PlatformCapabilities";

export type DesktopUiServices = typeof desktopUiServices;
type PluginRuntime = unknown;
export function desktopUi(_plugin: PluginRuntime): DesktopUiServices {
  if (!platformCapabilities().isDesktop) throw new Error("DESKTOP_UI_UNAVAILABLE");
  // Esbuild keeps the desktop service graph in main.js without initializing it
  // on mobile, where this platform gate rejects before the internal require.
  return (require("./DesktopUiServices") as { desktopUiServices: DesktopUiServices }).desktopUiServices;
}
