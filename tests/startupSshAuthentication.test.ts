import { describe, expect, it } from "vitest";
import { DockerConnectionFactory } from "../src/connections/DockerConnectionFactory";
import type { SshDockerProfile } from "../src/models/DockerConnectionProfile";

const base: Omit<SshDockerProfile, "authentication"> = {
  id: "startup-ssh",
  name: "Startup SSH",
  enabled: true,
  createdAt: "",
  updatedAt: "",
  connectionType: "ssh",
  sshHost: "127.0.0.1",
  sshPort: 22,
  sshUsername: "docker",
  remoteSocketPath: "/var/run/docker.sock",
  hostKeyFingerprint: "SHA256:trusted"
};

describe("startup SSH authentication decisions", () => {
  it("preflights only a password profile whose runtime credential is absent", () => {
    const factory = new DockerConnectionFactory();
    const password: SshDockerProfile = { ...base, authentication: { type: "password" } };
    const unencryptedPrivateKey: SshDockerProfile = { ...base, authentication: { type: "private-key", privateKeyPath: "/tmp/id_ed25519" } };

    expect(factory.authenticationRequirement(password)).toContain("SSH password");
    expect(factory.authenticationRequirement(unencryptedPrivateKey)).toBeUndefined();

    factory.setRuntimePassword(password.id, "remembered-password");
    expect(factory.authenticationRequirement(password)).toBeUndefined();
  });
});
