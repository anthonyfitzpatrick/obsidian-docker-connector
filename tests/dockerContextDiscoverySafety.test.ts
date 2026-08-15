import { describe, expect, it } from "vitest";
import { classifyDockerContextEndpoint, parseDockerContextList } from "../src/connections/DockerContextDiscovery";

describe("Docker Context discovery input safety", () => {
  it("classifies a malformed SSH endpoint as unsupported instead of leaking a URL parser exception", () => {
    expect(classifyDockerContextEndpoint("ssh://[")).toMatchObject({ type: "unknown", rawHost: "ssh://[" });
  });

  it("rejects duplicate Context names rather than selecting an ambiguous endpoint", () => {
    const row = JSON.stringify({ Name: "duplicate", DockerEndpoint: "unix:///var/run/docker.sock" });
    expect(() => parseDockerContextList(`${row}\n${row}`)).toThrow(/duplicate Context names/);
  });

  it("keeps malformed discovery records inside the safe typed parsing boundary", () => {
    expect(() => parseDockerContextList("not JSON")).toThrow(/invalid context data/i);
  });
});
