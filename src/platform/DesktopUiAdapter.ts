import { desktopUiServices } from "./DesktopUiServices";
import { platformCapabilities } from "./PlatformCapabilities";

export type DesktopUiServices = typeof desktopUiServices;

/**
 * The desktop capability gate for the modal helpers. The plugin is
 * desktop-only, so this guards the one case Obsidian cannot: a manifest that
 * is edited or ignored. Callers get a clear failure instead of a Node error.
 */
export function desktopUi(): DesktopUiServices {
  if (!platformCapabilities().isDesktop) throw new Error("DESKTOP_UI_UNAVAILABLE");
  return desktopUiServices;
}
