import type { DockerConnectionCapabilities } from "../connections/DockerConnectionCapabilities";
import type { DockerContainerState } from "./ContainerModels";
import type { ContainerUpdateEligibility } from "../services/ContainerUpdatePlan";

export interface ContainerActionCapabilities { canStart: boolean; canShutdown: boolean; canStop: boolean; canRestart: boolean; canUpdate: boolean; reason?: string; updateReason?: string; }
/** Pure UI policy; the typed action service independently enforces every mutation. */
export function getContainerActionCapabilities(input: { managementEnabled: boolean; hostStatus: string; connection: DockerConnectionCapabilities; containerState: DockerContainerState; activeAction?: boolean; updateEligibility?: ContainerUpdateEligibility }): ContainerActionCapabilities {
  if (!input.managementEnabled) return none("Container management is disabled in Docker Connector settings.");
  if (!input.connection.supportsContainerActions) return none("This connection method does not support container actions.");
  if (input.hostStatus !== "online") return none(`Container actions require an online Docker host. Current status: ${input.hostStatus}.`);
  if (input.activeAction) return none("A container update is already in progress.");
  const running = input.containerState === "running" || input.containerState === "restarting";
  const stopped = ["created", "exited", "dead"].includes(input.containerState);
  const updateReason = input.updateEligibility?.safeReason;
  return { canStart: stopped, canShutdown: running, canStop: running, canRestart: running, canUpdate: (running || stopped) && (input.updateEligibility?.eligible ?? true), ...(updateReason ? { updateReason } : {}) };
}
function none(reason: string): ContainerActionCapabilities { return { canStart: false, canShutdown: false, canStop: false, canRestart: false, canUpdate: false, reason, updateReason: reason }; }
