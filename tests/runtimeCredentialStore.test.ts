import { describe, expect, it } from "vitest";
import { RuntimeCredentialStore } from "../src/security/RuntimeCredentialStore";

describe("RuntimeCredentialStore", () => {
  it("retains passwords by profile only in memory and clears them", () => {
    const store = new RuntimeCredentialStore();
    store.setPassword("wolf-359", "correct horse battery staple");
    expect(store.getPassword("wolf-359")).toBe("correct horse battery staple");
    expect(store.hasPassword("wolf-359")).toBe(true);
    store.clearPassword("wolf-359");
    expect(store.getPassword("wolf-359")).toBeUndefined();
    store.setPassword("wolf-359", "another-password");
    store.clearAll();
    expect(store.hasPassword("wolf-359")).toBe(false);
  });
  it("keeps private-key passphrases separate from passwords", () => {
    const store = new RuntimeCredentialStore();
    store.setPassword("password-host", "password");
    store.setPrivateKeyPassphrase("key-host", "passphrase");
    expect(store.getPassword("key-host")).toBeUndefined();
    expect(store.getPrivateKeyPassphrase("password-host")).toBeUndefined();
    expect(store.getPrivateKeyPassphrase("key-host")).toBe("passphrase");
    store.clearProfile("key-host");
    expect(store.hasPrivateKeyPassphrase("key-host")).toBe(false);
  });
  it("keeps TLS client-key passphrases in the same runtime-only boundary", () => {
    const store = new RuntimeCredentialStore();
    store.setTlsClientKeyPassphrase("tls-host", "tls-secret");
    expect(store.getTlsClientKeyPassphrase("tls-host")).toBe("tls-secret");
    store.clearProfile("tls-host");
    expect(store.getTlsClientKeyPassphrase("tls-host")).toBeUndefined();
  });
});
