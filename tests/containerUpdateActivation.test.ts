import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("container Update action activation", () => {
  it("uses one structured eligibility result to control the rendered Update button", async () => {
    const source = await readFile("src/containers/ContainersTab.ts", "utf8");
    expect(source).toMatch(/const updateEligibility = getContainerUpdateEligibility\(summary\.image, details\.labels\)/);
    expect(source).toMatch(/updateEligibility \}/);
    expect(source).toMatch(/capabilities\.canUpdate, capabilities\.updateReason/);
    expect(source).toMatch(/button\.disabled = !enabled \|\| inProgress/);
    expect(source).toMatch(/button\.onclick = \(\) => void action\(\)/);
  });

  it("renders a direct Update-unavailable explanation and preserves the existing transaction handler", async () => {
    const source = await readFile("src/containers/ContainersTab.ts", "utf8");
    expect(source).toMatch(/row\("ban", "Update unavailable", eligibilityReason/);
    expect(source).toMatch(/new ContainerUpdateDialog\(this\.plugin, profile, summary/);
    const dialog = await readFile("src/containers/ContainerUpdateDialog.ts", "utf8");
    expect(dialog).toMatch(/this\.plugin\.updateContainer\(this\.profile, this\.container\.id, true, this\.attemptId\)/);
    expect(dialog).toMatch(/Proceed with update/);
  });

  it("does not disable the action grid through pointer-events CSS", async () => {
    const css = await readFile("styles.css", "utf8");
    const actionStyles = css.slice(css.indexOf(".dc-container-actions"), css.indexOf("@container", css.indexOf(".dc-container-actions")));
    expect(actionStyles).not.toMatch(/pointer-events\s*:/);
    expect(actionStyles).toMatch(/\.dc-container-action-button:disabled/);
  });

  it("scopes dialog progress to its own update attempt and proceeds without a redundant acknowledgement checkbox", async () => {
    const dialog = await readFile("src/containers/ContainerUpdateDialog.ts", "utf8");
    expect(dialog).toMatch(/event\.attemptId !== this\.attemptId/);
    expect(dialog).toMatch(/Proceed with update", \(\) => void this\.proceed\(\)/);
    expect(dialog).not.toMatch(/acknowledged|type: "checkbox"/);
    expect(dialog).toMatch(/preflightContainerUpdate/);
    expect(dialog).toMatch(/Cancel and restore original/);
  });
});
