import { clampModalPosition, clampModalSize, centerModalInViewport, fitModalToViewport, FloatingModalController, FLOATING_MODAL_MARGIN, isInteractiveDragTarget } from "../src/ui/ModalDragController";
import { describe, expect, it } from "vitest";

const viewport = { width: 1200, height: 900 };

describe("FloatingModalController geometry", () => {
  it("centers a default modal inside the safe viewport", () => {
    expect(centerModalInViewport({ width: 800, height: 600 }, viewport)).toEqual({ left: 200, top: 150, width: 800, height: 600 });
  });

  it("clamps drag positions to every viewport edge", () => {
    const size = { width: 800, height: 600 };
    expect(clampModalPosition({ left: -100, top: 100 }, size, viewport)).toEqual({ left: FLOATING_MODAL_MARGIN, top: 100 });
    expect(clampModalPosition({ left: 700, top: 100 }, size, viewport)).toEqual({ left: 388, top: 100 });
    expect(clampModalPosition({ left: 200, top: -100 }, size, viewport)).toEqual({ left: 200, top: FLOATING_MODAL_MARGIN });
    expect(clampModalPosition({ left: 200, top: 700 }, size, viewport)).toEqual({ left: 200, top: 288 });
  });

  it("limits native resize attempts to the usable viewport", () => {
    expect(clampModalSize({ width: 1600, height: 1200 }, viewport)).toEqual({ width: 1176, height: 876 });
    expect(clampModalSize({ width: 100, height: 100 }, viewport)).toEqual({ width: 480, height: 360 });
  });

  it("reclamps a resize near the right edge so the footer remains reachable", () => {
    expect(fitModalToViewport({ left: 700, top: 100, width: 800, height: 600 }, viewport)).toEqual({ left: 388, top: 100, width: 800, height: 600 });
  });

  it("fits both position and size when the viewport shrinks", () => {
    expect(fitModalToViewport({ left: 300, top: 250, width: 800, height: 600 }, { width: 640, height: 480 })).toEqual({ left: 12, top: 12, width: 616, height: 456 });
  });

  it("keeps the full header and close-control region within the safe viewport", () => {
    const geometry = fitModalToViewport({ left: -10, top: -20, width: 800, height: 600 }, viewport);
    expect(geometry.left).toBeGreaterThanOrEqual(FLOATING_MODAL_MARGIN);
    expect(geometry.top).toBeGreaterThanOrEqual(FLOATING_MODAL_MARGIN);
    expect(geometry.left + geometry.width).toBeLessThanOrEqual(viewport.width - FLOATING_MODAL_MARGIN);
    expect(geometry.top + geometry.height).toBeLessThanOrEqual(viewport.height - FLOATING_MODAL_MARGIN);
  });

  it("excludes interactive controls from header drag initiation", () => {
    expect(isInteractiveDragTarget({ closest: () => null } as unknown as EventTarget)).toBe(false);
    expect(isInteractiveDragTarget({ closest: () => ({}) } as unknown as EventTarget)).toBe(true);
  });

  it("owns pointer capture, clamps drag and resize geometry, and cleans up locally", () => {
    const modal = fakeElement();
    const handle = fakeElement();
    let viewport = { width: 1200, height: 900 };
    let resizeListener: (() => void) | undefined;
    let observerListener: (() => void) | undefined;
    const controller = new FloatingModalController(modal.element, {
      isDesktopFinePointer: () => true,
      viewport: () => viewport,
      addResizeListener: (listener) => { resizeListener = listener; },
      removeResizeListener: (listener) => { if (resizeListener === listener) resizeListener = undefined; },
      createResizeObserver: (listener) => ({ observe: () => { observerListener = listener; }, disconnect: () => { observerListener = undefined; } })
    });

    controller.attach(handle.element);
    expect(modal.style.left).toBe("240px");
    expect(modal.style.top).toBe("140px");
    expect(handle.listeners.pointerdown).toBeDefined();

    handle.emit("pointerdown", pointerEvent({ clientX: 300, clientY: 200, pointerId: 7 }));
    handle.emit("pointermove", pointerEvent({ clientX: -200, clientY: -200, pointerId: 7 }));
    expect(modal.style.left).toBe("12px");
    expect(modal.style.top).toBe("12px");
    expect(modal.classes).toContain("dc-is-dragging");
    handle.emit("pointercancel", pointerEvent({ pointerId: 7 }));
    expect(modal.classes).not.toContain("dc-is-dragging");
    expect(handle.captured).toEqual([]);

    handle.emit("pointerdown", pointerEvent({ target: { closest: () => ({}) }, pointerId: 9 }));
    expect(handle.captured).toEqual([]);

    viewport = { width: 640, height: 480 };
    resizeListener?.();
    observerListener?.();
    expect(modal.style.left).toBe("12px");
    expect(modal.style.top).toBe("12px");
    expect(modal.style.width).toBe("616px");
    expect(modal.style.height).toBe("456px");

    controller.dispose();
    expect(handle.listeners.pointerdown).toBeUndefined();
    expect(resizeListener).toBeUndefined();
    expect(observerListener).toBeUndefined();
    expect(modal.style.left).toBe("");
    expect(modal.style.width).toBe("");
    expect(modal.classes).not.toContain("dc-floating-modal");
  });

  it("does not attach controller listeners on touch or narrow layouts", () => {
    const modal = fakeElement();
    const handle = fakeElement();
    const controller = new FloatingModalController(modal.element, {
      isDesktopFinePointer: () => false,
      viewport: () => viewport,
      addResizeListener: () => undefined,
      removeResizeListener: () => undefined,
      createResizeObserver: () => ({ observe: () => undefined, disconnect: () => undefined })
    });

    controller.attach(handle.element);
    expect(handle.listeners.pointerdown).toBeUndefined();
    expect(modal.classes).not.toContain("dc-floating-modal");
  });
});

function fakeElement(): { element: HTMLElement; classes: string[]; captured: number[]; listeners: Record<string, (event: PointerEvent) => void>; style: Record<string, string>; emit: (type: string, event: PointerEvent) => void } {
  const classes: string[] = [];
  const captured: number[] = [];
  const listeners: Record<string, (event: PointerEvent) => void> = {};
  const style: Record<string, string> = {};
  const element = {
    style,
    setCssStyles: (values: Record<string, string>) => Object.assign(style, values),
    addClass: (name: string) => { if (!classes.includes(name)) classes.push(name); },
    removeClass: (name: string) => { const index = classes.indexOf(name); if (index >= 0) classes.splice(index, 1); },
    addEventListener: (type: string, listener: (event: PointerEvent) => void) => { listeners[type] = listener; },
    removeEventListener: (type: string) => { delete listeners[type]; },
    setPointerCapture: (pointerId: number) => captured.push(pointerId),
    releasePointerCapture: (pointerId: number) => { const index = captured.indexOf(pointerId); if (index >= 0) captured.splice(index, 1); },
    hasPointerCapture: (pointerId: number) => captured.includes(pointerId),
    getBoundingClientRect: () => ({ left: Number.parseFloat(style.left || "240"), top: Number.parseFloat(style.top || "140"), width: Number.parseFloat(style.width || "720"), height: Number.parseFloat(style.height || "620") })
  } as unknown as HTMLElement;
  return { element, classes, captured, listeners, style, emit: (type, event) => listeners[type]?.(event) };
}

function pointerEvent(overrides: Partial<PointerEvent>): PointerEvent {
  return { isPrimary: true, button: 0, clientX: 0, clientY: 0, pointerId: 1, preventDefault: () => undefined, target: null, ...overrides } as PointerEvent;
}
