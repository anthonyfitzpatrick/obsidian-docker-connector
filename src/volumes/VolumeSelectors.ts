import type { DockerVolumeSummary, VolumesViewState } from "./VolumeModels";

/**
 * Pure volume filtering and ordering for an immutable host snapshot.
 *
 * Selectors intentionally return a new ordered view of already-normalized data
 * and do not inspect paths, load details, or make Docker requests while a user
 * searches or changes a filter.
 */
export function selectVolumes(items: DockerVolumeSummary[], state: VolumesViewState) { const q = state.search.trim().toLowerCase(); return items.filter((v) => (!q || [v.name, v.driver, v.mountpoint ?? "", ...Object.entries(v.labels).flatMap(([k, x]) => [k, x]), ...Object.entries(v.options).flatMap(([k, x]) => [k, x])].some((x) => x.toLowerCase().includes(q))) && (state.filter === "all" || state.filter === "in-use" && v.inUse || state.filter === "unused" && !v.inUse) && (!state.driver || v.driver === state.driver) && (!state.scope || v.scope === state.scope)).sort((a, b) => compare(a, b, state.sort) || natural(a.name, b.name)); }
export function values(items: DockerVolumeSummary[], key: "driver" | "scope") { return [...new Set(items.map((x) => x[key]))].sort(natural); } function compare(a: DockerVolumeSummary, b: DockerVolumeSummary, sort: VolumesViewState["sort"]) { if (sort === "driver") return natural(a.driver, b.driver); if (sort === "created-newest") return (b.createdTimestamp ?? -Infinity) - (a.createdTimestamp ?? -Infinity); if (sort === "created-oldest") return (a.createdTimestamp ?? Infinity) - (b.createdTimestamp ?? Infinity); if (sort === "usage-count") return b.containersUsingVolume - a.containersUsingVolume; return natural(a.name, b.name); } function natural(a: string, b: string) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }); }
