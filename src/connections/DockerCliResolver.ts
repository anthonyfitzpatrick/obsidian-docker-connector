import { execFile } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const TIMEOUT = 5_000, MAX_BUFFER = 8 * 1024;

export type DockerCliAvailability = "available" | "not-found" | "not-executable" | "timed-out" | "error";
export interface DockerCliResolution { availability: DockerCliAvailability; executablePath?: string; source?: "path" | "well-known"; version?: string; errorCode?: string; safeMessage: string; }
export type DockerCliProbe = (candidate: string, platform: NodeJS.Platform) => Promise<{ version?: string; error?: DockerCliAvailability }>;

/** Resolves only bounded Docker CLI candidates; it never invokes a shell or reads shell startup files. */
export class DockerCliResolver {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env, private readonly platform: NodeJS.Platform = process.platform, private readonly probe: DockerCliProbe = probeDockerCli) {}

  async resolve(): Promise<DockerCliResolution> {
    let lastError: DockerCliAvailability | undefined;
    for (const candidate of dockerCliCandidates(this.environment, this.platform)) {
      const result = await this.probe(candidate.path, this.platform);
      if (result.version) return { availability: "available", executablePath: candidate.path, source: candidate.source, version: result.version, safeMessage: "Docker CLI detected." };
      lastError ??= result.error;
    }
    if (lastError === "not-executable") return { availability: lastError, safeMessage: "Docker CLI was found but is not executable." };
    if (lastError === "timed-out") return { availability: lastError, safeMessage: "Docker CLI did not respond in time." };
    if (lastError === "error") return { availability: lastError, safeMessage: "Docker CLI was found but could not be validated." };
    return { availability: "not-found", safeMessage: "Docker Connector could not locate the Docker command on this computer." };
  }
}

export function dockerCliCandidates(environment: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): Array<{ path: string; source: "path" | "well-known" }> {
  const executable = platform === "win32" ? "docker.exe" : "docker";
  const pathValue = platform === "win32" ? environment.Path ?? environment.PATH : environment.PATH;
  const fromPath = (pathValue ?? "").split(platform === "win32" ? ";" : ":").filter(Boolean).map((directory) => ({ path: join(directory, executable), source: "path" as const }));
  const known = platform === "darwin" ? ["/usr/local/bin/docker", "/opt/homebrew/bin/docker", "/usr/bin/docker", "/Applications/Docker.app/Contents/Resources/bin/docker"] : platform === "linux" ? ["/usr/bin/docker", "/usr/local/bin/docker", "/snap/bin/docker"] : platform === "win32" ? [environment.ProgramFiles, environment.ProgramW6432].filter((root): root is string => Boolean(root)).map((root) => join(root, "Docker", "Docker", "resources", "bin", "docker.exe")) : [];
  return [...fromPath, ...known.map((path) => ({ path, source: "well-known" as const }))].filter((candidate, index, all) => all.findIndex((other) => other.path.toLowerCase() === candidate.path.toLowerCase()) === index);
}

async function probeDockerCli(candidate: string, platform: NodeJS.Platform): Promise<{ version?: string; error?: DockerCliAvailability }> {
  try { const info = await stat(candidate); if (!info.isFile()) return {}; if (platform !== "win32") await access(candidate, constants.X_OK); }
  catch (error) { const code = error && typeof error === "object" ? (error as NodeJS.ErrnoException).code : undefined; return code === "EACCES" || code === "EPERM" ? { error: "not-executable" } : {}; }
  try { const { stdout } = await execute(candidate, ["--version"], { shell: false, timeout: TIMEOUT, maxBuffer: MAX_BUFFER, windowsHide: true }); const version = stdout.match(/Docker version\s+([^,\s]+)/i)?.[1]; return version ? { version } : { error: "error" }; }
  catch (error) { const code = error && typeof error === "object" ? (error as NodeJS.ErrnoException).code : undefined; return code === "ETIMEDOUT" || code === "SIGTERM" ? { error: "timed-out" } : { error: "error" }; }
}
