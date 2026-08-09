import { describe, expect, it } from "vitest";
import { DockerCliResolver, dockerCliCandidates } from "../src/connections/DockerCliResolver";

describe("Docker CLI resolver", () => {
  it("prefers PATH and supports common macOS, Linux, and Windows installations", () => {
    expect(dockerCliCandidates({ PATH: "/custom/bin:/usr/bin" }, "darwin").map((candidate) => candidate.path)).toContain("/custom/bin/docker");
    expect(dockerCliCandidates({}, "darwin").map((candidate) => candidate.path)).toEqual(expect.arrayContaining(["/opt/homebrew/bin/docker", "/usr/local/bin/docker", "/Applications/Docker.app/Contents/Resources/bin/docker"]));
    expect(dockerCliCandidates({}, "linux").map((candidate) => candidate.path)).toEqual(expect.arrayContaining(["/usr/bin/docker", "/usr/local/bin/docker", "/snap/bin/docker"]));
    expect(dockerCliCandidates({ Path: "C:\\Tools;C:\\Docker", ProgramFiles: "C:\\Program Files" }, "win32").map((candidate) => candidate.path)).toContain("C:\\Tools/docker.exe");
  });

  it("skips invalid PATH candidates and reports a working CLI even when the daemon is unavailable", async () => {
    const probe = async (candidate: string) => candidate === "/valid/docker" ? { version: "29.6.1" } : candidate === "/invalid/docker" ? { error: "not-executable" as const } : {};
    const resolution = await new DockerCliResolver({ PATH: "/invalid:/valid" }, "linux", probe).resolve();
    expect(resolution).toMatchObject({ availability: "available", executablePath: "/valid/docker", source: "path", version: "29.6.1" });
  });

  it("returns a safe unavailable state without executing arbitrary candidates", async () => {
    const resolution = await new DockerCliResolver({}, "linux", async () => ({})).resolve();
    expect(resolution).toMatchObject({ availability: "not-found", safeMessage: "Docker Connector could not locate the Docker command on this computer." });
  });
});
