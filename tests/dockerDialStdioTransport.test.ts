import { describe, expect, it } from "vitest";
import { mapDialFailure, tryParseHttpResponse } from "../src/connections/DockerDialStdioTransport";
import { dockerPermissionRemediation } from "../src/security/DockerPermissionRemediation";

describe("Docker dial-stdio transport", () => {
  it("classifies safe startup failures", () => {
    expect(mapDialFailure("docker: command not found").code).toBe("DOCKER_CLI_NOT_FOUND");
    expect(mapDialFailure("permission denied while trying to connect").code).toBe("DOCKER_SOCKET_PERMISSION_DENIED");
    expect(mapDialFailure("Cannot connect to the Docker daemon").code).toBe("DOCKER_DAEMON_UNAVAILABLE");
    expect(mapDialFailure("unknown command: dial-stdio").code).toBe("DOCKER_DIAL_STDIO_UNSUPPORTED");
  });

  it("waits for complete partial HTTP responses and preserves a subsequent response", () => {
    expect(tryParseHttpResponse("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{")).toBeUndefined();
    const raw = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK";
    const first = tryParseHttpResponse(raw);
    expect(first?.response.body).toBe("{}");
    expect(tryParseHttpResponse(raw.slice(first?.consumed))?.response.body).toBe("OK");
  });

  it("accepts Docker lifecycle 204 No Content without Content-Length", () => {
    expect(tryParseHttpResponse("HTTP/1.1 204 No Content\r\nConnection: keep-alive\r\n\r\n")).toMatchObject({ response: { status: 204, body: "" } });
  });

  it("provides remediation without privileged plugin commands", () => {
    const text = dockerPermissionRemediation({ id: "wolf", name: "Wolf", sshHost: "46.62.226.180", sshPort: 22, sshUsername: "obsidian", remoteSocketPath: "/var/run/docker.sock", enabled: true, createdAt: "" , updatedAt: "" }, "docker");
    expect(text).toContain("sudo usermod -aG docker obsidian");
    expect(text).toContain("docker ps");
    expect(text).not.toContain("sudo docker system dial-stdio");
  });
});
