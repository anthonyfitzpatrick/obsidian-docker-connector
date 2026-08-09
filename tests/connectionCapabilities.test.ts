import { describe, expect, it } from "vitest";
import { connectionCapabilities } from "../src/connections/DockerConnectionCapabilities";
import { RuntimeCredentialStore } from "../src/security/RuntimeCredentialStore";
import type { DockerConnectionProfile } from "../src/models/DockerConnectionProfile";

const base = { id: "id", name: "Name", enabled: true, createdAt: "", updatedAt: "" };
const profiles: DockerConnectionProfile[] = [
  { ...base, connectionType: "local", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" } },
  { ...base, connectionType: "docker-context", contextName: "saved", contextSnapshot: { isCurrentWhenSaved: false, endpointType: "ssh", supported: true, importedAt: "", lastDiscoveredAt: "" } },
  { ...base, connectionType: "ssh", sshHost: "host", sshPort: 22, sshUsername: "user", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock" },
  { ...base, connectionType: "docker-tls", host: "host", port: 2376, serverName: "host", caCertificatePath: "/tmp/ca", clientCertificatePath: "/tmp/cert", clientKeyPath: "/tmp/key", tlsSnapshot: { serverName: "host", importedAt: "" } }
];
describe("four-method connection capability matrix", () => {
  it("assigns only the intended verification and credential capabilities", () => {
    const [local, context, ssh, tls] = profiles.map(connectionCapabilities);
    expect(local).toMatchObject({ requiresRuntimeCredential: false, supportsHostKeyVerification: false, supportsCertificateVerification: false, supportsDashboard: true });
    expect(context).toMatchObject({ connectionType: "docker-context", supportsAutomaticRefresh: true });
    expect(ssh).toMatchObject({ requiresRuntimeCredential: true, supportsHostKeyVerification: true });
    expect(tls).toMatchObject({ supportsCertificateVerification: true, supportsLazyDetails: true, supportsReports: true });
  });
  it("keeps runtime credential slots isolated by profile and method", () => { const store = new RuntimeCredentialStore(); store.setPassword("ssh-password", "p"); store.setPrivateKeyPassphrase("ssh-key", "k"); store.setTlsClientKeyPassphrase("tls", "t"); store.clearProfile("ssh-password"); expect(store.getPassword("ssh-password")).toBeUndefined(); expect(store.getPrivateKeyPassphrase("ssh-key")).toBe("k"); expect(store.getTlsClientKeyPassphrase("tls")).toBe("t"); });
});
