import { describe, expect, it } from "vitest";
import { DockerConnectionFactory } from "../src/connections/DockerConnectionFactory";
import { DockerContextDialStdioTransport, contextDialStdioArgs } from "../src/connections/DockerContextDialStdioTransport";
import { LocalDockerTransport } from "../src/connections/LocalDockerTransport";
import { SshDockerTransport } from "../src/connections/SshDockerTransport";
import { createDesktopTransport } from "../src/connections/DesktopTransportFactory";
import type { DockerContextProfile, LocalDockerProfile, SshDockerProfile } from "../src/models/DockerConnectionProfile";

const base = { id: "id", name: "Name", enabled: true, createdAt: "", updatedAt: "" };
const context: DockerContextProfile = { ...base, connectionType: "docker-context", contextName: "saved-context", contextSnapshot: { isCurrentWhenSaved: false, endpointType: "ssh", endpointDisplay: "host.example", supported: true, importedAt: "", lastDiscoveredAt: "" } };
const local: LocalDockerProfile = { ...base, connectionType: "local", localEndpoint: { type: "unix-socket", socketPath: "/var/run/docker.sock" } };
const ssh: SshDockerProfile = { ...base, connectionType: "ssh", sshHost: "host.example", sshPort: 22, sshUsername: "user", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock" };

describe("Docker Context dial-stdio transport", () => {
  it("uses an explicit saved Context as fixed Docker CLI arguments", () => {
    expect(contextDialStdioArgs("saved-context")).toEqual(["--context", "saved-context", "system", "dial-stdio"]);
    expect(() => contextDialStdioArgs("bad\ncontext")).toThrow("invalid");
  });
  it("routes Context, Local, and SSH profiles to their dedicated transports", () => {
    const factory = new DockerConnectionFactory(() => ({ createDesktopTransport }));
    expect(factory.create(context)).toBeInstanceOf(DockerContextDialStdioTransport);
    expect(factory.create(local)).toBeInstanceOf(LocalDockerTransport);
    expect(factory.create(ssh)).toBeInstanceOf(SshDockerTransport);
  });
});
