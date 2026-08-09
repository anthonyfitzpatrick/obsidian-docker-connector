import { describe, expect, it } from "vitest";
import { classifyCapability, parseDockerCapability } from "../src/connections/DockerCapabilityProbe";

const base = "__IDENTITY_USERNAME__\nobsidian\n__IDENTITY_UID__\n1000\n__IDENTITY_PRIMARY_GID__\n1000\n__IDENTITY_ALL_GIDS__\n1000 999\n__IDENTITY_GROUP_NAMES__\nobsidian docker\n__DOCKER_PATH__\n/usr/bin/docker\n__DOCKER_CONTEXT__\ndefault\n__DOCKER_HOST__\n\n__DOCKER_SOCKET_STAT__\n0 999 660 socket\n__DOCKER_SOCKET_GROUP__\ndocker:x:999:obsidian\n__DOCKER_VERSION__\n{}\n__DOCKER_VERSION_EXIT__\n0\n";

describe("Docker capability probe", () => {
  it("uses socket group GID rather than group name", () => {
    const capability = parseDockerCapability(base);
    expect(capability.socketGroupGid).toBe(999);
    expect(capability.identity.supplementaryGids).toContain(999);
    expect(() => classifyCapability({ ...capability, versionOutput: "permission denied", exitCode: 1 })).toThrow();
  });

  it("distinguishes a user missing the socket group", () => {
    const capability = parseDockerCapability(base.replace("1000 999", "1000").replace("docker:x:999:obsidian", "docker:x:999:"));
    try { classifyCapability({ ...capability, versionOutput: "Got permission denied while trying to connect", exitCode: 1 }); }
    catch (error) { expect(error).toMatchObject({ code: "DOCKER_USER_NOT_IN_SOCKET_GROUP" }); }
  });

  it("detects rootless context and standard daemon failures", () => {
    expect(parseDockerCapability(base.replace("__DOCKER_HOST__\n\n", "__DOCKER_HOST__\nunix:///run/user/1000/docker.sock\n")).rootless).toBe(true);
    try { classifyCapability({ ...parseDockerCapability(base), versionOutput: "Cannot connect to the Docker daemon", exitCode: 1 }); }
    catch (error) { expect(error).toMatchObject({ code: "DOCKER_DAEMON_UNAVAILABLE" }); }
  });
});
