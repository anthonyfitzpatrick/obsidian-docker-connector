import type { DiscoveredDockerContext } from "./DockerContextDiscovery";
import type { DockerContextProfile } from "../models/DockerConnectionProfile";

const SAVABLE_ENDPOINT_TYPES = new Set(["unix-socket", "windows-named-pipe", "ssh", "tcp-tls"]);

/** Returns whether a freshly discovered context may safely be saved as a profile. */
export function canSaveDiscoveredDockerContext(context: DiscoveredDockerContext | undefined): boolean {
  return Boolean(context && !context.error && context.dockerEndpoint && context.supported && SAVABLE_ENDPOINT_TYPES.has(context.dockerEndpoint.type));
}

/** Creates the deliberately small, non-secret snapshot persisted for a Docker Context profile. */
export function mapDiscoveredDockerContextToProfile(input: {
  id: string;
  name: string;
  description?: string;
  category?: string;
  context: DiscoveredDockerContext;
  now: string;
}): DockerContextProfile {
  if (!canSaveDiscoveredDockerContext(input.context)) throw new Error("DOCKER_CONTEXT_UNSUPPORTED");
  return {
    id: input.id,
    name: clean(input.name),
    description: optional(input.description),
    category: optional(input.category),
    connectionType: "docker-context",
    contextName: clean(input.context.name),
    contextSnapshot: mapDiscoveredDockerContextSnapshot(input.context, input.now),
    enabled: true,
    createdAt: input.now,
    updatedAt: input.now
  };
}

/** Maps only safe discovery fields into a detached, persistable snapshot. */
export function mapDiscoveredDockerContextSnapshot(context: DiscoveredDockerContext, now: string, importedAt = now): DockerContextProfile["contextSnapshot"] {
  if (!canSaveDiscoveredDockerContext(context)) throw new Error("DOCKER_CONTEXT_UNSUPPORTED");
  const endpoint = context.dockerEndpoint!;
  return { description: optional(context.description), isCurrentWhenSaved: context.isCurrent, endpointType: endpoint.type, endpointDisplay: optional(safeEndpointDisplay(endpoint.displayHost)), skipTlsVerify: endpoint.skipTlsVerify, supported: true, importedAt, lastDiscoveredAt: now };
}

/** Applies an edit draft to an existing Context profile without retaining discovery data. */
export function updateDockerContextProfile(input: {
  existingProfile: DockerContextProfile;
  name: string;
  description?: string;
  category?: string;
  selectedContext: DiscoveredDockerContext;
  now: string;
}): DockerContextProfile {
  const mapped = mapDiscoveredDockerContextToProfile({
    id: input.existingProfile.id,
    name: input.name,
    description: input.description,
    category: input.category,
    context: input.selectedContext,
    now: input.now
  });
  return { ...mapped, enabled: input.existingProfile.enabled, createdAt: input.existingProfile.createdAt };
}

function clean(value: string): string { return value.trim().replace(/[\x00-\x1F\x7F]/g, ""); }
function optional(value: string | undefined): string | undefined { const result = value === undefined ? undefined : clean(value); return result || undefined; }
function safeEndpointDisplay(value: string): string { return value.replace(/^[^@]+@/, ""); }
