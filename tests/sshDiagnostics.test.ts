import { describe, expect, it } from "vitest";
import { mapTcpError, normalizeSshTarget } from "../src/connections/SshDockerTransport";
import { tryParseHttpResponse } from "../src/connections/DockerDialStdioTransport";
import type { SshDockerProfile } from "../src/models/DockerConnectionProfile";
const profile: SshDockerProfile = { connectionType: "ssh", id: "ssh", name: "SSH", enabled: true, createdAt: "", updatedAt: "", sshHost: "46.62.226.180", sshPort: 22, sshUsername: "obsidian", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock" };
describe("password SSH transport diagnostics", () => {
  it("normalizes host and numeric port", () => expect(normalizeSshTarget({ ...profile, sshHost: " 46.62.226.180\n" })).toEqual({ host: "46.62.226.180", port: 22, requiresDns: false }));
  it("classifies TCP errors and Docker response framing", () => { expect(mapTcpError(Object.assign(new Error(), { code: "ECONNREFUSED" })).code).toBe("SSH_CONNECTION_REFUSED"); expect(tryParseHttpResponse("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}" )?.response).toEqual({ status: 200, body: "{}" }); expect(tryParseHttpResponse("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n")?.response.body).toBe("{}"); });
});
