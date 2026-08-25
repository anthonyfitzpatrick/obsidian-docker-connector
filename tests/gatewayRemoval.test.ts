import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("retired Gateway removal", () => {
  it("keeps the connection model, selector, and factory limited to four desktop methods", () => {
    const model = read("src/models/DockerConnectionProfile.ts");
    const modal = read("src/views/DockerDashboardView.ts");
    const factory = read("src/connections/DockerConnectionFactory.ts");
    const credentials = read("src/security/RuntimeCredentialStore.ts");
    expect(model).toContain('connectionType: "local" | "ssh" | "docker-context" | "docker-tls"');
    expect(model).not.toContain("GatewayDockerProfile");
    expect(modal).not.toContain("Gateway HTTPS URL");
    expect(modal).not.toContain("Gateway Access Token");
    expect(factory).not.toContain("GatewayDockerTransport");
    expect(credentials).not.toContain("gatewayTokens");
  });

  it("removes the standalone companion service entrypoint", () => {
    expect(existsSync(new URL("gateway/index.mjs", root))).toBe(false);
    expect(existsSync(new URL("gateway/server.mjs", root))).toBe(false);
    expect(existsSync(new URL("src/connections/GatewayDockerTransport.ts", root))).toBe(false);
  });
});
