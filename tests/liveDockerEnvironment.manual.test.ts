/**
 * Drives the real transports against a real Docker environment. Read-only:
 * it inspects hosts and never starts, stops, creates or deletes anything.
 *
 * Opt in, because it needs that environment:
 *   DOCKER_CONNECTOR_LIVE=1 DOCKER_CONNECTOR_VAULT="<path to data.json>" \
 *     npx vitest run tests/liveDockerEnvironment.manual.test.ts
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DockerConnectionFactory } from "../src/connections/DockerConnectionFactory";
import { DockerInspectionService } from "../src/services/DockerInspectionService";
import { discoverLocalDockerEndpoints } from "../src/connections/LocalEndpointDiscovery";
import { DockerContextDiscoveryService } from "../src/connections/DockerContextDiscovery";
import { validateDockerTlsFiles } from "../src/security/TlsProfileValidation";
import type { DockerConnectionProfile, DockerTlsProfile } from "../src/models/DockerConnectionProfile";

const live = process.env.DOCKER_CONNECTOR_LIVE === "1";
const dataPath = process.env.DOCKER_CONNECTOR_VAULT ?? "";

async function profiles(): Promise<DockerConnectionProfile[]> {
  const parsed = JSON.parse(await readFile(dataPath, "utf8")) as { profiles?: DockerConnectionProfile[] };
  return parsed.profiles ?? [];
}

const byType = (all: DockerConnectionProfile[], type: string) => all.find((profile) => profile.connectionType === type);

/** Reports a snapshot without leaking any credential material. */
function summarise(label: string, snapshot: { status: string; error?: string; containers: unknown[]; images: unknown[]; volumes: unknown[]; networks: unknown[]; system?: { dockerVersion: string } }): void {
  const counts = `containers=${snapshot.containers.length} images=${snapshot.images.length} volumes=${snapshot.volumes.length} networks=${snapshot.networks.length}`;
  console.log(`  ${label}: ${snapshot.status}${snapshot.system ? ` docker=${snapshot.system.dockerVersion}` : ""} ${counts}${snapshot.error ? ` error="${snapshot.error}"` : ""}`);
}

