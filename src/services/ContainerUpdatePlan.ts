import { DockerConnectionError } from "../connections/DockerTransport";

type RecordValue = Record<string, unknown>;
/**
 * The constrained subset of inspect data that may be replayed into Docker's
 * create endpoint. The raw inspection object never leaves this planning flow:
 * in particular, environment values are not rendered in previews or safe
 * diagnostics. Unsupported configurations fail before the mutation boundary.
 */
export interface ContainerRecreatePlan { originalContainerId: string; originalName: string; imageReference: string; originalImageId: string; wasRunning: boolean; createPayload: RecordValue; networks: Array<{ id: string; name: string; aliases: string[] }>; environmentCount: number; healthcheck: boolean; stopTimeout: number; }
/** The limited inspect data needed to compare images without authorizing an update. */
export interface ContainerImageUpdateTarget { containerName: string; imageReference: string; currentImageId: string; }
export interface ContainerUpdateEligibility { eligible: boolean; reasonCode?: string; safeReason?: string; imageReference?: string; composeManaged?: boolean; }
export interface ContainerUpdatePreview { containerName: string; imageReference: string; currentImageId: string; wasRunning: boolean; namedVolumeCount: number; bindMountCount: number; publishedPortCount: number; networkNames: string[]; environmentCount: number; labelCount: number; restartPolicy?: string; healthcheck: boolean; workingDirectory?: string; configuredUser?: string; stopTimeout: number; readOnlyRootFilesystem?: boolean; }
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Pure, deliberately conservative conversion from inspect data to Docker create data. */
export function buildContainerRecreatePlan(raw: unknown): ContainerRecreatePlan {
  const item = object(raw), config = object(item.Config), host = object(item.HostConfig), state = object(item.State), networks = object(object(item.NetworkSettings).Networks);
  const id = text(item.Id), name = text(item.Name)?.replace(/^\//, ""), image = text(config.Image), imageId = text(item.Image);
  if (!id || !name || !image || !imageId) throw unsupported("identity or image");
  const eligibility = getContainerUpdateEligibility(image, config.Labels);
  if (!eligibility.eligible) throw new DockerConnectionError(eligibility.reasonCode ?? "CONTAINER_UPDATE_CONFIG_UNSUPPORTED", eligibility.safeReason ?? "The container cannot be recreated safely.");
  const reference = eligibility.imageReference!;
  const unsupportedFields = [host.AutoRemove ? "HostConfig.AutoRemove" : "", text(host.NetworkMode)?.startsWith("container:") ? "HostConfig.NetworkMode" : "", strings(host.VolumesFrom).length ? "HostConfig.VolumesFrom" : "", strings(host.Links).length ? "HostConfig.Links" : "", ...mountKinds(item.Mounts)].filter(Boolean);
  if (unsupportedFields.length) throw unsupported(unsupportedFields.join(", "));
  const mappedNetworks = Object.entries(networks).map(([name, value]) => { const network = object(value); return { id: text(network.NetworkID) ?? name, name, aliases: strings(network.Aliases) }; });
  // Docker creates a container attached to one network. Explicitly retain the
  // captured first attachment here, then the transaction reconnects each
  // remaining attachment by its stable Docker network ID.
  const primaryNetwork = mappedNetworks[0];
  const payload: RecordValue = { Image: reference, Hostname: config.Hostname, Domainname: config.Domainname, User: config.User, Tty: config.Tty, OpenStdin: config.OpenStdin, StdinOnce: config.StdinOnce, Env: config.Env, Cmd: config.Cmd, Entrypoint: config.Entrypoint, WorkingDir: config.WorkingDir, Labels: config.Labels, ExposedPorts: config.ExposedPorts, Healthcheck: config.Healthcheck, StopSignal: config.StopSignal, StopTimeout: config.StopTimeout, HostConfig: pickHostConfig(host), ...(primaryNetwork ? { NetworkingConfig: { EndpointsConfig: { [primaryNetwork.name]: primaryNetwork.aliases.length ? { Aliases: primaryNetwork.aliases } : {} } } } : {}) };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return { originalContainerId: id, originalName: name, imageReference: reference, originalImageId: imageId, wasRunning: state.Running === true, createPayload: payload, networks: mappedNetworks, environmentCount: strings(config.Env).length, healthcheck: Boolean(config.Healthcheck), stopTimeout: typeof config.StopTimeout === "number" ? config.StopTimeout : 30 };
}
export function validateContainerRecreatePlan(plan: ContainerRecreatePlan): ContainerRecreatePlan { if (!plan.networks.length) throw unsupported("NetworkSettings.Networks"); return plan; }
/**
 * Extracts an image comparison target without evaluating whether the full
 * container can be safely recreated. Availability is deliberately distinct
 * from eligibility: a Compose-managed container can have a newer image even
 * though Docker Connector must not offer its standalone Update transaction.
 */
export function getContainerImageUpdateTarget(raw: unknown): ContainerImageUpdateTarget {
  const item = object(raw), config = object(item.Config);
  const name = text(item.Name)?.replace(/^\//, ""), imageReference = text(config.Image), currentImageId = text(item.Image);
  if (!name || !imageReference || !currentImageId) throw new DockerConnectionError("CONTAINER_UPDATE_CONFIG_UNSUPPORTED", "The container image could not be identified safely.");
  if (!isPullableImageReference(imageReference)) throw new DockerConnectionError("CONTAINER_UPDATE_IMAGE_UNPULLABLE", "The container image does not have a clear pullable repository and tag.");
  return { containerName: name, imageReference, currentImageId };
}
/** Produces only safe, bounded preview data; raw inspect/configuration remains in the transaction. */
export function containerUpdatePreview(raw: unknown, plan: ContainerRecreatePlan): ContainerUpdatePreview { const item = object(raw), config = object(item.Config), host = object(item.HostConfig), mounts = Array.isArray(item.Mounts) ? item.Mounts.map(object) : []; const bindings = object(host.PortBindings); return { containerName: plan.originalName, imageReference: plan.imageReference, currentImageId: plan.originalImageId, wasRunning: plan.wasRunning, namedVolumeCount: mounts.filter((mount) => text(mount.Type) === "volume").length, bindMountCount: mounts.filter((mount) => text(mount.Type) === "bind").length, publishedPortCount: Object.keys(bindings).length, networkNames: plan.networks.map((network) => network.name), environmentCount: plan.environmentCount, labelCount: Object.keys(object(config.Labels)).length, restartPolicy: text(object(host.RestartPolicy).Name), healthcheck: plan.healthcheck, workingDirectory: text(config.WorkingDir), configuredUser: text(config.User), stopTimeout: plan.stopTimeout, readOnlyRootFilesystem: typeof host.ReadonlyRootfs === "boolean" ? host.ReadonlyRootfs : undefined }; }
function pickHostConfig(host: RecordValue): RecordValue { const allowed = ["Binds", "PortBindings", "RestartPolicy", "CapAdd", "CapDrop", "Dns", "DnsOptions", "DnsSearch", "ExtraHosts", "IpcMode", "PidMode", "Privileged", "PublishAllPorts", "ReadonlyRootfs", "SecurityOpt", "Tmpfs", "ShmSize", "Sysctls", "LogConfig", "NetworkMode", "Resources", "Mounts"]; return Object.fromEntries(allowed.flatMap((key) => host[key] === undefined ? [] : [[key, host[key]]])); }
function mountKinds(value: unknown): string[] { return Array.isArray(value) ? value.flatMap((mount) => { const type = text(object(mount).Type); return type && !["bind", "volume"].includes(type) ? [`Mounts.${type}`] : []; }) : []; }
/** Safe summary-level gate. Full inspect validation still runs before any mutation. */
export function getContainerUpdateEligibility(image: string | undefined, labels: unknown): ContainerUpdateEligibility {
  if (isComposeManaged(labels)) return { eligible: false, reasonCode: "CONTAINER_UPDATE_COMPOSE_MANAGED", safeReason: "This container is managed by Docker Compose. Update it through its Compose project to avoid breaking the application.", composeManaged: true };
  if (!image || !isPullableImageReference(image)) return { eligible: false, reasonCode: "CONTAINER_UPDATE_IMAGE_UNPULLABLE", safeReason: "The container image does not have a clear pullable repository and tag." };
  return { eligible: true, imageReference: image, composeManaged: false };
}
export function isComposeManaged(value: unknown): boolean { const labels = object(value); return ["com.docker.compose.project", "com.docker.compose.service", "com.docker.compose.container-number", "com.docker.compose.project.config_files", "com.docker.compose.project.working_dir"].some((key) => Boolean(labels[key])); }
export function isPullableImageReference(value: string): boolean { return !/^sha256:|@sha256:/.test(value) && /^(?:[a-z0-9][a-z0-9._-]*(?::[0-9]{1,5})?\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value); }
function text(value: unknown): string | undefined { return typeof value === "string" && value ? value : undefined; }
function unsupported(fields: string): DockerConnectionError { return new DockerConnectionError("CONTAINER_UPDATE_CONFIG_UNSUPPORTED", `The container cannot be recreated safely because these fields are unsupported: ${fields}.`); }
