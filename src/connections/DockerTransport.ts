import type { DockerConnectionProfile } from "../models/DockerConnectionProfile";

/**
 * Shared transport contract for the local socket, SSH, Docker Context, and
 * mutual-TLS implementations. It supports only the verbs required internally;
 * callers do not receive a generic mutation client. DockerApiClient further
 * restricts inspection callers to allowlisted GET routes.
 */

/** The transport protocol supports the small set of verbs used internally.  The
 * public DockerApiClient remains GET-only; mutations are only reachable through
 * DockerContainerActionService's route-specific methods. */
export interface DockerApiRequest { method: "GET" | "POST" | "DELETE"; path: string; body?: string; responseType?: "json" | "text" | "empty"; }
export type ConnectionTestStepStatus = "pending" | "running" | "success" | "warning" | "error" | "skipped";
export interface ConnectionTestStep { id: string; label: string; status: ConnectionTestStepStatus; message?: string; technicalDetails?: string; }
export interface DockerConnectionTestResult { success: boolean; steps: ConnectionTestStep[]; safeErrorCode?: string; safeErrorMessage?: string; dockerVersion?: string; apiVersion?: string; hostFingerprint?: string; }
/** A connected channel to precisely one configured Docker host profile. */
export interface DockerTransport {
  readonly profile: DockerConnectionProfile;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  request<T>(request: DockerApiRequest): Promise<T>;
  testConnection(): Promise<DockerConnectionTestResult>;
}

export class HostKeyTrustRequiredError extends Error {
  constructor(readonly fingerprint: string) { super(`SSH host identity must be trusted before connecting (${fingerprint}).`); this.name = "HostKeyTrustRequiredError"; }
}
export class DockerConnectionError extends Error {
  constructor(readonly code: string, message: string, readonly details?: string, readonly httpStatus?: number) { super(message); this.name = "DockerConnectionError"; }
}

export function dockerHttpError(status: number, body: string, ping = false): DockerConnectionError {
  const daemonMessage = body.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  const message = `${ping ? "Docker /_ping" : "Docker API"} returned HTTP ${status}.${daemonMessage ? ` ${daemonMessage}` : ""}`;
  return new DockerConnectionError(ping ? "DOCKER_PING_FAILED" : "DOCKER_HTTP_FAILED", message, daemonMessage || undefined, status);
}
