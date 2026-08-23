import { describe, expect, it } from "vitest";
import type { DockerConnectionProfile, SshDockerProfile } from "../src/models/DockerConnectionProfile";
import { RememberedSshPasswordStore, rememberedPasswordInvalidated } from "../src/security/RememberedSshPasswordStore";

const passwordProfile = (id = "ssh", host = "host", username = "user"): SshDockerProfile => ({ id, name: id, enabled: true, createdAt: "", updatedAt: "", connectionType: "ssh", sshHost: host, sshPort: 22, sshUsername: username, authentication: { type: "password" }, remoteSocketPath: "/var/run/docker.sock", hostKeyFingerprint: "SHA256:test" });
const privateKeyProfile = (id = "ssh"): SshDockerProfile => ({ ...passwordProfile(id), authentication: { type: "private-key", privateKeyPath: "/tmp/id_test" } });

describe("RememberedSshPasswordStore", () => {
  it("loads and serializes only profile-ID-scoped SSH password credentials", () => {
    const store = new RememberedSshPasswordStore();
    store.load({ ssh: "remembered-password", missing: "ignored", tls: 4 }, [passwordProfile(), privateKeyProfile("key")]);

    expect(store.get("ssh")).toBe("remembered-password");
    expect(store.get("missing")).toBeUndefined();
    expect(store.get("key")).toBeUndefined();
    expect(store.serialize()).toEqual({ ssh: "remembered-password" });
    expect(JSON.stringify(passwordProfile() as DockerConnectionProfile)).not.toContain("remembered-password");
  });

  it("forgets credentials without affecting other profile IDs", () => {
    const store = new RememberedSshPasswordStore();
    store.set("one", "first");
    store.set("two", "second");
    expect(store.take("one")).toBe("first");
    expect(store.serialize()).toEqual({ two: "second" });
  });

  it("invalidates remembered passwords when SSH authentication, host, or user changes", () => {
    const previous = passwordProfile();
    expect(rememberedPasswordInvalidated(previous, { ...previous, sshHost: "other" })).toBe(true);
    expect(rememberedPasswordInvalidated(previous, { ...previous, sshUsername: "other" })).toBe(true);
    expect(rememberedPasswordInvalidated(previous, privateKeyProfile())).toBe(true);
    expect(rememberedPasswordInvalidated(previous, { ...previous, sshPort: 2222 })).toBe(false);
  });
});
