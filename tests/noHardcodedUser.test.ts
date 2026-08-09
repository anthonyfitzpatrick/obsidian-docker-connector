import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("runtime SSH username handling", () => {
  it("does not contain a hardcoded remediation username in production connection code", async () => {
    const files = ["src/connections/DockerCapabilityProbe.ts", "src/security/DockerPermissionRemediation.ts", "src/connections/SshDockerTransport.ts"];
    const source = await Promise.all(files.map((file) => readFile(file, "utf8")));
    expect(source.join("\n").toLowerCase()).not.toContain("anthony");
  });
});
