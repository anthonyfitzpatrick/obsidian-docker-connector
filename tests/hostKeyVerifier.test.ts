import { describe, expect, it } from "vitest";
import { HostKeyVerifier } from "../src/security/HostKeyVerifier";
import { HostKeyTrustRequiredError } from "../src/connections/DockerTransport";
describe("SSH host-key verification", () => {
  it("requires explicit first trust and rejects mismatches", () => { const verifier = new HostKeyVerifier(); const key = Buffer.from("server-key"); expect(() => verifier.verify(key)).toThrow(HostKeyTrustRequiredError); expect(verifier.verify(key, verifier.fingerprint(key))).toBe(true); expect(verifier.verify(key, "SHA256:incorrect")).toBe(false); });
});
