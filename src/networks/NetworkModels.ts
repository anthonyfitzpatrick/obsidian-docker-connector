import type { DockerContainerReference } from "../images/ImageModels";

/**
 * Normalized network data for the read-only Networks tab.
 *
 * These interfaces intentionally expose safe inventory facts rather than raw
 * Docker inspect payloads.  They are shared by mappers, selectors, and views
 * so renderers do not need to interpret untrusted daemon responses directly.
 */
export interface DockerSubnetSummary { subnet?: string; gateway?: string; ipRange?: string; auxiliaryAddresses: Record<string, string>; }
export interface DockerNetworkSummary { id: string; shortId: string; name: string; driver: string; scope: string; internal: boolean; attachable: boolean; ingress: boolean; enableIPv6: boolean; createdAt?: string; createdTimestamp?: number; labels: Record<string,string>; containersAttached: number; subnets: DockerSubnetSummary[]; gateways: string[]; builtIn: boolean; hostProfileId: string; mapperWarnings: string[]; containers: DockerNetworkContainerReference[]; options: Record<string,string>; }
export interface DockerNetworkContainerReference extends DockerContainerReference { ipv4?: string; ipv6?: string; macAddress?: string; }
export interface DockerNetworkDetails extends Omit<DockerNetworkSummary, "shortId" | "createdTimestamp" | "builtIn" | "hostProfileId" | "mapperWarnings" | "containersAttached"> { ipam: { driver?: string; options: Record<string,string>; config: DockerSubnetSummary[] }; }
export type NetworkFilter = "all" | "built-in" | "user-defined" | "unused" | "internal" | "external" | "attachable" | "ipv6";
