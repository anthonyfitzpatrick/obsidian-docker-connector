import type { DockerNetworkSummary, NetworkFilter } from "./NetworkModels";

/**
 * Pure read-only network selectors.
 *
 * Filtering happens once over normalized snapshot data, keeping the view free
 * of Docker-response parsing and ensuring a search cannot trigger network I/O
 * or alter Docker resources.
 */
export function selectNetworks(items: DockerNetworkSummary[], query: string, filter: NetworkFilter, driver: string | null, scope: string | null): DockerNetworkSummary[] {
  const needle = query.toLowerCase();
  return items.filter((network) => {
    const matches = !needle || [network.name, network.driver, network.scope, ...network.gateways, ...network.subnets.flatMap((subnet) => [subnet.subnet ?? "", subnet.gateway ?? ""]), ...Object.entries(network.labels).flatMap(([key, value]) => [key, value])].some((value) => value.toLowerCase().includes(needle));
    const kind = filter === "all" || filter === "built-in" && network.builtIn || filter === "user-defined" && !network.builtIn || filter === "unused" && network.containersAttached === 0 || filter === "internal" && network.internal || filter === "external" && !network.internal || filter === "attachable" && network.attachable || filter === "ipv6" && network.enableIPv6;
    return matches && kind && (!driver || network.driver === driver) && (!scope || network.scope === scope);
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
export function values(items: DockerNetworkSummary[], key: "driver" | "scope") { return [...new Set(items.map((item) => item[key]))].sort(); }