describe.skipIf(!live)("live Docker environment (read-only)", () => {
  it("discovers a local Docker endpoint", async () => {
    const endpoints = await discoverLocalDockerEndpoints();
    console.log(`  local endpoints: ${endpoints.length}`);
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it("connects over the local Docker socket", async () => {
    const profile = byType(await profiles(), "local");
    expect(profile).toBeDefined();
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(profile!);
    summarise("local", snapshot);
    expect(snapshot.status).toBe("online");
    expect(snapshot.system?.dockerVersion).toBeTruthy();
  });

  it("discovers Docker Contexts without changing the active one", async () => {
    const before = (await new DockerContextDiscoveryService().discover(await new DockerContextDiscoveryService().resolveCli())).map((context) => context.name);
    console.log(`  contexts: ${before.join(", ")}`);
    expect(before.length).toBeGreaterThan(0);
  });

  it("connects through a saved Docker Context", async () => {
    const profile = byType(await profiles(), "docker-context");
    expect(profile).toBeDefined();
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(profile!);
    summarise("docker-context", snapshot);
    expect(snapshot.status).toBe("online");
  });

  it("connects over SSH with a private key", async () => {
    const all = await profiles();
    const profile = all.find((item) => item.connectionType === "ssh" && item.authentication.type === "private-key");
    expect(profile).toBeDefined();
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(profile!);
    summarise("ssh private key", snapshot);
    expect(snapshot.status).toBe("online");
  }, 60_000);

  it("reports a rejected SSH password as authentication-required, with a reason", async () => {
    const all = await profiles();
    const profile = all.find((item) => item.connectionType === "ssh" && item.authentication.type === "password");
    expect(profile).toBeDefined();
    const factory = new DockerConnectionFactory();
    factory.setRuntimePassword(profile!.id, "deliberately-not-the-password");
    const snapshot = await new DockerInspectionService(factory).inspectHost(profile!);
    summarise("ssh wrong password", snapshot);
    expect(snapshot.status).toBe("authentication-required");
    expect(snapshot.error).toBeTruthy();
  }, 60_000);

  it("leaves the active Docker Context unchanged", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const active = async () => (await run("docker", ["context", "show"])).stdout.trim();
    const before = await active();
    const profile = byType(await profiles(), "docker-context");
    await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(profile!);
    const after = await active();
    console.log(`  active context before=${before} after=${after}`);
    expect(after).toBe(before);
  }, 30_000);

  it("blocks a changed SSH host key", async () => {
    const all = await profiles();
    const real = all.find((item) => item.connectionType === "ssh" && item.authentication.type === "private-key");
    // In memory only: the saved profile is never modified.
    const tampered = { ...real!, id: `${real!.id}-tampered`, hostKeyFingerprint: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } as DockerConnectionProfile;
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(tampered);
    summarise("ssh changed host key", snapshot);
    expect(snapshot.status).not.toBe("online");
    expect(snapshot.error).toBeTruthy();
  }, 60_000);

  it("reports a private key the server refuses as authentication-required", async () => {
    const keyPath = process.env.DOCKER_CONNECTOR_UNAUTHORISED_KEY;
    expect(keyPath, "set DOCKER_CONNECTOR_UNAUTHORISED_KEY to a throwaway key").toBeTruthy();
    const all = await profiles();
    const real = all.find((item) => item.connectionType === "ssh" && item.authentication.type === "private-key");
    const refused = { ...real!, id: `${real!.id}-refused`, authentication: { type: "private-key" as const, privateKeyPath: keyPath! } } as DockerConnectionProfile;
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(refused);
    summarise("ssh unauthorised key", snapshot);
    // 1.1.13 moved this from degraded so the card offers Reconnect and a reason.
    expect(snapshot.status).toBe("authentication-required");
    expect(snapshot.error).toBeTruthy();
  }, 60_000);

  it("handles an encrypted private key: required, rejected, then accepted", async () => {
    const keyPath = process.env.DOCKER_CONNECTOR_ENCRYPTED_KEY;
    const passphrase = process.env.DOCKER_CONNECTOR_ENCRYPTED_KEY_PASSPHRASE;
    expect(keyPath && passphrase, "set DOCKER_CONNECTOR_ENCRYPTED_KEY and _PASSPHRASE").toBeTruthy();
    const all = await profiles();
    const real = all.find((item) => item.connectionType === "ssh" && item.authentication.type === "private-key");
    const encrypted = { ...real!, id: `${real!.id}-encrypted`, authentication: { type: "private-key" as const, privateKeyPath: keyPath! } } as DockerConnectionProfile;

    const noPassphrase = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(encrypted);
    summarise("encrypted key, no passphrase", noPassphrase);

    const wrongFactory = new DockerConnectionFactory();
    wrongFactory.setRuntimePrivateKeyPassphrase(encrypted.id, "not-the-passphrase");
    const wrong = await new DockerInspectionService(wrongFactory).inspectHost(encrypted);
    summarise("encrypted key, wrong passphrase", wrong);

    const rightFactory = new DockerConnectionFactory();
    rightFactory.setRuntimePrivateKeyPassphrase(encrypted.id, passphrase!);
    const right = await new DockerInspectionService(rightFactory).inspectHost(encrypted);
    // The key is a throwaway the server does not authorise, so success here is
    // the server refusing the key: that only happens once it has decrypted.
    summarise("encrypted key, correct passphrase", right);
    expect(noPassphrase.error).toMatch(/requires a passphrase/i);
    expect(wrong.error).toMatch(/passphrase was rejected/i);
    // Decryption succeeded: the failure moved from the passphrase to the server.
    expect(right.error).toMatch(/rejected the selected private key/i);
  }, 90_000);

  it("blocks a host whose key has never been trusted", async () => {
    const all = await profiles();
    const real = all.find((item) => item.connectionType === "ssh" && item.authentication.type === "private-key");
    const untrusted = { ...real!, id: `${real!.id}-untrusted`, hostKeyFingerprint: undefined } as DockerConnectionProfile;
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(untrusted);
    summarise("ssh first contact", snapshot);
    expect(snapshot.status).not.toBe("online");
    expect(snapshot.error).toMatch(/trusted before connecting/i);
  }, 60_000);

  it("rejects mismatched TLS client certificate and key", async () => {
    const rogueKey = process.env.DOCKER_CONNECTOR_ROGUE_KEY;
    const profile = byType(await profiles(), "docker-tls") as DockerTlsProfile;
    await expect(validateDockerTlsFiles({ ...profile, clientKeyPath: rogueKey! })).rejects.toThrow();
    console.log("  mismatched cert/key: rejected by validation");
  }, 30_000);

  it("refuses a server that the configured CA does not vouch for", async () => {
    const rogueCa = process.env.DOCKER_CONNECTOR_ROGUE_CA;
    const profile = byType(await profiles(), "docker-tls") as DockerTlsProfile;
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost({ ...profile, id: `${profile.id}-rogue-ca`, caCertificatePath: rogueCa! });
    summarise("tls rogue CA", snapshot);
    expect(snapshot.status).not.toBe("online");
    expect(snapshot.error).toMatch(/CA certificate/i);
  }, 60_000);

  it("refuses a server name the certificate does not cover", async () => {
    const profile = byType(await profiles(), "docker-tls") as DockerTlsProfile;
    for (const [label, serverName] of [["dns", "not-this-host.example.test"], ["ip", "127.0.0.1"]] as const) {
      const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost({ ...profile, id: `${profile.id}-${label}`, serverName });
      summarise(`tls wrong server name (${label})`, snapshot);
      expect(snapshot.status).not.toBe("online");
      // Both spellings must be refused. An IP is never sent as SNI, so before
      // the explicit checkServerIdentity the IP case verified against host
      // and connected, silently ignoring the configured Server name.
      expect(snapshot.error).toMatch(/Server Name/i);
    }
  }, 90_000);

  it("refuses a client certificate the server does not accept", async () => {
    const rogueCert = process.env.DOCKER_CONNECTOR_ROGUE_CERT;
    const rogueKey = process.env.DOCKER_CONNECTOR_ROGUE_KEY;
    const profile = byType(await profiles(), "docker-tls") as DockerTlsProfile;
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost({ ...profile, id: `${profile.id}-rogue-client`, clientCertificatePath: rogueCert!, clientKeyPath: rogueKey! });
    summarise("tls rogue client cert", snapshot);
    expect(snapshot.status).not.toBe("online");
  }, 60_000);

  it("validates the mutual TLS material and connects", async () => {
    const profile = byType(await profiles(), "docker-tls") as DockerTlsProfile | undefined;
    expect(profile).toBeDefined();
    const validation = await validateDockerTlsFiles(profile!);
    console.log(`  tls client cert valid to ${validation.clientCertificateValidTo}`);
    const snapshot = await new DockerInspectionService(new DockerConnectionFactory()).inspectHost(profile!);
    summarise("mutual TLS", snapshot);
    expect(snapshot.status).toBe("online");
  }, 60_000);
});
