/** Ensures plugin-load and layout-ready hooks cannot run two startup refreshes. */
export class StartupRefreshCoordinator {
  private started = false;

  run<T>(refresh: () => Promise<T>): Promise<T> | undefined {
    if (this.started) return undefined;
    this.started = true;
    return refresh();
  }
}
