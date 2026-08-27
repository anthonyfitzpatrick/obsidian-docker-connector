import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("resizable large dialog layout", () => {
  it("uses one shared shell for Add/Edit hosts and the update workflow", async () => {
    const [dashboard, update] = await Promise.all([
      readFile("src/views/DockerDashboardView.ts", "utf8"),
      readFile("src/containers/ContainerUpdateDialog.ts", "utf8"),
    ]);

    expect(dashboard).toMatch(/class DockerHostModal extends Modal/);
    expect(dashboard).toMatch(/editingProfile \? "Edit Docker host" : "Add Docker host"/);
    expect(dashboard).toMatch(/modalEl\.addClass\("dc-resizable-modal"\)/);
    expect(dashboard).toMatch(/FloatingModalController/);
    expect(dashboard).toMatch(/dc-floating-modal__header/);
    expect(dashboard).toMatch(/dc-floating-modal__close/);
    expect(update).toMatch(/modalEl\.addClasses\(\["dc-resizable-modal", "dc-update-dialog"\]\)/);
    expect(update).toMatch(/FloatingModalController/);
    expect(update).toMatch(/dc-floating-modal__header/);
    expect(update).toMatch(/dc-floating-modal__close/);
    expect(update).toMatch(/dc-update-dialog__body/);
  });

  it("keeps compact credential and deletion prompts out of the resizable shell", async () => {
    const dashboard = await readFile("src/views/DockerDashboardView.ts", "utf8");
    const reconnect = dashboard.slice(dashboard.indexOf("class ReconnectPasswordModal"), dashboard.indexOf("class DeleteConnectionModal"));
    const deletion = dashboard.slice(dashboard.indexOf("class DeleteConnectionModal"));

    expect(reconnect).not.toContain("dc-resizable-modal");
    expect(deletion).not.toContain("dc-resizable-modal");
    expect(reconnect).not.toContain("dc-floating-modal__header");
    expect(deletion).not.toContain("dc-floating-modal__header");
  });

  it("uses a desktop native resize shell with scrollable bodies and touch-safe overrides", async () => {
    const css = await readFile("styles.css", "utf8");

    expect(css).toMatch(/\.modal\.dc-resizable-modal \{[^}]*max-width: calc\(100vw - 24px\)[^}]*max-height: calc\(100vh - 24px\)[^}]*overflow: hidden/s);
    expect(css).toMatch(/\.modal\.dc-resizable-modal\.dc-floating-modal \{[^}]*position: fixed[^}]*transform: none[^}]*resize: both/s);
    expect(css).toMatch(/\.modal\.dc-resizable-modal \.modal-content \{[^}]*display: flex[^}]*flex-direction: column[^}]*overflow: hidden/s);
    expect(css).toMatch(/\.dc-host-modal__form \{[^}]*flex: 1 1 auto[^}]*min-width: 0[^}]*min-height: 0[^}]*overflow-x: hidden[^}]*overflow-y: auto/s);
    expect(css).toMatch(/\.dc-update-dialog__body \{[^}]*flex: 1 1 auto[^}]*min-width: 0[^}]*min-height: 0[^}]*overflow-x: hidden[^}]*overflow-y: auto/s);
    expect(css).toMatch(/@media \(hover: none\), \(pointer: coarse\), \(max-width: 620px\) \{ \.modal\.dc-resizable-modal \{[^}]*resize: none/s);
    expect(css).toMatch(/\.dc-floating-modal__header \{[^}]*flex: none/s);
    expect(css).toMatch(/\.dc-floating-modal__header \{ cursor: grab; user-select: none; touch-action: none; \}/);
    expect(css).toMatch(/\.dc-host-modal input, \.dc-host-modal select \{[^}]*max-width: 100%[^}]*box-sizing: border-box/s);
    expect(css).toMatch(/\.dc-host-modal__footer \{[^}]*flex-wrap: wrap/s);
  });
});
