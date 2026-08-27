const INTERACTIVE_SELECTOR = "button, input, select, textarea, a, summary, label, [role='button'], .modal-close-button";
export const FLOATING_MODAL_MARGIN = 12;
export const FLOATING_MODAL_MINIMUM = { width: 480, height: 360 };
export const FLOATING_MODAL_DEFAULT = { width: 720, height: 620 };

export type ModalViewport = { width: number; height: number };
export type ModalSize = { width: number; height: number };
export type ModalGeometry = ModalSize & { left: number; top: number };

type FloatingEnvironment = {
  isDesktopFinePointer: () => boolean;
  viewport: () => ModalViewport;
  addResizeListener: (listener: () => void) => void;
  removeResizeListener: (listener: () => void) => void;
  createResizeObserver: (listener: () => void) => { observe: (element: HTMLElement) => void; disconnect: () => void };
};

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
const available = (length: number): number => Math.max(0, length - FLOATING_MODAL_MARGIN * 2);

export function clampModalSize(size: ModalSize, viewport: ModalViewport): ModalSize {
  const maximumWidth = available(viewport.width);
  const maximumHeight = available(viewport.height);
  return {
    width: clamp(size.width, Math.min(FLOATING_MODAL_MINIMUM.width, maximumWidth), maximumWidth),
    height: clamp(size.height, Math.min(FLOATING_MODAL_MINIMUM.height, maximumHeight), maximumHeight)
  };
}

export function clampModalPosition(position: Pick<ModalGeometry, "left" | "top">, size: ModalSize, viewport: ModalViewport): Pick<ModalGeometry, "left" | "top"> {
  return {
    left: clamp(position.left, FLOATING_MODAL_MARGIN, viewport.width - size.width - FLOATING_MODAL_MARGIN),
    top: clamp(position.top, FLOATING_MODAL_MARGIN, viewport.height - size.height - FLOATING_MODAL_MARGIN)
  };
}

export function fitModalToViewport(geometry: ModalGeometry, viewport: ModalViewport): ModalGeometry {
  const size = clampModalSize(geometry, viewport);
  return { ...size, ...clampModalPosition(geometry, size, viewport) };
}

export function centerModalInViewport(size: ModalSize, viewport: ModalViewport): ModalGeometry {
  const fittedSize = clampModalSize(size, viewport);
  return fitModalToViewport({ ...fittedSize, left: (viewport.width - fittedSize.width) / 2, top: (viewport.height - fittedSize.height) / 2 }, viewport);
}

export function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return Boolean(target && typeof (target as Element).closest === "function" && (target as Element).closest(INTERACTIVE_SELECTOR));
}

/** Owns a desktop modal's fixed geometry so dragging and native resizing share one viewport-bound model. */
export class FloatingModalController {
  private geometry?: ModalGeometry;
  private detachHandle?: () => void;
  private resizeObserver?: ReturnType<FloatingEnvironment["createResizeObserver"]>;
  private active?: { pointerId: number; startX: number; startY: number; geometry: ModalGeometry };

  constructor(private readonly modalEl: HTMLElement, private readonly environment: FloatingEnvironment = browserEnvironment()) {}

  attach(handleEl: HTMLElement): void {
    this.detachHandle?.();
    if (!this.environment.isDesktopFinePointer()) return;
    this.initialize();

    const end = (event: PointerEvent): void => {
      if (!this.active || event.pointerId !== this.active.pointerId) return;
      if (handleEl.hasPointerCapture(event.pointerId)) handleEl.releasePointerCapture(event.pointerId);
      this.active = undefined;
      this.modalEl.removeClass("dc-is-dragging");
    };
    const move = (event: PointerEvent): void => {
      if (!this.active || event.pointerId !== this.active.pointerId) return;
      const geometry = this.active.geometry;
      const position = clampModalPosition({ left: geometry.left + event.clientX - this.active.startX, top: geometry.top + event.clientY - this.active.startY }, geometry, this.environment.viewport());
      this.geometry = { ...geometry, ...position };
      this.applyGeometry();
    };
    const down = (event: PointerEvent): void => {
      if (!event.isPrimary || event.button !== 0 || isInteractiveDragTarget(event.target)) return;
      this.normalize();
      if (!this.geometry) return;
      this.active = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, geometry: { ...this.geometry } };
      handleEl.setPointerCapture(event.pointerId);
      this.modalEl.addClass("dc-is-dragging");
      event.preventDefault();
    };
    handleEl.addEventListener("pointerdown", down);
    handleEl.addEventListener("pointermove", move);
    handleEl.addEventListener("pointerup", end);
    handleEl.addEventListener("pointercancel", end);
    this.detachHandle = () => {
      if (this.active && handleEl.hasPointerCapture(this.active.pointerId)) handleEl.releasePointerCapture(this.active.pointerId);
      this.active = undefined;
      this.modalEl.removeClass("dc-is-dragging");
      handleEl.removeEventListener("pointerdown", down);
      handleEl.removeEventListener("pointermove", move);
      handleEl.removeEventListener("pointerup", end);
      handleEl.removeEventListener("pointercancel", end);
    };
  }

  dispose(): void {
    this.detachHandle?.();
    this.detachHandle = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.environment.removeResizeListener(this.normalize);
    this.geometry = undefined;
    // Removing the class reverts the fixed positioning it declares; only the
    // measured geometry has to be cleared explicitly.
    this.modalEl.removeClass("dc-floating-modal");
    this.modalEl.setCssStyles({ left: "", top: "", width: "", height: "", minWidth: "", minHeight: "", maxWidth: "", maxHeight: "" });
  }

  private initialize(): void {
    if (this.geometry) return;
    // The class carries the fixed positioning; only measured values are set here.
    this.modalEl.addClass("dc-floating-modal");
    this.geometry = centerModalInViewport(FLOATING_MODAL_DEFAULT, this.environment.viewport());
    this.applyGeometry();
    this.resizeObserver = this.environment.createResizeObserver(this.normalize);
    this.resizeObserver.observe(this.modalEl);
    this.environment.addResizeListener(this.normalize);
  }

  private normalize = (): void => {
    if (!this.geometry) return;
    const rect = this.modalEl.getBoundingClientRect();
    this.geometry = fitModalToViewport({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, this.environment.viewport());
    this.applyGeometry();
  };

  private applyGeometry(): void {
    if (!this.geometry) return;
    const viewport = this.environment.viewport();
    const maximum = { width: available(viewport.width), height: available(viewport.height) };
    const minimum = { width: Math.min(FLOATING_MODAL_MINIMUM.width, maximum.width), height: Math.min(FLOATING_MODAL_MINIMUM.height, maximum.height) };
    const geometry = fitModalToViewport(this.geometry, viewport);
    this.geometry = geometry;
    this.modalEl.setCssStyles({
      left: `${geometry.left}px`,
      top: `${geometry.top}px`,
      width: `${geometry.width}px`,
      height: `${geometry.height}px`,
      minWidth: `${minimum.width}px`,
      minHeight: `${minimum.height}px`,
      maxWidth: `${maximum.width}px`,
      maxHeight: `${maximum.height}px`
    });
  }
}

function browserEnvironment(): FloatingEnvironment {
  return {
    isDesktopFinePointer: () => window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 621px)").matches,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    addResizeListener: (listener) => window.addEventListener("resize", listener),
    removeResizeListener: (listener) => window.removeEventListener("resize", listener),
    createResizeObserver: (listener) => new ResizeObserver(listener)
  };
}
