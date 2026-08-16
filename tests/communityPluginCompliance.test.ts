import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = async (file: string) => readFile(file, "utf8");

describe("Obsidian Community Plugin release guard", () => {
  it("keeps manifest, package, and version-map metadata aligned for the mobile-capable release", async () => {
    const [manifestText, packageText, versionsText] = await Promise.all([source("manifest.json"), source("package.json"), source("versions.json")]);
    const manifest = JSON.parse(manifestText) as { id: string; version: string; minAppVersion: string; isDesktopOnly: boolean };
    const packageJson = JSON.parse(packageText) as { version: string; license: string };
    const versions = JSON.parse(versionsText) as Record<string, string>;
    expect(manifest.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    expect(manifest.id).not.toMatch(/obsidian|plugin$/);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.version).toBe(manifest.version);
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
    expect(manifest.isDesktopOnly).toBe(false);
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

  it("keeps lifecycle cleanup and scoped interactive UI contracts in production source", async () => {
    const [main, dashboard, styles] = await Promise.all([source("src/main.ts"), source("src/views/DockerDashboardView.ts"), source("styles.css")]);
    expect(main).toMatch(/containerImageUpdates\.clearAll\(\)/);
    expect(main).toMatch(/connectionFactory\.disconnectAll\(\)/);
    expect(main).toMatch(/workspace\.detachLeavesOfType/);
    expect(dashboard).toMatch(/removeSettingsListener\?\.\(\)/);
    expect(dashboard).toMatch(/window\.clearInterval\(this\.relativeTimeTimer\)/);
    expect(styles).not.toMatch(/(^|\n)button\s*\{/);
    expect(styles).not.toMatch(/(^|\n)(input|select)\s*\{/);
    expect(styles).not.toMatch(/@import|https?:\/\//);
    expect(styles).toMatch(/\.docker-connector/);
  });

  it("ships documentation with valid README links and a complete screenshot capture plan", async () => {
    const [readme, guide] = await Promise.all([source("README.md"), source("User Guide.md")]);
    const links = [...readme.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g)].map((match) => decodeURIComponent(match[1]));
    await Promise.all(links.filter((link) => !/^[a-z]+:/i.test(link)).map((link) => access(link)));

    const headings = [...guide.matchAll(/^### Screenshot (\d{2}) —/gm)].map((match) => match[1]);
    const placeholders = [...guide.matchAll(/^> \*\*Screenshot placeholder (\d{2})\*\*/gm)].map((match) => match[1]);
    const filenames = [...guide.matchAll(/^> \*\*Suggested filename:\*\* `[^`/]+(?:\/[^`/]+)*\/(\d{2})-[^`]+`$/gm)].map((match) => match[1]);
    const checklist = [...guide.matchAll(/^\| (\d{2}) \| `\1-[^`]+` \|/gm)].map((match) => match[1]);
    const expected = Array.from({ length: 42 }, (_, index) => String(index + 1).padStart(2, "0"));
    expect([...headings].sort()).toEqual(expected);
    expect([...placeholders].sort()).toEqual(expected);
    expect([...filenames].sort()).toEqual(expected);
    expect(checklist).toEqual(expected);
    expect(guide).not.toMatch(/!\[[^\]]*\]\([^)]*user-guide\//);
    const appendixStart = guide.indexOf("# Appendix A — Screenshot production checklist");
    expect(appendixStart).toBeGreaterThan(0);
    expect(guide.slice(appendixStart)).not.toMatch(/^### Screenshot |^> \*\*Screenshot placeholder/m);
    expect([...guide.matchAll(/^> \*\*Screenshot placeholder \d{2}\*\*/gm)].every((match) => match.index! < appendixStart)).toBe(true);
  });

  it("keeps release artifacts free of embedded credential material", async () => {
    const release = await Promise.all([source("main.js"), source("manifest.json"), source("styles.css")]);
    const contents = release.join("\n");
    // ssh2 emits PEM parser/formatter strings (including its fixed Ed25519
    // capability probe) as part of the SSH implementation. Scan for project
    // fixtures and sentinels instead of treating that dependency code as a key.
    expect(contents).not.toContain("ssh2/test/fixtures");
    expect(contents).not.toContain("SECRET_TOKEN=do-not-render");
  });
});
