import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const view = readFileSync(resolve(process.cwd(), "src/views/DockerDashboardView.ts"), "utf8");
const render = view.slice(view.indexOf("async render()"), view.indexOf("private renderHeader"));
const gate = view.slice(view.indexOf("private renderAuthenticationGate"), view.indexOf("private renderOverview"));
const navigate = view.slice(view.indexOf("private navigate("), view.indexOf("class DockerHostModal"));

describe("Dashboard Applications routing", () => {
  it("dispatches an Online Applications route to ApplicationsTab, not Overview", () => {
    expect(render).toContain('case "applications": this.renderApplications(content); break;');
    expect(view).toContain('private renderApplications(root: HTMLElement): void { this.applicationsTab.render(root, this.selectedHostId); }');
    expect(render).toContain('case "overview": this.renderOverview(content, profiles); break;');
  });

  it("keeps Applications as the route while authentication is required", () => {
    expect(render).toContain('this.renderAuthenticationGate(content, profiles, this.page);');
    expect(gate).toContain('const applications = page === "applications";');
    expect(gate).toContain('"Reconnect to view Applications"');
    expect(gate).toContain('"Docker Compose application details remain hidden until a secure session connection succeeds."');
    expect(gate).toContain('docker-connector__connection-required--${page}');
    expect(gate).not.toContain('this.page = "overview"');
  });

  it("retains the Overview authentication-required presentation", () => {
    expect(gate).toContain('applications ? "Reconnect to view Applications" : "Reconnect Docker connections"');
    expect(gate).toContain('applications ? "Docker Compose application details remain hidden until a secure session connection succeeds." : "Docker details remain hidden until a secure session connection succeeds."');
  });

  it("switches independently between Overview and Applications", () => {
    expect(navigate).toContain('this.page = page;');
    expect(view).toContain('button.onclick = () => this.navigate(item.id);');
    expect(view).toContain('this.page === item.id ? " is-active" : ""');
  });
});
