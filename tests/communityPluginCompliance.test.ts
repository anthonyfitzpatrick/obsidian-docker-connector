import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = async (file: string) => readFile(file, "utf8");

describe("Obsidian Community Plugin release guard", () => {
  it("keeps manifest, package, and version-map metadata aligned for the desktop-only release", async () => {
    const [manifestText, packageText, versionsText] = await Promise.all([source("manifest.json"), source("package.json"), source("versions.json")]);
    const manifest = JSON.parse(manifestText) as { id: string; version: string; minAppVersion: string; isDesktopOnly: boolean };
    const packageJson = JSON.parse(packageText) as { version: string; license: string };
    const versions = JSON.parse(versionsText) as Record<string, string>;
    expect(manifest.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    expect(manifest.id).not.toMatch(/obsidian|plugin$/);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.version).toBe(manifest.version);
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
    expect(manifest.isDesktopOnly).toBe(true);
    expect(packageJson.license).toBe("MIT");
  });

  it("ships the required Community Plugin release artifacts", async () => {
    await expect(Promise.all([source("main.js"), source("manifest.json"), source("styles.css")])).resolves.toHaveLength(3);
  });

  it("keeps prohibited Docker, TLS, and child-process patterns out of production source", async () => {
    const files = [
      "src/connections/DockerContextDialStdioTransport.ts",
      "src/connections/DockerContextDiscovery.ts",
      "src/connections/DockerCliResolver.ts",
      "src/connections/DockerMutualTlsTransport.ts",
      "src/connections/SystemSshDiagnostics.ts",
      "src/services/DockerApiClient.ts"
    ];
    const production = (await Promise.all(files.map(source))).join("\n");
    for (const prohibited of ["rejectUnauthorized: false", "shell: true", "context use", "context create", "context rm", "context import", "context export", "chmod 666"]) {
      expect(production).not.toContain(prohibited);
    }
    expect(production).toContain("rejectUnauthorized: true");
    expect(production).toContain("shell: false");
  });

  it("keeps the generic Docker API client GET-only and routes mutations through typed actions", async () => {
    const [api, actions] = await Promise.all([source("src/services/DockerApiClient.ts"), source("src/services/DockerContainerActionService.ts")]);
    expect(api).toContain('method: "GET"');
    expect(api).not.toMatch(/\b(post|delete)\s*</i);
    expect(actions).toContain('async start(');
    expect(actions).toContain('async update(');
  });

  it("does not use unsafe HTML insertion or persist runtime credential names", async () => {
    const files = ["src/main.ts", "src/settings/settings.ts", "src/views/DockerDashboardView.ts", "src/security/RuntimeCredentialStore.ts"];
    const production = (await Promise.all(files.map(source))).join("\n");
    for (const prohibited of ["innerHTML", "outerHTML", "insertAdjacentHTML", "localStorage", "sessionStorage"]) expect(production).not.toContain(prohibited);
    expect(production).not.toMatch(/saveData\([^)]*(password|passphrase|privateKey|certificate)/i);
  });
});
