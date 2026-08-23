import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import esbuild from "esbuild";
import { afterEach, describe, expect, it } from "vitest";
import { DockerConnectionFactory } from "../src/connections/DockerConnectionFactory";
import { desktopUi } from "../src/platform/DesktopUiAdapter";
import type { DockerConnectionProfile, DockerTlsProfile, SshDockerProfile } from "../src/models/DockerConnectionProfile";

const base = { enabled: true, createdAt: "", updatedAt: "" };
const local: DockerConnectionProfile = { ...base, id: "local", name: "Local", connectionType: "local", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" } };
const context: DockerConnectionProfile = { ...base, id: "context", name: "Context", connectionType: "docker-context", contextName: "test", dockerCliPath: "docker", contextEndpoint: "unix:///var/run/docker.sock", contextTlsVerify: false };
const tls: DockerTlsProfile = { ...base, id: "tls", name: "TLS", connectionType: "docker-tls", host: "docker.example.test", port: 2376, serverName: "docker.example.test", caCertificatePath: "/tmp/ca", clientCertificatePath: "/tmp/cert", clientKeyPath: "/tmp/key", tlsSnapshot: { serverName: "docker.example.test", importedAt: "" } };
const ssh: SshDockerProfile = { ...base, id: "ssh", name: "SSH", connectionType: "ssh", sshHost: "docker.example.test", sshPort: 22, sshUsername: "docker", authentication: { type: "private-key", privateKeyPath: "/tmp/key" }, remoteSocketPath: "/var/run/docker.sock" };
const originalPlatform = (globalThis as { Platform?: unknown }).Platform;
const nodeRequire = createRequire(import.meta.url);

async function bundledModule(source: string): Promise<{ path: string; dispose: () => Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), "docker-connector-bundle-"));
  const path = join(directory, "module.cjs");
  await esbuild.build({ stdin: { contents: source, resolveDir: process.cwd(), loader: "ts" }, outfile: path, bundle: true, platform: "node", format: "cjs", target: "es2022", external: ["obsidian", "electron", "cpu-features"] });
  return { path, dispose: () => rm(directory, { recursive: true, force: true }) };
}

afterEach(() => {
  (globalThis as { Platform?: unknown }).Platform = originalPlatform;
});

describe("single-bundle Community Plugin architecture", () => {
  it("uses the compiled production desktop factory for every desktop transport without injected loaders", async () => {
    (globalThis as { Platform?: unknown }).Platform = { isDesktop: true, isMobile: false };
    const bundle = await bundledModule('export { DockerConnectionFactory } from "./src/connections/DockerConnectionFactory";');
    try {
      const { DockerConnectionFactory: CompiledFactory } = nodeRequire(bundle.path) as { DockerConnectionFactory: typeof DockerConnectionFactory };
      const factory = new CompiledFactory();
      expect(factory.create(local).constructor.name).toBe("LocalDockerTransport");
      expect(factory.create(context).constructor.name).toBe("DockerContextDialStdioTransport");
      expect(factory.create(ssh).constructor.name).toBe("SshDockerTransport");
      expect(factory.create(tls).constructor.name).toBe("DockerMutualTlsTransport");
    } finally {
      await bundle.dispose();
    }
  });

  it("loads production desktop UI services from the compiled bundled module boundary", async () => {
    (globalThis as { Platform?: unknown }).Platform = { isDesktop: true, isMobile: false };
    const bundle = await bundledModule('export { desktopUi } from "./src/platform/DesktopUiAdapter";');
    try {
      const { desktopUi: compiledDesktopUi } = nodeRequire(bundle.path) as { desktopUi: typeof desktopUi };
      expect(compiledDesktopUi({})).toMatchObject({
        discoverLocalDockerEndpoints: expect.any(Function),
        discoverContexts: expect.any(Function),
        validateDockerTlsFiles: expect.any(Function)
      });
    } finally {
      await bundle.dispose();
    }
  });

  it("does not invoke desktop transport or UI loaders on mobile", () => {
    (globalThis as { Platform?: unknown }).Platform = { isDesktop: false, isMobile: true };
    const factory = new DockerConnectionFactory(() => { throw new Error("desktop loader invoked"); });
    expect(factory.create(ssh).profile.connectionType).toBe("ssh");
    expect(() => desktopUi({})).toThrow("DESKTOP_UI_UNAVAILABLE");
  });
});
