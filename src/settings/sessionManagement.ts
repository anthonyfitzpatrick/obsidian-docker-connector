/** Container mutation authority is deliberately session-only. */
export function withSessionSafeContainerManagement<T extends { containerManagementEnabled: boolean }>(settings: T): T {
  return { ...settings, containerManagementEnabled: false };
}
