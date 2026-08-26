import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const modal = readFileSync(new URL("../src/views/DockerDashboardView.ts", import.meta.url), "utf8");

describe("Docker mutual-TLS modal workflow", () => {
  it("keeps the three certificate selections independently mapped", () => {
    expect(modal).toContain('["CA Certificate", "tlsCaPath", "Choose CA certificate"');
    expect(modal).toContain('["Client Certificate", "tlsCertPath", "Choose client certificate"');
    expect(modal).toContain('["Client Private Key", "tlsKeyPath", "Choose client private key"');
    expect(modal).toContain('this[field] = path; await this.revalidateTls();');
    expect(modal).toContain('caCertificatePath: this.tlsCaPath, clientCertificatePath: this.tlsCertPath, clientKeyPath: this.tlsKeyPath');
  });

  it("retains a TLS validation result for unrelated edits and revalidates only TLS inputs", () => {
    expect(modal).toContain('this.text(root, "Docker Host", this.tlsHost, (value) => { this.tlsHost = value;');
    expect(modal).not.toContain('this.tlsHost = value; this.tlsValidation = undefined');
    expect(modal).toContain('this.tlsPassphrase = value; void this.revalidateTls();');
    expect(modal).toContain('this.formError = undefined; this.tlsValidation = undefined; this.tlsValidationError = undefined;');
    expect(modal).toContain('else if (this.tlsValidationError) root.createDiv({ text: this.tlsValidationError');
    expect(modal).toContain('if (this.connectionType === "docker-tls" && this.tlsValidationError) { this.formError = this.tlsValidationError; return false; }');
  });
});
