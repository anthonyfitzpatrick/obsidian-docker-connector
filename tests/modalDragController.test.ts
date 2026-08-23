import { clampModalOffset, isInteractiveDragTarget, ModalDragController } from "../src/ui/ModalDragController";
import { describe, expect, it } from "vitest";

class FakeElement {
  style = { translate: "" } as CSSStyleDeclaration;
  listeners = new Map<string, (event: PointerEvent) => void>();
  classes = new Set<string>();
  captured = new Set<number>();

  constructor(private rect: DOMRect) {}

  addClass(name: string): void { this.classes.add(name); }
  removeClass(name: string): void { this.classes.delete(name); }
  getBoundingClientRect(): DOMRect { return this.rect; }
  addEventListener(type: string, listener: (event: PointerEvent) => void): void { this.listeners.set(type, listener); }
  removeEventListener(type: string): void { this.listeners.delete(type); }
  setPointerCapture(pointerId: number): void { this.captured.add(pointerId); }
  hasPointerCapture(pointerId: number): boolean { return this.captured.has(pointerId); }
  releasePointerCapture(pointerId: number): void { this.captured.delete(pointerId); }
  fire(type: string, event: Partial<PointerEvent>): void { this.listeners.get(type)?.({ isPrimary: true, button: 0, pointerId: 1, clientX: 0, clientY: 0, target: null, preventDefault: () => undefined, ...event } as PointerEvent); }
}

const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom }) as DOMRect;

describe("ModalDragController", () => {
  it("clamps offsets so a modal header remains reachable", () => {
    expect(clampModalOffset({ x: 0, y: 0 }, rect(-40, 40, 560, 440), { width: 800, height: 600 })).toEqual({ x: 64, y: 0 });
    expect(clampModalOffset({ x: 0, y: 0 }, rect(300, 580, 700, 760), { width: 800, height: 600 })).toEqual({ x: 0, y: -184 });
  });

  it("handles down, move, cancellation, interactive exclusions, and cleanup", () => {
    const modal = new FakeElement(rect(100, 100, 700, 600));
    const handle = new FakeElement(rect(100, 100, 700, 150));
    let resizeListener: (() => void) | undefined;
    const controller = new ModalDragController(modal as unknown as HTMLElement, {
      isDesktopFinePointer: () => true,
      viewport: () => ({ width: 800, height: 700 }),
      addResizeListener: (listener) => { resizeListener = listener; },
      removeResizeListener: () => { resizeListener = undefined; }
    });

    controller.attach(handle as unknown as HTMLElement);
    handle.fire("pointerdown", { target: { closest: () => true } as unknown as EventTarget });
    expect(handle.captured.size).toBe(0);
    handle.fire("pointerdown", { clientX: 150, clientY: 150 });
    handle.fire("pointermove", { clientX: 800, clientY: 800 });
    expect(modal.style.translate).toBe("76px 76px");
    expect(modal.classes.has("dc-is-dragging")).toBe(true);
    handle.fire("pointercancel", {});
    expect(handle.captured.size).toBe(0);
    expect(modal.classes.has("dc-is-dragging")).toBe(false);
    handle.fire("pointerdown", { clientX: 150, clientY: 150 });
    handle.fire("pointerup", {});
    expect(handle.captured.size).toBe(0);
    resizeListener?.();
    controller.dispose();
    expect(modal.style.translate).toBe("");
    expect(handle.listeners.size).toBe(0);
    expect(resizeListener).toBeUndefined();
  });

  it("does not attach drag listeners on touch or narrow layouts", () => {
    const modal = new FakeElement(rect(100, 100, 700, 600));
    const handle = new FakeElement(rect(100, 100, 700, 150));
    new ModalDragController(modal as unknown as HTMLElement, {
      isDesktopFinePointer: () => false,
      viewport: () => ({ width: 800, height: 700 }),
      addResizeListener: () => undefined,
      removeResizeListener: () => undefined
    }).attach(handle as unknown as HTMLElement);
    expect(handle.listeners.size).toBe(0);
  });

  it("recognizes only interactive descendants as excluded drag targets", () => {
    expect(isInteractiveDragTarget({ closest: () => null } as unknown as EventTarget)).toBe(false);
    expect(isInteractiveDragTarget({ closest: () => ({}) } as unknown as EventTarget)).toBe(true);
  });
});
