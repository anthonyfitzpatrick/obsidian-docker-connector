/** Resolves a fixed plugin artifact through Obsidian's cross-platform vault adapter. */
export function desktopPluginArtifactPath(adapter: unknown, manifestDirectory: string | undefined, filename: string): string | undefined {
  if (!adapter || typeof adapter !== "object" || !("getFullPath" in adapter) || typeof adapter.getFullPath !== "function" || !manifestDirectory) return undefined;
  // Obsidian manifest directories use normalized vault-relative separators;
  // FileSystemAdapter.getFullPath performs the native macOS/Linux/Windows join.
  return adapter.getFullPath(`${manifestDirectory.replace(/\\/g, "/").replace(/\/+$/, "")}/${filename}`);
}
