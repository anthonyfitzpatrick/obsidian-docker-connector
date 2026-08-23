/** Ensures plugin-load and layout-ready hooks cannot run two startup refreshes. */
export class StartupRefreshCoordinator {
  private completed = false;
  private running?: Promise<unknown>;

  run<T>(refresh: () => Promise<T>): Promise<T> | undefined {
    if (this.completed || this.running) return undefined;
    const task = refresh();
    this.running = task;
    void task.then(() => { this.completed = true; }, () => undefined).finally(() => {
      if (this.running === task) this.running = undefined;
    });
    return task;
  }
}
