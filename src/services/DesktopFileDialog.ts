/** Narrow desktop-only adapter; Obsidian's Electron renderer exposes @electron/remote. */
export class DesktopFileDialog {
  async chooseFile(title: string): Promise<string | undefined> {
    const desktopRequire = (globalThis as unknown as { require?: (name: string) => unknown }).require;
    if (!desktopRequire) throw new Error("File selection is available only in Obsidian desktop.");
    const remote = desktopRequire("@electron/remote") as { dialog?: { showOpenDialog(options: { properties: string[]; title: string }): Promise<{ canceled: boolean; filePaths: string[] }> } };
    if (!remote.dialog) throw new Error("File selection is unavailable in this Obsidian environment.");
    const result = await remote.dialog.showOpenDialog({ title, properties: ["openFile"] }); return result.canceled ? undefined : result.filePaths[0];
  }
  async choosePrivateKey(): Promise<string | undefined> {
    return this.chooseFile("Choose SSH private key");
  }
}
