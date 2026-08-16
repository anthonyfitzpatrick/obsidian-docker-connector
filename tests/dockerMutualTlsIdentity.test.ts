import { checkServerIdentity, type PeerCertificate } from "node:tls";
import { describe, expect, it } from "vitest";
import { DockerConnectionError } from "../src/connections/DockerTransport";
import { DockerMutualTlsTransport, dockerRequestTimeout, tlsDiagnosticFailureStep, tlsServername } from "../src/connections/DockerMutualTlsTransport";
import type { DockerTlsProfile } from "../src/models/DockerConnectionProfile";

const certificate = (subjectaltname: string): PeerCertificate => ({ subjectaltname } as PeerCertificate);
const passes = (identity: string, subjectaltname: string): boolean => checkServerIdentity(identity, certificate(subjectaltname)) === undefined;
const profile: DockerTlsProfile = { id: "tls", name: "TLS", connectionType: "docker-tls", host: "192.168.1.2", port: 2376, serverName: "192.168.1.2", caCertificatePath: "ca", clientCertificatePath: "cert", clientKeyPath: "key", tlsSnapshot: { serverName: "192.168.1.2", importedAt: "" }, enabled: true, createdAt: "", updatedAt: "" };

describe("mutual-TLS server identity", () => {
  it("uses Node's IP SAN verification and never sends an IP address as SNI", () => {
    expect(passes("192.168.1.2", "IP Address:192.168.1.2")).toBe(true);
    expect(passes("192.168.1.3", "IP Address:192.168.1.2")).toBe(false);
    expect(passes("zima", "IP Address:192.168.1.2")).toBe(false);
    expect(tlsServername("192.168.1.2")).toBeUndefined();
  });

  it("keeps DNS SNI and DNS SAN verification for normal hostname deployments", () => {
    expect(passes("docker.example.test", "DNS:docker.example.test")).toBe(true);
    expect(passes("wrong.example.test", "DNS:docker.example.test")).toBe(false);
    expect(tlsServername("docker.example.test")).toBe("docker.example.test");
  });

  it("accepts either matching identity from a mixed SAN certificate", () => {
    const mixed = "DNS:docker.example.test, IP Address:192.168.1.2";
    expect(passes("docker.example.test", mixed)).toBe(true);
    expect(passes("192.168.1.2", mixed)).toBe(true);
    expect(passes("unrelated.example.test", mixed)).toBe(false);
  });

  it("places hostname failures at server-name verification before Docker requests", () => {
    expect(tlsDiagnosticFailureStep("DOCKER_TLS_HOSTNAME_MISMATCH")).toBe(6);
    expect(tlsDiagnosticFailureStep("DOCKER_TLS_CA_UNTRUSTED")).toBe(5);
    expect(tlsDiagnosticFailureStep("DOCKER_PING_FAILED")).toBe(8);
  });

  it("waits beyond Docker's requested graceful-stop window before timing out mTLS", () => {
    const id = "a".repeat(64);
    expect(dockerRequestTimeout(`/containers/${id}/stop?t=30`)).toBe(40_000);
    expect(dockerRequestTimeout(`/containers/${id}/stop?t=60`)).toBe(70_000);
    expect(dockerRequestTimeout(`/containers/${id}/start`)).toBe(20_000);
  });

  it("marks only completed diagnostic stages successful", async () => {
    const successful = new DockerMutualTlsTransport(profile) as unknown as { connect(): Promise<void>; disconnect(): Promise<void>; raw(path: string): Promise<string>; testConnection(): ReturnType<DockerMutualTlsTransport["testConnection"]> };
    successful.connect = async () => undefined;
    successful.disconnect = async () => undefined;
    successful.raw = async (path) => path === "/_ping" ? "OK" : JSON.stringify({ Version: "26.1.5", ApiVersion: "1.45" });
    const succeeded = await successful.testConnection();
    expect(succeeded.success).toBe(true);
    expect(succeeded.steps.find((step) => step.id === "tls-9")?.status).toBe("success");

    const mismatch = new DockerMutualTlsTransport(profile) as unknown as { connect(): Promise<void>; disconnect(): Promise<void>; raw(path: string): Promise<string>; testConnection(): ReturnType<DockerMutualTlsTransport["testConnection"]> };
    mismatch.connect = async () => undefined;
    mismatch.disconnect = async () => undefined;
    mismatch.raw = async () => { throw new DockerConnectionError("DOCKER_TLS_HOSTNAME_MISMATCH", "Server identity verification failed."); };
    const failed = await mismatch.testConnection();
    expect(failed).toMatchObject({ success: false, safeErrorCode: "DOCKER_TLS_HOSTNAME_MISMATCH" });
    expect(failed.steps.map((step) => step.status)).toEqual(["success", "success", "success", "success", "success", "success", "error", "skipped", "skipped", "skipped", "skipped", "skipped"]);
  });
});
