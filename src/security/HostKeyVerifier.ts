import { createHash } from "node:crypto";
import { HostKeyTrustRequiredError } from "../connections/DockerTransport";

/** Strict SSH host-key verification; never equivalent to StrictHostKeyChecking=no. */
export class HostKeyVerifier {
  verify(key: Buffer, expected?: string): boolean {
    const fingerprint = this.fingerprint(key);
    if (!expected) throw new HostKeyTrustRequiredError(fingerprint);
    return fingerprint === expected;
  }
  fingerprint(key: Buffer): string { return `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`; }
}
