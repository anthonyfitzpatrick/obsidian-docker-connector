import { describe, expect, it } from "vitest";
import { validateProfile } from "../src/utils/profileValidation";
import type { SshDockerProfile } from "../src/models/DockerConnectionProfile";
const profile: SshDockerProfile = { id: "p", name: "Production", enabled: true, createdAt: "", updatedAt: "", sshHost: "46.62.226.180", sshPort: 22, sshUsername: "obsidian", authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock" };
describe("password SSH profile validation", () => {
  it("accepts a complete SSH Docker profile", () => expect(() => validateProfile(profile)).not.toThrow());
  it("rejects missing SSH fields and control characters", () => { expect(() => validateProfile({ ...profile, sshPort: 0 })).toThrow(); expect(() => validateProfile({ ...profile, sshHost: "host\u0000" })).toThrow("control characters"); });
  it("requires a path for a private-key profile and serializes no credentials", () => { expect(() => validateProfile({ ...profile, authentication: { type: "private-key", privateKeyPath: "" } })).toThrow("Private key file"); const serialized = JSON.stringify({ ...profile, authentication: { type: "private-key", privateKeyPath: "/Users/test/.ssh/id_ed25519" } }); expect(serialized).not.toContain("passphrase"); expect(serialized).not.toContain("password"); });
});
