import { execFile } from "node:child_process";
import { platform } from "node:os";

export interface SystemSshDiagnostic { nc: "reachable" | "unreachable" | "unavailable"; ssh: "reached" | "failed" | "unavailable"; summary: string; }
/** Optional macOS comparison only; never used as the plugin transport or given credentials. */
export async function runSystemSshDiagnostic(host: string, port: number, username: string): Promise<SystemSshDiagnostic> {
  if (platform() !== "darwin") return { nc: "unavailable", ssh: "unavailable", summary: "System SSH comparison is available only on macOS." };
  const nc = await execute("/usr/bin/nc", ["-vz", "-w", "10", host, String(port)], 15_000);
  const ssh = await execute("/usr/bin/ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "ConnectionAttempts=1", `${username}@${host}`, "exit"], 15_000);
  const ncState = nc.ok ? "reachable" : "unreachable";
  const sshState = ssh.ok || /host key verification|permission denied|authentication failed/i.test(ssh.output) ? "reached" : "failed";
  return { nc: ncState, ssh: sshState, summary: `macOS nc: ${ncState}; system SSH: ${sshState}.` };
}
function execute(file: string, args: string[], timeout: number): Promise<{ ok: boolean; output: string }> { return new Promise((resolve) => execFile(file, args, { timeout }, (error, stdout, stderr) => resolve({ ok: !error, output: `${stdout}\n${stderr}` }))); }
