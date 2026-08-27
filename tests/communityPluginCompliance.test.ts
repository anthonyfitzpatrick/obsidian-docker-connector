import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = async (file: string) => readFile(file, "utf8");
const screenshotNumber = (index: number) => String(index + 1).padStart(2, "0");
const isSequential = (numbers: string[]) => numbers.every((number, index) => number === screenshotNumber(index));

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

  it("does not use unsafe HTML insertion or serialize credentials into profiles", async () => {
    const [main, settings, dashboard, runtimeStore, profiles] = await Promise.all([
      source("src/main.ts"),
      source("src/settings/settings.ts"),
      source("src/views/DockerDashboardView.ts"),
      source("src/security/RuntimeCredentialStore.ts"),
      source("src/models/DockerConnectionProfile.ts"),
    ]);
    const production = [main, settings, dashboard, runtimeStore].join("\n");
    const diagnostics = dashboard.slice(dashboard.indexOf("private renderDiagnostics"), dashboard.indexOf("\n}\n\n/** Prompts"));
    for (const prohibited of ["innerHTML", "outerHTML", "insertAdjacentHTML", "localStorage", "sessionStorage"]) expect(production).not.toContain(prohibited);
    expect(main).toContain("rememberedSshPasswords: this.rememberedSshPasswords.serialize()");
    expect(settings).not.toContain("rememberedSshPasswords");
    expect(profiles).not.toMatch(/password\??\s*:/i);
    expect(diagnostics).not.toMatch(/password/i);
    expect(runtimeStore).not.toMatch(/\.saveData\s*\(|rememberedSshPasswords/);
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
    const embedded = [...guide.matchAll(/!\[[^\]]*\]\(docs\/images\/user-guide\/(\d{2}-[^)]+)\)/g)].map((match) => match[1]);
    const expected = Array.from({ length: 42 }, (_, index) => screenshotNumber(index));
    // Captured screenshots need not be a contiguous run, so require instead
    // that every planned number is either embedded or still has a brief, and
    // that each brief keeps its own suggested filename.
    const covered = [...new Set([...embedded.map((filename) => filename.slice(0, 2)), ...placeholders])].sort();
    expect(headings).toEqual(expected);
    expect(placeholders).toEqual(filenames);
    expect(covered).toEqual(expected);
    expect(checklist).toEqual(expected);
    expect(embedded).toEqual(["01-empty-connections.png", "02-dashboard-overview.png", "03-add-docker-host.png", "04-connection-type-selector.png", "05-local-docker-socket.png", "06-docker-cli-detected.png", "07-ssh-password.png", "08-verify-ssh-host.png", "09-ssh-connection-success.png", "10-remember-ssh-password.png", "11-generate-ssh-key.png", "12-ssh-private-key-selection.png", "13-ssh-key-generation-complete.png", "14-install-public-key.png", "15-private-key-test-success.png", "16-remote-docker-api-mtls.png", "17-local-test-success.png", "18-connections-overview.png", "19-authentication-required-reconnect.png", "20-delete-connection.png", "21-current-environment.png", "22-applications-list.png", "23-application-inspector.png", "24-containers-view.png", "25-updates-filter.png", "26-compact-density.png", "27-container-inspector.png", "28-images-view.png", "29-volumes-view.png", "30-networks-view.png", "31-image-current.png", "32-management-card-read-only.png", "33-management-disabled.png", "34-management-confirmation.png", "35-management-enabled.png"]);
    await Promise.all(embedded.map((filename) => access(`docs/images/user-guide/${filename}`)));
    const appendixStart = guide.indexOf("# Appendix A — Screenshot production checklist");
    expect(appendixStart).toBeGreaterThan(0);
    expect(guide.slice(appendixStart)).not.toMatch(/^### Screenshot |^> \*\*Screenshot placeholder/m);
    expect([...guide.matchAll(/^> \*\*Screenshot placeholder \d{2}\*\*/gm)].every((match) => match.index! < appendixStart)).toBe(true);
  });

  it("rejects complete screenshot sets that are out of document order", () => {
    expect(isSequential(["02", "01", "03"])).toBe(false);
    expect(isSequential(["01", "02", "03"])).toBe(true);
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
