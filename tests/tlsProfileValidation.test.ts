import { describe, expect, it } from "vitest";
import { createDockerTlsProfile, validateDockerTlsHost, validateDockerTlsPort, validateDockerTlsServerName } from "../src/security/TlsProfileValidation";
import { RuntimeCredentialStore } from "../src/security/RuntimeCredentialStore";
import { DockerConnectionFactory } from "../src/connections/DockerConnectionFactory";
import { DockerMutualTlsTransport } from "../src/connections/DockerMutualTlsTransport";

const validation = { caCertificateFingerprint: "ca", clientCertificateFingerprint: "client", clientCertificateSubject: "CN=client", clientCertificateIssuer: "CN=ca", clientCertificateValidFrom: "2026-01-01T00:00:00.000Z", clientCertificateValidTo: "2027-01-01T00:00:00.000Z" };
describe("Docker mutual-TLS profiles", () => {
  it("validates DNS, IPv4, IPv6, ports, and server names without accepting URL syntax", () => {
    expect(validateDockerTlsHost("docker.example.com")).toBe("docker.example.com"); expect(validateDockerTlsHost("192.0.2.10")).toBe("192.0.2.10"); expect(validateDockerTlsHost("2001:db8::10")).toBe("2001:db8::10");
    ["https://docker.example.com", "tcp://docker.example.com:2376", "user:pass@host", "/docker.sock"].forEach((value) => expect(() => validateDockerTlsHost(value)).toThrow());
    expect(validateDockerTlsPort(2376)).toBe(2376); expect(() => validateDockerTlsPort(0)).toThrow(); expect(() => validateDockerTlsServerName("https://host")).toThrow();
  });
  it("maps only safe TLS profile fields and preserves no certificate contents or passphrase", () => {
    const profile = createDockerTlsProfile({ id: "tls", name: "TLS", host: "docker.example.com", port: 2376, serverName: "docker.example.com", caCertificatePath: "/tmp/ca.pem", clientCertificatePath: "/tmp/client.pem", clientKeyPath: "/tmp/key.pem", validation, now: "2026-08-05T00:00:00.000Z" });
    expect(profile.connectionType).toBe("docker-tls"); const serialized = JSON.stringify(profile); ["BEGIN CERTIFICATE", "PRIVATE KEY", "passphrase", "password"].forEach((secret) => expect(serialized).not.toContain(secret));
  });
  it("keeps TLS client-key passphrases separate and runtime-only", () => { const store = new RuntimeCredentialStore(); store.setTlsClientKeyPassphrase("tls", "secret"); expect(store.getTlsClientKeyPassphrase("tls")).toBe("secret"); expect(JSON.stringify(store)).not.toContain("secret"); store.clearProfile("tls"); expect(store.getTlsClientKeyPassphrase("tls")).toBeUndefined(); });
  it("routes TLS profiles to the dedicated verified HTTPS transport", () => { const profile = createDockerTlsProfile({ id: "tls", name: "TLS", host: "docker.example.com", port: 2376, serverName: "docker.example.com", caCertificatePath: "/tmp/ca.pem", clientCertificatePath: "/tmp/client.pem", clientKeyPath: "/tmp/key.pem", validation, now: "2026-08-05T00:00:00.000Z" }); expect(new DockerConnectionFactory().create(profile)).toBeInstanceOf(DockerMutualTlsTransport); });
});
