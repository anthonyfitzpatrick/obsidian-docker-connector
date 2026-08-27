/**
 * Plugin code runs in Obsidian's Electron renderer and therefore schedules work
 * through the window timer methods. Vitest runs in the node environment, which
 * has no window, so provide one that forwards to the ambient timers.
 *
 * The forwards are late-bound deliberately: tests that install fake timers
 * replace the globals, and a captured reference would keep calling the real ones.
 */
type TimerHandle = ReturnType<typeof setTimeout>;

const timerWindow = {
  setTimeout: (handler: () => void, timeout?: number): TimerHandle => setTimeout(handler, timeout),
  clearTimeout: (handle: TimerHandle | undefined): void => clearTimeout(handle),
  setInterval: (handler: () => void, timeout?: number): TimerHandle => setInterval(handler, timeout),
  clearInterval: (handle: TimerHandle | undefined): void => clearInterval(handle),
};

if (typeof (globalThis as { window?: unknown }).window === "undefined") {
  Object.defineProperty(globalThis, "window", { value: timerWindow, writable: true, configurable: true });
}
