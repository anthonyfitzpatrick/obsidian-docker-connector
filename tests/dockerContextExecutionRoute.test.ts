import { describe, expect, it } from "vitest";
import { classifyDockerContextEndpoint } from "../src/connections/DockerContextDiscovery";
import { resolveDockerContextExecutionRoute } from "../src/connections/DockerContextExecutionRoute";

describe("Docker Context execution routing", () => {
  it("routes local Unix socket Contexts to the local transport without dial-stdio", () => {
    expect(resolveDockerContextExecutionRoute(classifyDockerContextEndpoint("unix:///example/docker.sock"))).toEqual({ kind: "local", endpoint: { type: "unix-socket", socketPath: "/example/docker.sock" } });
  });
  it("routes Windows named-pipe Contexts to the local transport without dial-stdio", () => {
    expect(resolveDockerContextExecutionRoute(classifyDockerContextEndpoint("npipe:////./pipe/docker_engine"))).toEqual({ kind: "local", endpoint: { type: "windows-named-pipe", pipePath: "//./pipe/docker_engine" } });
  });
  it("retains dial-stdio only for SSH Contexts", () => {
    expect(resolveDockerContextExecutionRoute(classifyDockerContextEndpoint("ssh://docker@example.test"))).toEqual({ kind: "context-dial-stdio" });
  });
  it("blocks insecure and unknown Context endpoints without a fallback transport", () => {
    expect(resolveDockerContextExecutionRoute(classifyDockerContextEndpoint("tcp://example.test:2375"))).toMatchObject({ kind: "unsupported", reasonCode: "DOCKER_CONTEXT_INSECURE_TCP" });
    expect(resolveDockerContextExecutionRoute(classifyDockerContextEndpoint("http://example.test"))).toMatchObject({ kind: "unsupported", reasonCode: "DOCKER_CONTEXT_UNSUPPORTED" });
    expect(resolveDockerContextExecutionRoute({ rawHost: "tcp://secure.example.test:2376", displayHost: "secure.example.test:2376", type: "tcp-tls", skipTlsVerify: false, hasTlsMaterial: true })).toMatchObject({ kind: "unsupported", reasonCode: "DOCKER_CONTEXT_UNSUPPORTED" });
  });
});
