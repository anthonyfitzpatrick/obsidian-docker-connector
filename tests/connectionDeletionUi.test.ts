import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");

describe("saved connection deletion UI", () => {
  it("places one accessible Delete action on every connection-card branch", () => {
    expect((source.match(/this\.addDeleteAction\(actions, profile\)/g) ?? []).length).toBe(3);
    expect(source).toContain('"aria-label": `Delete connection ${profile.name}`');
    expect(source).toContain('setIcon(button, "trash-2")');
  });
  it("uses an explicit plugin-only confirmation instead of browser confirmation", () => {
    expect(source).toContain('text: "Delete connection?"');
    expect(source).toContain('This deletes only the saved Docker Connector connection profile and its cached session data.');
    expect(source).toContain('Containers, images, volumes, networks, SSH keys, TLS certificate files, and Docker Contexts are not deleted.');
    expect(source).not.toContain("window.confirm");
  });
  it("reconciles a deleted selected environment to an online profile, then a remaining profile, then all", () => {
    expect(source).toContain("private reconcileSelectedHostAfterDelete(profileId: string): void");
    expect(source).toContain('remaining.find((profile) => this.plugin.snapshots.get(profile.id)?.status === "online")?.id ?? remaining[0]?.id ?? "all"');
  });
});
