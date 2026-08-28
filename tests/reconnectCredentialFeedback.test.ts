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
});
