import { describe, expect, it } from "vitest";
import { SshKeyGenerationWorkflow } from "../src/security/SshKeyGenerationWorkflow";

const key = { privateKeyPath: "/tmp/key", publicKeyPath: "/tmp/key.pub", publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA docker-connector" };
const resolved = { ...key, identity: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", fingerprint: "SHA256:example", source: "matching-file" as const };

describe("SSH key generation workflow", () => {
  it("shows immediate ordered progress, rejects duplicate submission, and retains success until Close", async () => {
    const workflow = new SshKeyGenerationWorkflow();
    const states: string[] = [];
    let generationCalls = 0;
    let resolveGeneration: ((value: typeof key) => void) | undefined;
    workflow.setPassphrase(" session passphrase ");
    workflow.setConfirmation(" session passphrase ");
    const first = workflow.submit((_passphrase, onStage) => {
      generationCalls += 1;
      onStage("GENERATING");
      return new Promise((resolve) => resolveGeneration = resolve);
    }, async () => resolved, (presentation) => states.push(presentation.state));
    const second = workflow.submit(async () => key, async () => resolved);
    expect(workflow.presentation).toEqual({ state: "generating", message: "Generating Ed25519 key…" });
    expect(await second).toEqual(workflow.presentation);
    expect(generationCalls).toBe(1);
    resolveGeneration?.(key);
    await expect(first).resolves.toEqual({ state: "success", message: "Ed25519 SSH key ready.", fingerprint: "SHA256:example" });
    expect(states).toEqual(["preparing", "generating", "resolving-public-key", "verifying-key-pair", "success"]);
    expect(workflow.takeCompleted()).toMatchObject({ resolved, passphrase: " session passphrase " });
  });

  it("keeps failures retryable without delivering parent state", async () => {
    const workflow = new SshKeyGenerationWorkflow();
    workflow.setPassphrase("passphrase");
    workflow.setConfirmation("passphrase");
    await expect(workflow.submit(async () => { throw new Error("unsafe implementation detail"); }, async () => resolved)).resolves.toEqual({ state: "failed", message: "SSH key generation failed." });
    expect(workflow.takeCompleted()).toBeUndefined();
    await expect(workflow.submit(async () => key, async () => resolved)).resolves.toMatchObject({ state: "success", fingerprint: "SHA256:example" });
  });

  it("does not advance when the optional passphrase confirmation differs", async () => {
    const workflow = new SshKeyGenerationWorkflow();
    workflow.setPassphrase("one");
    workflow.setConfirmation("two");
    await expect(workflow.submit(async () => key, async () => resolved)).resolves.toEqual({ state: "failed", message: "The SSH key passphrases do not match." });
  });
});
