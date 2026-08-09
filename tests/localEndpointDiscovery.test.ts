import { describe, expect, it } from "vitest";
import { defaultLocalEndpoint, normalizeLocalEndpoint } from "../src/connections/LocalEndpointDiscovery";

describe("Local Docker endpoint defaults", () => {
  it("uses the platform-appropriate defaults", () => { expect(defaultLocalEndpoint("darwin")).toEqual({ type: "unix-socket", socketPath: "/var/run/docker.sock" }); expect(defaultLocalEndpoint("linux")).toEqual({ type: "unix-socket", socketPath: "/var/run/docker.sock" }); expect(defaultLocalEndpoint("win32")).toEqual({ type: "windows-named-pipe", pipePath: "//./pipe/docker_engine" }); });
  it("normalizes Unix sockets and named pipes without accepting unrelated paths", () => { expect(normalizeLocalEndpoint({ type: "unix-socket", socketPath: "~/.docker/run/docker.sock" }, "/Users/test")).toEqual({ type: "unix-socket", socketPath: "/Users/test/.docker/run/docker.sock" }); expect(normalizeLocalEndpoint({ type: "windows-named-pipe", pipePath: "\\\\.\\pipe\\docker_engine" })).toEqual({ type: "windows-named-pipe", pipePath: "//./pipe/docker_engine" }); expect(() => normalizeLocalEndpoint({ type: "windows-named-pipe", pipePath: "C:/docker.sock" })).toThrow(); });
});
