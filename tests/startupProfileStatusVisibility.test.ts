import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("startup profile status visibility", () => {
  it("does not let an authentication-required profile hide an online mTLS profile in All Docker hosts", () => {
    const source = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
    const method = source.slice(source.indexOf("private requiresAuthenticationGate"), source.indexOf("private renderAuthenticationGate"));
    expect(method).toContain('if (this.selectedHostId === "all") return false;');
  });
});
