import type { Client, ClientChannel } from "ssh2";
import type { Readable } from "node:stream";
import { DockerConnectionError } from "./DockerTransport";

const STREAM_LIMIT = 32 * 1024;
const PROBE_TIMEOUT_MS = 15_000;

export interface RemoteIdentity { uid: number; username: string; primaryGid: number; supplementaryGids: number[]; groupNames: string[]; }
export interface DockerCapability { identity: RemoteIdentity; configuredUsername: string; identityMatchesProfile: boolean; dockerPath?: string; context?: string; dockerHost?: string; socketGroupGid?: number; socketGroupName?: string; persistentSocketGroup?: string; rootless: boolean; versionOutput: string; exitCode?: number; }

/** Fixed, bounded post-authentication probe of the effective remote session. */
export class DockerCapabilityProbe {
  static async run(client: Client, configuredUsername: string, configuredSocketPath: string): Promise<DockerCapability> {
    const output = await runProbeCommand(client, configuredSocketPath);
    const capability = parseDockerCapability(output.stdout, configuredUsername);
    classifyCapability(capability, output.stderr);
    return capability;
  }
}

async function runProbeCommand(client: Client, configuredSocketPath: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = ""; let stderr = ""; let settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve({ stdout, stderr }); };
    const timer = setTimeout(() => finish(new DockerConnectionError("DOCKER_CAPABILITY_CHECK_FAILED", "Docker capability probe timed out.")), PROBE_TIMEOUT_MS);
    client.exec(buildProbeCommand(configuredSocketPath), (error, channel) => {
      if (error || !channel) { finish(new DockerConnectionError("DOCKER_CAPABILITY_CHECK_FAILED", "Docker capability probe could not start.")); return; }
      bindStream(channel, (chunk) => { stdout = appendBounded(stdout, chunk); });
      bindStream(channel.stderr, (chunk) => { stderr = appendBounded(stderr, chunk); });
      channel.once("error", () => finish(new DockerConnectionError("DOCKER_CAPABILITY_CHECK_FAILED", "Docker capability probe failed.")));
      channel.once("close", () => finish());
    });
  });
}

export function parseDockerCapability(stdout: string, configuredUsername = ""): DockerCapability {
  const section = splitSections(stdout);
  const identity: RemoteIdentity = {
    username: required(section, "IDENTITY_USERNAME"),
    uid: requiredNumber(section, "IDENTITY_UID"),
    primaryGid: requiredNumber(section, "IDENTITY_PRIMARY_GID"),
    supplementaryGids: required(section, "IDENTITY_ALL_GIDS").split(/\s+/).map(Number).filter(Number.isInteger),
    groupNames: required(section, "IDENTITY_GROUP_NAMES").split(/\s+/).filter(Boolean)
  };
  const socketStat = optional(section, "DOCKER_SOCKET_STAT");
  const socketGroup = optional(section, "DOCKER_SOCKET_GROUP");
  const dockerHost = optional(section, "DOCKER_HOST");
  const context = optional(section, "DOCKER_CONTEXT");
  const contextInspect = optional(section, "DOCKER_CONTEXT_INSPECT") ?? "";
  const rootlessSocket = optional(section, "DOCKER_ROOTLESS_SOCKET") ?? "";
  return {
    identity,
    configuredUsername,
    identityMatchesProfile: !configuredUsername || identity.username === configuredUsername,
    dockerPath: optional(section, "DOCKER_PATH"),
    context,
    dockerHost,
    socketGroupGid: socketStat ? Number(/^\d+\s+(\d+)\s+\d+\s+socket$/i.exec(socketStat)?.[1]) : undefined,
    socketGroupName: socketGroup?.split(":")[0],
    persistentSocketGroup: socketGroup,
    rootless: Boolean(dockerHost || (context && context !== "default") || /docker\.sock/i.test(contextInspect) || /socket/i.test(rootlessSocket)),
    versionOutput: optional(section, "DOCKER_VERSION") ?? "",
    exitCode: numberOrUndefined(optional(section, "DOCKER_VERSION_EXIT"))
  };
}

export function classifyCapability(capability: DockerCapability, stderr = ""): void {
  if (!capability.dockerPath) throw new DockerConnectionError("DOCKER_CLI_NOT_FOUND", "Docker CLI is not installed on the remote server.");
  if (capability.exitCode === 0) return;
  const evidence = `${capability.versionOutput}\n${stderr}`;
  if (/cannot connect to the docker daemon|is the docker daemon running|dial unix .*no such file or directory|connection refused/i.test(evidence)) throw new DockerConnectionError("DOCKER_DAEMON_UNAVAILABLE", "Docker daemon is not running or is unreachable.");
  if (/permission denied/i.test(evidence)) {
    if (!capability.rootless && capability.socketGroupGid !== undefined && !hasSocketGroup(capability.identity, capability.socketGroupGid)) {
      if (capability.socketGroupName && persistentMembershipIncludes(capability.persistentSocketGroup, capability.identity.username)) throw new DockerConnectionError("DOCKER_GROUP_SESSION_STALE", `User "${capability.identity.username}" is configured as a member of the Docker socket group, but this SSH session has not inherited the new group membership. Fully disconnect all SSH sessions and reconnect.`);
      const group = capability.socketGroupName ?? `GID ${capability.socketGroupGid}`;
      throw new DockerConnectionError("DOCKER_USER_NOT_IN_SOCKET_GROUP", `SSH login succeeded as user "${capability.identity.username}", but this SSH session does not have access to Docker socket group ${group}. Add the user to that group, then fully disconnect and reconnect.`);
    }
    throw new DockerConnectionError("DOCKER_SOCKET_PERMISSION_DENIED", "The current SSH session belongs to the correct Docker socket group, but Docker still rejected access. Inspect Docker daemon configuration and socket permissions.");
  }
  if (!capability.rootless && capability.socketGroupGid === undefined) throw new DockerConnectionError("DOCKER_SOCKET_NOT_FOUND", "The Docker socket does not exist on the remote host.");
  throw new DockerConnectionError("DOCKER_CAPABILITY_CHECK_FAILED", "Docker capability check failed. Open diagnostics for bounded technical details.");
}

