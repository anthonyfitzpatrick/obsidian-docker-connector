const INTERACTIVE_SELECTOR = "button, input, select, textarea, a, summary, label, [role='button'], .modal-close-button";
const VIEWPORT_MARGIN = 24;

type Viewport = { width: number; height: number };
type DragEnvironment = {
  isDesktopFinePointer: () => boolean;
  viewport: () => Viewport;
  addResizeListener: (listener: () => void) => void;
  removeResizeListener: (listener: () => void) => void;
};

export function clampModalOffset(offset: { x: number; y: number }, rect: DOMRect, viewport: Viewport): { x: number; y: number } {
  return {
    x: offset.x + Math.min(Math.max(0, VIEWPORT_MARGIN - rect.left), viewport.width - VIEWPORT_MARGIN - rect.right),
    y: offset.y + Math.min(Math.max(0, VIEWPORT_MARGIN - rect.top), viewport.height - VIEWPORT_MARGIN - rect.bottom)
  };
}

export function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return Boolean(target && typeof (target as Element).closest === "function" && (target as Element).closest(INTERACTIVE_SELECTOR));
}

/** Keeps desktop dialog movement local to its header without changing Obsidian's modal lifecycle. */
export class ModalDragController {
  private offset = { x: 0, y: 0 };
  private detachHandle?: () => void;
  private active?: { pointerId: number; startX: number; startY: number; rect: DOMRect; offset: { x: number; y: number } };

  constructor(private readonly modalEl: HTMLElement, private readonly environment: DragEnvironment = browserEnvironment()) {}

  attach(handleEl: HTMLElement): void {
    this.detachHandle?.();
    if (!this.environment.isDesktopFinePointer()) return;

    const end = (event: PointerEvent): void => {
      if (!this.active || event.pointerId !== this.active.pointerId) return;
      if (handleEl.hasPointerCapture(event.pointerId)) handleEl.releasePointerCapture(event.pointerId);
      this.active = undefined;
      this.modalEl.removeClass("dc-is-dragging");
    };
    const move = (event: PointerEvent): void => {
      if (!this.active || event.pointerId !== this.active.pointerId) return;
      const deltaX = event.clientX - this.active.startX;
      const deltaY = event.clientY - this.active.startY;
      const viewport = this.environment.viewport();
      const minX = VIEWPORT_MARGIN - this.active.rect.left;
      const maxX = viewport.width - VIEWPORT_MARGIN - this.active.rect.right;
      const minY = VIEWPORT_MARGIN - this.active.rect.top;
      const maxY = viewport.height - VIEWPORT_MARGIN - this.active.rect.bottom;
      this.offset = {
        x: this.active.offset.x + Math.min(Math.max(deltaX, minX), maxX),
        y: this.active.offset.y + Math.min(Math.max(deltaY, minY), maxY)
      };
      this.applyOffset();
    };
    const down = (event: PointerEvent): void => {
      if (!event.isPrimary || event.button !== 0 || isInteractiveDragTarget(event.target)) return;
      this.active = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, rect: this.modalEl.getBoundingClientRect(), offset: { ...this.offset } };
      handleEl.setPointerCapture(event.pointerId);
      this.modalEl.addClass("dc-is-dragging");
      event.preventDefault();
    };
    const resize = (): void => {
      this.offset = clampModalOffset(this.offset, this.modalEl.getBoundingClientRect(), this.environment.viewport());
      this.applyOffset();
    };
    handleEl.addEventListener("pointerdown", down);
    handleEl.addEventListener("pointermove", move);
    handleEl.addEventListener("pointerup", end);
    handleEl.addEventListener("pointercancel", end);
    this.environment.addResizeListener(resize);
    this.detachHandle = () => {
      if (this.active && handleEl.hasPointerCapture(this.active.pointerId)) handleEl.releasePointerCapture(this.active.pointerId);
      this.active = undefined;
      this.modalEl.removeClass("dc-is-dragging");
      handleEl.removeEventListener("pointerdown", down);
      handleEl.removeEventListener("pointermove", move);
      handleEl.removeEventListener("pointerup", end);
      handleEl.removeEventListener("pointercancel", end);
      this.environment.removeResizeListener(resize);
    };
  }

  dispose(): void {
    this.detachHandle?.();
    this.detachHandle = undefined;
    this.offset = { x: 0, y: 0 };
    this.modalEl.style.translate = "";
  }

  private applyOffset(): void { this.modalEl.style.translate = `${this.offset.x}px ${this.offset.y}px`; }
}

function browserEnvironment(): DragEnvironment {
  return {
    isDesktopFinePointer: () => window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 621px)").matches,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    addResizeListener: (listener) => window.addEventListener("resize", listener),
    removeResizeListener: (listener) => window.removeEventListener("resize", listener)
  };
}
