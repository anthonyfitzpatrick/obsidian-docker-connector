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
    // Obsidian types onunload as synchronous and never awaits it, so authority
    // must be revoked before it returns rather than after an await.
    expect(main).toMatch(/^  onunload\(\): void \{/m);
    expect(main).not.toMatch(/async onunload/);
    // Obsidian restores its own leaves; a plugin that detaches them on unload
    // destroys the user's layout on every update.
    expect(main).not.toMatch(/detachLeavesOfType/);
    expect(dashboard).toMatch(/removeSettingsListener\?\.\(\)/);
    expect(dashboard).toMatch(/window\.clearInterval\(this\.relativeTimeTimer\)/);
    expect(styles).not.toMatch(/(^|\n)button\s*\{/);
    expect(styles).not.toMatch(/(^|\n)(input|select)\s*\{/);
    expect(styles).not.toMatch(/@import|https?:\/\//);
    expect(styles).toMatch(/\.docker-connector/);
  });

  it("never assigns element styles directly", async () => {
    // obsidianmd/no-static-styles-assignment: styling belongs in styles.css,
    // and measured values go through setCssStyles or setCssProps.
    const sources = await Promise.all(["src/ui/ModalDragController.ts", "src/views/DockerDashboardView.ts", "src/containers/ContainersTab.ts", "src/settings/settings.ts"].map(source));
    for (const file of sources) expect(file).not.toMatch(/\.style\.[a-zA-Z]+\s*=/);
    expect(sources[0]).toContain("setCssStyles(");
  });

  it("keeps the stylesheet within the features Obsidian's CSS check accepts", async () => {
    const styles = await source("styles.css");
    // Override by specificity or source order, never by !important.
    expect(styles).not.toMatch(/!\s*important/);
    // :has invalidates broadly enough to cost frame time on large dashboards.
    expect(styles).not.toContain(":has(");
    // display: contents is only partially supported by the Obsidian versions
    // the checker tests against; the card markup places children directly.
    expect(styles).not.toContain("display: contents");
    // The reduced-motion reset has to stay last for source order to carry it.
    expect(styles.trimEnd().endsWith("}")).toBe(true);
    expect(styles.lastIndexOf("prefers-reduced-motion")).toBeGreaterThan(styles.lastIndexOf(".dc-connection-card"));
  });

  it("imports desktop modules statically behind the capability gate", async () => {
    // @typescript-eslint/no-require-imports: the plugin is desktop-only, so the
    // gate is what keeps Node transports off an unsupported platform, not a
    // deferred require.
    const sources = await Promise.all(["src/platform/DesktopUiAdapter.ts", "src/connections/DockerConnectionFactory.ts"].map(source));
    for (const file of sources) expect(file).not.toMatch(/(?<![.\w])require\(/);
    expect(sources[0]).toContain("DESKTOP_UI_UNAVAILABLE");
    expect(sources[1]).toContain("isProfileSupportedOnPlatform");
  });

  it("describes its settings once, for both rendering and settings search", async () => {
    // Obsidian 1.13 indexes getSettingDefinitions(); display() renders the same
    // array so the tab still works on the declared 1.7 minimum.
    const settings = await source("src/settings/settings.ts");
    expect(settings).toMatch(/getSettingDefinitions\(\)/);
    expect(settings).toMatch(/CONTROL_DEFINITIONS/);
    for (const key of ["automaticRefresh", "refreshIntervalMinutes", "integrateWithTheme"]) expect(settings).toContain(`key: "${key}"`);
  });

  it("publishes releases with build provenance attestations", async () => {
    const workflow = await source(".github/workflows/release.yml");
    expect(workflow).toContain("actions/attest-build-provenance");
    for (const asset of ["main.js", "manifest.json", "styles.css"]) expect(workflow).toContain(asset);
    // Attestation needs these two permissions; without them the step fails.
    expect(workflow).toMatch(/id-token: write/);
    expect(workflow).toMatch(/attestations: write/);
  });

  it("asks for confirmation through an Obsidian modal rather than a browser dialog", async () => {
    // obsidianmd/no-confirm: the browser dialog blocks Obsidian's renderer and
    // ignores the vault theme. Every prompt goes through ConfirmationModal.
    const sources = await Promise.all(["src/containers/ContainersTab.ts", "src/views/DockerDashboardView.ts", "src/settings/settings.ts", "src/ui/ConfirmationModal.ts"].map(source));
    for (const file of sources) expect(file).not.toMatch(/(?:window|globalThis)\.confirm\(|(?<![.\w])confirm\(`/);
    const [containers, dashboard, , modal] = sources;
    expect(modal).toMatch(/extends Modal/);
    // Declining any other way than the accepting button must not grant the action.
    expect(modal).toMatch(/private confirmed = false;/);
    for (const file of [containers, dashboard]) expect(file).toContain("ConfirmationModal");
  });

  it("keeps plugin code off the ambient globalThis", async () => {
    // obsidianmd/prefer-window: Obsidian pop-out windows each have their own
    // window, and globalThis hides which one a lookup meant.
    const sources = await Promise.all(["src/platform/PlatformCapabilities.ts", "src/services/DesktopFileDialog.ts", "src/views/DockerDashboardView.ts"].map(source));
    for (const file of sources) expect(file).not.toMatch(/globalThis/);
  });

  it("leaves the settings tab without a redundant title heading", async () => {
    // Obsidian labels the tab itself, so a plugin-name heading above a short
    // list of settings only repeats what the sidebar already says.
    const settings = await source("src/settings/settings.ts");
    // No heading element at the head of the tab. The About footer names the
    // plugin in its own block, which is not a settings heading.
    expect(settings).not.toMatch(/createEl\("h[1-3]"/);
    expect(settings).not.toMatch(/containerEl\.createEl\("h/);
    for (const setting of ["Automatic refresh", "Refresh interval", "Theme integration"]) expect(settings).toContain(setting);
  });

  it("ships documentation with valid README links and a fully illustrated guide", async () => {
    const [readme, guide] = await Promise.all([source("README.md"), source("User Guide.md")]);
    const links = [...readme.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g)].map((match) => decodeURIComponent(match[1]));
    await Promise.all(links.filter((link) => !/^[a-z]+:/i.test(link)).map((link) => access(link)));

    const embedded = [...guide.matchAll(/!\[[^\]]*\]\(docs\/images\/user-guide\/(\d{2}-[^)]+)\)/g)].map((match) => match[1]);
    expect(embedded).toEqual(["01-empty-connections.png", "02-dashboard-overview.png", "03-add-docker-host.png", "04-connection-type-selector.png", "05-local-docker-socket.png", "06-docker-cli-detected.png", "07-ssh-password.png", "08-verify-ssh-host.png", "09-ssh-connection-success.png", "10-remember-ssh-password.png", "11-generate-ssh-key.png", "12-ssh-private-key-selection.png", "13-ssh-key-generation-complete.png", "14-install-public-key.png", "15-private-key-test-success.png", "16-remote-docker-api-mtls.png", "17-local-test-success.png", "18-connections-overview.png", "19-authentication-required-reconnect.png", "20-delete-connection.png", "21-current-environment.png", "22-applications-list.png", "23-application-inspector.png", "24-containers-view.png", "25-updates-filter.png", "26-compact-density.png", "27-container-health-badges.png", "28-container-inspector.png", "29-images-view.png", "30-volumes-view.png", "31-networks-view.png", "32-image-current.png", "33-management-card-read-only.png", "34-management-disabled.png", "35-management-confirmation.png", "36-management-enabled.png", "37-running-actions.png", "38-action-confirmation.png", "39-stopped-start.png", "40-start-confirmation.png", "41-settings.png"]);
    expect(isSequential(embedded.map((file) => file.slice(0, 2)))).toBe(true);
    await Promise.all(embedded.map((filename) => access(`docs/images/user-guide/${filename}`)));

    // Every screenshot is captured, so no capture apparatus should remain.
    for (const retired of ["Screenshot placeholder", "Suggested filename:", "Appendix A", "### Screenshot "]) expect(guide).not.toContain(retired);

    // Each screenshot is centred and sized rather than dropped in at full width.
    const centred = [...guide.matchAll(/<div align="center">\n\n!\[[^\]]*\|(\d+)\]\(docs\/images\/user-guide\/\d{2}-[^)]+\)\n\n<\/div>/g)];
    expect(centred).toHaveLength(embedded.length);
    for (const [, width] of centred) expect(Number(width)).toBeLessThanOrEqual(880);
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