export function hasSocketGroup(identity: RemoteIdentity, socketGroupGid: number): boolean { return identity.primaryGid === socketGroupGid || identity.supplementaryGids.includes(socketGroupGid); }

function splitSections(stdout: string): Map<string, string> { const matches = [...stdout.matchAll(/^__(IDENTITY_USERNAME|IDENTITY_UID|IDENTITY_PRIMARY_GID|IDENTITY_ALL_GIDS|IDENTITY_GROUP_NAMES|DOCKER_PATH|DOCKER_CONTEXT|DOCKER_CONTEXT_INSPECT|DOCKER_HOST|DOCKER_SOCKET_STAT|DOCKER_ROOTLESS_SOCKET|DOCKER_SOCKET_GROUP|DOCKER_VERSION|DOCKER_VERSION_EXIT)__\r?$/gm)]; const sections = new Map<string, string>(); for (let index = 0; index < matches.length; index += 1) { const start = (matches[index].index ?? 0) + matches[index][0].length; const end = matches[index + 1]?.index ?? stdout.length; sections.set(matches[index][1], stdout.slice(start, end).trim()); } return sections; }
function required(section: Map<string, string>, name: string): string { const value = optional(section, name); if (!value) throw new DockerConnectionError("DOCKER_CAPABILITY_CHECK_FAILED", `Remote capability probe did not return ${name}.`); return value; }
function requiredNumber(section: Map<string, string>, name: string): number { const value = numberOrUndefined(required(section, name)); if (value === undefined) throw new DockerConnectionError("DOCKER_CAPABILITY_CHECK_FAILED", `Remote capability probe returned an invalid ${name}.`); return value; }
function optional(section: Map<string, string>, name: string): string | undefined { const value = section.get(name)?.trim(); return value || undefined; }
function numberOrUndefined(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isInteger(parsed) ? parsed : undefined; }
function persistentMembershipIncludes(groupRecord: string | undefined, username: string): boolean { return groupRecord?.split(":")[3]?.split(",").includes(username) ?? false; }
function bindStream(stream: ClientChannel | Readable | undefined, append: (chunk: string) => void): void { stream?.setEncoding("utf8"); stream?.on("data", (chunk: string) => append(chunk)); }
function appendBounded(existing: string, chunk: string): string { return `${existing}${chunk}`.slice(-STREAM_LIMIT); }
export function buildProbeCommand(configuredSocketPath: string): string { const socket = shellQuote(configuredSocketPath); return `printf '__IDENTITY_USERNAME__\\n'; id -un; printf '__IDENTITY_UID__\\n'; id -u; printf '__IDENTITY_PRIMARY_GID__\\n'; id -g; printf '__IDENTITY_ALL_GIDS__\\n'; id -G; printf '__IDENTITY_GROUP_NAMES__\\n'; id -Gn; printf '__DOCKER_PATH__\\n'; command -v docker || true; printf '__DOCKER_CONTEXT__\\n'; docker context show 2>&1 || true; printf '__DOCKER_CONTEXT_INSPECT__\\n'; docker context inspect 2>&1 || true; printf '__DOCKER_HOST__\\n'; printf '%s\\n' "\${DOCKER_HOST:-}"; printf '__DOCKER_SOCKET_STAT__\\n'; stat -c '%u %g %a %F' -- ${socket} 2>&1 || true; printf '__DOCKER_ROOTLESS_SOCKET__\\n'; if [ -n "\${XDG_RUNTIME_DIR:-}" ]; then stat -c '%u %g %a %F' -- "$XDG_RUNTIME_DIR/docker.sock" 2>&1 || true; fi; printf '__DOCKER_SOCKET_GROUP__\\n'; getent group "$(stat -c '%g' -- ${socket} 2>/dev/null)" 2>&1 || true; printf '__DOCKER_VERSION__\\n'; docker version --format '{{json .Server}}' 2>&1; probe_status=$?; printf '__DOCKER_VERSION_EXIT__\\n'; printf '%s\\n' "$probe_status"`; }
/** Closes the quote, emits a literal apostrophe, reopens it: the only POSIX-safe form. */
function shellQuote(value: string): string { return `'${value.replace(/'/g, "'\"'\"'")}'`; }
