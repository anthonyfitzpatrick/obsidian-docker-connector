/**
 * The Docker Engine reports Compose identity as labels on each container.
 *
 * These values are deliberately kept separate from Docker's container name:
 * Compose is free to choose names that include a project prefix, replica
 * suffix, or an entirely unrelated convention. Applications therefore never
 * infer project or service identity from a name, image, network, or path.
 */
export interface DockerComposeMetadata {
  project: string;
  service?: string;
  containerNumber?: number;
  oneOff: boolean;
  version?: string;
  workingDirectory?: string;
  configFiles: string[];
}

const PROJECT = "com.docker.compose.project";
const SERVICE = "com.docker.compose.service";
const CONTAINER_NUMBER = "com.docker.compose.container-number";
const ONE_OFF = "com.docker.compose.oneoff";
const VERSION = "com.docker.compose.version";
const WORKING_DIRECTORY = "com.docker.compose.project.working_dir";
const CONFIG_FILES = "com.docker.compose.project.config_files";

/** Extracts only official Compose labels, without applying naming heuristics. */
export function getDockerComposeMetadata(labels: Record<string, string>): DockerComposeMetadata | undefined {
  const project = value(labels[PROJECT]);
  if (!project) return undefined;
  const containerNumberText = value(labels[CONTAINER_NUMBER]);
  const containerNumber = containerNumberText && /^\d+$/.test(containerNumberText) ? Number(containerNumberText) : undefined;
  const validContainerNumber = containerNumber !== undefined && Number.isSafeInteger(containerNumber) && containerNumber > 0 ? containerNumber : undefined;
  return {
    project,
    service: value(labels[SERVICE]),
    containerNumber: validContainerNumber,
    oneOff: /^true$/i.test(labels[ONE_OFF] ?? ""),
    version: value(labels[VERSION]),
    workingDirectory: value(labels[WORKING_DIRECTORY]),
    configFiles: (labels[CONFIG_FILES] ?? "").split(",").map((file) => file.trim()).filter(Boolean)
  };
}

function value(raw: string | undefined): string | undefined { const trimmed = raw?.trim(); return trimmed || undefined; }
