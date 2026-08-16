import type { desktopUiServices } from "./DesktopUiServices";
import { platformCapabilities } from "./PlatformCapabilities";

export type DesktopUiServices = typeof desktopUiServices;
export function desktopUi(): DesktopUiServices {
  if (!platformCapabilities().isDesktop) throw new Error("DESKTOP_UI_UNAVAILABLE");
  const load = (globalThis as { require?: (id: string) => unknown }).require;
  if (!load) throw new Error("DESKTOP_UI_LOADER_UNAVAILABLE");
  return (load("./desktop-ui") as { desktopUiServices: DesktopUiServices }).desktopUiServices;
}
