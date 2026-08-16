import { createRequire } from "node:module";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { DockerConnectionFactory } from "../src/connections/DockerConnectionFactory";
import { desktopPluginArtifactPath } from "../src/platform/DesktopPluginArtifact";
import { desktopUi } from "../src/platform/DesktopUiAdapter";
import type { DockerTlsProfile, SshDockerProfile } from "../src/models/DockerConnectionProfile";

const nodeRequire = createRequire(import.meta.url);
const originalRequire = (globalThis as { require?: (id: string) => unknown }).require;
const originalPlatform = (globalThis as { Platform?: unknown }).Platform;
const artifact = resolve(process.cwd(), "desktop-transports.js");
const desktopUiArtifact = resolve(process.cwd(), "desktop-ui.js");
const base = { enabled: true, createdAt: "", updatedAt: "" };
const tls: DockerTlsProfile = { ...base, id: "tls", name: "TLS", connectionType: "docker-tls", host: "docker.example.test", port: 2376, serverName: "docker.example.test", caCertificatePath: "/tmp/ca", clientCertificatePath: "/tmp/cert", clientKeyPath: "/tmp/key", tlsSnapshot: { serverName: "docker.example.test", importedAt: "" } };
const ssh: SshDockerProfile = { ...base, id: "ssh", name: "SSH", connectionType: "ssh", sshHost: "docker.example.test", sshPort: 22, sshUsername: "docker", authentication: { type: "private-key", privateKeyPath: "/tmp/key" }, remoteSocketPath: "/var/run/docker.sock" };

afterEach(() => {
  (globalThis as { require?: (id: string) => unknown }).require = originalRequire;
  (globalThis as { Platform?: unknown }).Platform = originalPlatform;
});

describe("desktop transport production artifact loading", () => {
  it("loads the built sibling artifact by absolute path, independent of Electron's relative loader base", () => {
    expect(existsSync(artifact)).toBe(true);
    const requests: string[] = [];
    (globalThis as { require?: (id: string) => unknown }).require = (id) => { requests.push(id); if (id === "./desktop-transports") throw Object.assign(new Error("renderer-relative require"), { code: "MODULE_NOT_FOUND" }); return nodeRequire(id); };
    const factory = new DockerConnectionFactory(undefined, artifact);
    expect(factory.create(tls).profile.connectionType).toBe("docker-tls");
    expect(factory.create(ssh).profile.connectionType).toBe("ssh");
    expect(requests).toContain(artifact);
    expect(requests).not.toContain("./desktop-transports");
  });

  it("does not load a desktop artifact for a desktop profile on mobile", () => {
    const requests: string[] = [];
    (globalThis as { Platform?: unknown }).Platform = { isDesktop: false, isMobile: true };
    (globalThis as { require?: (id: string) => unknown }).require = (id) => { requests.push(id); return nodeRequire(id); };
    expect(new DockerConnectionFactory(undefined, artifact).create(ssh).profile.connectionType).toBe("ssh");
    expect(requests).toEqual([]);
  });

  it("loads the built desktop UI artifact by absolute plugin path, not the renderer base", () => {
    const requests: string[] = [];
    (globalThis as { require?: (id: string) => unknown }).require = (id) => { requests.push(id); if (id === "./desktop-ui") throw new Error("renderer-relative require"); return nodeRequire(id); };
    const plugin = { app: { vault: { adapter: { getFullPath: (path: string) => resolve(process.cwd(), path.endsWith("desktop-ui.js") ? "desktop-ui.js" : path) } } }, manifest: { dir: ".obsidian/plugins/docker-connector" } };
    expect(desktopUi(plugin)).toHaveProperty("discoverContexts");
    expect(requests).toContain(desktopUiArtifact);
    expect(requests).not.toContain("./desktop-ui");
  });

  it("does not load the desktop UI artifact on mobile", () => {
    const requests: string[] = [];
    (globalThis as { Platform?: unknown }).Platform = { isDesktop: false, isMobile: true };
    (globalThis as { require?: (id: string) => unknown }).require = (id) => { requests.push(id); return nodeRequire(id); };
    const plugin = { app: { vault: { adapter: { getFullPath: (path: string) => path } } }, manifest: { dir: ".obsidian/plugins/docker-connector" } };
    expect(() => desktopUi(plugin)).toThrow("DESKTOP_UI_UNAVAILABLE");
    expect(requests).toEqual([]);
  });

  it("reports a bounded error when a desktop release artifact is absent", () => {
    (globalThis as { require?: (id: string) => unknown }).require = nodeRequire;
    try { new DockerConnectionFactory(undefined, "/tmp/docker-connector-missing-desktop-transports.js").create(tls); throw new Error("expected desktop artifact failure"); }
    catch (error) { expect(error).toMatchObject({ code: "DESKTOP_TRANSPORT_ARTIFACT_UNAVAILABLE" }); }
  });

  it("uses Obsidian's adapter path conversion for POSIX and Windows plugin directories", () => {
    const posix = { getFullPath: (path: string) => `/vault/${path}` };
    const windows = { getFullPath: (path: string) => `C:\\vault\\${path.replaceAll("/", "\\")}` };
    expect(desktopPluginArtifactPath(posix as never, ".obsidian/plugins/docker-connector", "desktop-transports.js")).toBe("/vault/.obsidian/plugins/docker-connector/desktop-transports.js");
    expect(desktopPluginArtifactPath(windows as never, ".obsidian/plugins/docker-connector", "desktop-transports.js")).toBe("C:\\vault\\.obsidian\\plugins\\docker-connector\\desktop-transports.js");
  });

  it("keeps the built production artifacts present and exports the desktop factory", () => {
    expect(existsSync("main.js")).toBe(true);
    expect(existsSync("desktop-transports.js")).toBe(true);
    expect(existsSync("desktop-ui.js")).toBe(true);
    expect(existsSync("manifest.json")).toBe(true);
    expect(existsSync("styles.css")).toBe(true);
    const builtMain = readFileSync("main.js", "utf8");
    expect(builtMain).toContain("desktop-transports.js");
    expect(builtMain).toContain("desktop-ui.js");
    expect(builtMain).toContain("DESKTOP_TRANSPORT_ARTIFACT_UNAVAILABLE");
    expect(builtMain).not.toContain('load("./desktop-transports")');
    expect(builtMain).not.toContain('load("./desktop-ui")');
    expect(typeof (nodeRequire(artifact) as { createDesktopTransport?: unknown }).createDesktopTransport).toBe("function");
  });
});
