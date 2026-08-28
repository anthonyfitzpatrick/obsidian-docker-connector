import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { classifyHostFailure } from "../src/services/DockerInspectionService";
import { DockerConnectionError } from "../src/connections/DockerTransport";

const source = (path: string) => readFile(path, "utf8");

describe("rejected credential feedback", () => {
  it("treats every rejected SSH credential as an authentication outcome", () => {
    // A rejected credential must reach authentication-required, which is the
    // status that offers Reconnect. Degraded hid it from that affordance.
    for (const code of [
      "SSH_PASSWORD_REJECTED",
      "SSH_PRIVATE_KEY_PASSPHRASE_REJECTED",
      "SSH_KEYBOARD_INTERACTIVE_REJECTED",
      "SSH_AUTHENTICATION_FAILED",
    ]) {
      const failure = classifyHostFailure(new DockerConnectionError(code, `${code} message`));
      expect(failure.status).toBe("authentication-required");
      // The daemon-facing reason is carried through rather than replaced.
      expect(failure.error).toBe(`${code} message`);
    }
  });

  it("states the reason on the connection card for every status that is not online", async () => {
    // A rejected private key is degraded, which offers Retry rather than the
    // reconnect dialog, so the card is where the user finds out why.
    const view = await source("src/views/DockerDashboardView.ts");
    expect(view).toMatch(/status !== "online" && status !== "unknown" && status !== "connecting" && snapshot\?\.error/);
    expect(view).toContain("dc-connection-reason");
    expect(view).toContain("reason.createSpan({ text: snapshot.error })");
    const styles = await source("styles.css");
    // Tinted, not filled: a filled error background hides the text.
    expect(styles).toContain(".dc-connection-reason.is-danger");
    expect(styles).toContain(".dc-connection-reason.is-warning");
    expect(styles).not.toMatch(/\.dc-connection-reason[^{]*\{[^}]*background-color: var\(--background-modifier-error\)/);
  });

  it("keeps an unreachable host distinct from a refused credential", () => {
    expect(classifyHostFailure(new DockerConnectionError("SSH_CONNECTION_REFUSED", "refused")).status).toBe("offline");
  });

  it("leaves a key the server refuses as degraded, since asking again cannot fix it", () => {
    // Deliberately not authentication-required: the remedy is authorising the
    // key on the host, not re-entering a passphrase.
    expect(classifyHostFailure(new DockerConnectionError("SSH_PRIVATE_KEY_REJECTED", "refused key")).status).toBe("degraded");
  });

  it("reports a refused reconnection in the dialog instead of closing it", async () => {
    const view = await source("src/views/DockerDashboardView.ts");
    // reconnectHost records the outcome as a snapshot and does not throw, so
    // the dialog has to read the resulting status before it closes.
    expect(view).toMatch(/const snapshot = this\.plugin\.snapshots\.get\(this\.profile\.id\);/);
    expect(view).toMatch(/if \(snapshot && snapshot\.status !== "online"\)/);
    expect(view).toContain("this.reportFailure(");
    // The failure path returns early, leaving the dialog open to retry.
    const submit = view.slice(view.indexOf("private async submit()"));
    expect(submit.indexOf("reportFailure")).toBeLessThan(submit.indexOf("this.close()"));
    expect(view).toContain('attr: { role: "alert" }');
  });

  it("puts the failure under the field and before the action, with a legible tint", async () => {
    const [view, styles] = await Promise.all([source("src/views/DockerDashboardView.ts"), source("styles.css")]);
    const open = view.slice(view.indexOf("class ReconnectPasswordModal"), view.indexOf("private async submit()"));
    // Read order: password field, then why it failed, then Reconnect.
    expect(open.indexOf("dc-reconnect-error")).toBeLessThan(open.indexOf('setButtonText("Reconnect")'));
    // Obsidian renders the modal title; an h2 in the content duplicates it.
    expect(open).toContain("this.titleEl.setText(");
    expect(open).not.toMatch(/createEl\("h2"/);
    const rule = styles.slice(styles.indexOf(".dc-reconnect-error {"), styles.indexOf(".dc-reconnect-error__icon"));
    // A filled --background-modifier-error puts --text-error red on red.
    expect(rule).not.toContain("var(--background-modifier-error)");
    expect(rule).toContain("color-mix(");
    expect(rule).toContain("var(--dc-danger)");
  });
});
