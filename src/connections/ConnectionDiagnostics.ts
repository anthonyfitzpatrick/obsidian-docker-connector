import type { ConnectionTestStep, ConnectionTestStepStatus, DockerConnectionTestResult } from "./DockerTransport";

/**
 * Connection diagnostics
 *
 * Maintains the short, user-visible progress trail used when a connection is
 * tested.  It deliberately stores only bounded, safe outcome text: transport
 * implementations must not put credentials, raw Docker responses, command
 * output, or stack traces into these steps.
 */
const DEFINITIONS: Array<[string, string]> = [["input", "Validate profile"], ["password", "Load authentication source"], ["private-key-path", "Resolve private-key path"], ["private-key-read", "Read private-key file"], ["private-key-parse", "Parse private-key authentication source"], ["parse", "Parse SSH host"], ["dns", "Resolve DNS when required"], ["tcp", "Open SSH TCP connection"], ["handshake", "Complete SSH handshake"], ["host-key", "Receive host key"], ["trust", "Verify host key"], ["auth", "Authenticate SSH session"], ["keyboard-interactive", "Attempt keyboard-interactive fallback if requested"], ["identity", "Detect authenticated remote user"], ["groups", "Inspect effective remote groups"], ["context", "Inspect Docker CLI context"], ["socket-stat", "Inspect Docker socket ownership"], ["daemon", "Verify Docker daemon access"], ["socket", "Start docker system dial-stdio"], ["ping-request", "Send Docker GET /_ping"], ["ping-response", "Receive Docker ping response"], ["version-request", "Send Docker GET /version"], ["version-response", "Receive Docker version response"], ["parse-response", "Parse Docker response"], ["complete", "Connection successful"]];
export class ConnectionDiagnostics {
  readonly steps: ConnectionTestStep[] = DEFINITIONS.map(([id, label]) => ({ id, label, status: "pending" }));
  set(id: string, status: ConnectionTestStepStatus, message?: string, technicalDetails?: string): void { const step = this.steps.find((item) => item.id === id); if (step) Object.assign(step, { status, message, technicalDetails }); }
  success(version: { Version: string; ApiVersion: string }): DockerConnectionTestResult { this.set("complete", "success"); return { success: true, steps: this.steps, dockerVersion: version.Version, apiVersion: version.ApiVersion }; }
  failure(code: string, message: string, details?: string, fingerprint?: string): DockerConnectionTestResult { const active = [...this.steps].reverse().find((step) => step.status === "running" || step.status === "success"); if (active?.status === "running") this.set(active.id, "error", message, details); for (const step of this.steps) if (step.status === "pending") step.status = "skipped"; return { success: false, steps: this.steps, safeErrorCode: code, safeErrorMessage: message, hostFingerprint: fingerprint }; }
}
