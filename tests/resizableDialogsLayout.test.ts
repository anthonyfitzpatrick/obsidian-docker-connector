import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("resizable large dialog layout", () => {
  it("uses one shared shell for Add/Edit hosts and the update workflow", async () => {
    const [dashboard, update] = await Promise.all([
      readFile("src/views/DockerDashboardView.ts", "utf8"),
      readFile("src/containers/ContainerUpdateDialog.ts", "utf8"),
    ]);

    expect(dashboard).toMatch(/class DockerHostModal extends Modal/);
    expect(dashboard).toMatch(/editingProfile \? "Edit Docker Host" : "Add Docker Host"/);
    expect(dashboard).toMatch(/modalEl\.addClass\("dc-resizable-modal"\)/);
    expect(update).toMatch(/modalEl\.addClasses\(\["dc-resizable-modal", "dc-update-dialog"\]\)/);
    expect(update).toMatch(/dc-update-dialog__body/);
  });

  it("keeps compact credential and deletion prompts out of the resizable shell", async () => {
    const dashboard = await readFile("src/views/DockerDashboardView.ts", "utf8");
    const reconnect = dashboard.slice(dashboard.indexOf("class ReconnectPasswordModal"), dashboard.indexOf("class DeleteConnectionModal"));
    const deletion = dashboard.slice(dashboard.indexOf("class DeleteConnectionModal"));

    expect(reconnect).not.toContain("dc-resizable-modal");
    expect(deletion).not.toContain("dc-resizable-modal");
  });

  it("uses a desktop native resize shell with scrollable bodies and touch-safe overrides", async () => {
    const css = await readFile("styles.css", "utf8");

    expect(css).toMatch(/\.modal\.dc-resizable-modal \{[^}]*max-width: calc\(100vw - 48px\)[^}]*max-height: calc\(100vh - 48px\)[^}]*overflow: hidden/s);
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\) and \(min-width: 621px\) \{ \.modal\.dc-resizable-modal \{ min-width: 480px; min-height: 360px; resize: both; \} \}/);
    expect(css).toMatch(/\.modal\.dc-resizable-modal \.modal-content \{[^}]*display: flex[^}]*flex-direction: column[^}]*overflow: hidden/s);
    expect(css).toMatch(/\.dc-host-modal__form \{[^}]*flex: 1 1 auto[^}]*min-height: 0[^}]*overflow: auto/s);
    expect(css).toMatch(/\.dc-update-dialog__body \{[^}]*flex: 1 1 auto[^}]*min-height: 0[^}]*overflow: auto/s);
    expect(css).toMatch(/@media \(hover: none\), \(pointer: coarse\), \(max-width: 620px\) \{ \.modal\.dc-resizable-modal \{[^}]*resize: none/s);
  });
});
