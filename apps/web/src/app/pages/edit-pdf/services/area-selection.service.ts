import { Injectable, inject, signal, computed } from '@angular/core';
import {
  AreaSelectionState,
  EditElement,
  ImageEditElement,
  PageDimensions,
  WhiteoutEditElement
} from '../models/document-model';
import { CoordinateTransformService, ScreenRect } from './coordinate-transform';
import { CommandHistoryService, Command } from './command-history';

export interface MarqueeDragState {
  pageIndex: number;
  startScreenX: number;
  startScreenY: number;
  currentScreenX: number;
  currentScreenY: number;
}

export interface AreaDragMoveState {
  startScreenX: number;
  startScreenY: number;
  currentScreenX: number;
  currentScreenY: number;
  targetPageIndex: number;
  deltaXPt: number;
  deltaYPt: number;
}

@Injectable({
  providedIn: 'root'
})
export class AreaSelectionService {
  private readonly transform = inject(CoordinateTransformService);
  private readonly history = inject(CommandHistoryService);

  /** Active area selection on a page (null when nothing is selected) */
  readonly selection = signal<AreaSelectionState | null>(null);

  /** Active marquee dragging state while user is click-dragging to draw selection box */
  readonly marquee = signal<MarqueeDragState | null>(null);

  /** Active drag-to-move state when user is dragging an existing area selection */
  readonly dragMove = signal<AreaDragMoveState | null>(null);

  /** Internal clipboard for Copy / Cut operations */
  readonly clipboard = signal<AreaSelectionState | null>(null);

  /** Computed flag indicating whether an active area selection exists */
  readonly hasSelection = computed(() => this.selection() !== null);

  /** Computed flag indicating whether clipboard has content ready to paste */
  readonly canPaste = computed(() => this.clipboard() !== null);

  // -------------------------------------------------------------
  // MARQUEE SELECTION (Click & Drag on empty page)
  // -------------------------------------------------------------

  /**
   * Start marquee dragging on a page canvas container
   */
  startMarquee(pageIndex: number, screenX: number, screenY: number): void {
    // Clear any existing element or area selection when starting a new marquee
    this.selection.set(null);
    this.marquee.set({
      pageIndex,
      startScreenX: screenX,
      startScreenY: screenY,
      currentScreenX: screenX,
      currentScreenY: screenY
    });
  }

  /**
   * Update marquee dragging coordinates
   */
  updateMarquee(screenX: number, screenY: number): void {
    const current = this.marquee();
    if (!current) return;
    this.marquee.set({
      ...current,
      currentScreenX: screenX,
      currentScreenY: screenY
    });
  }

  /**
   * Complete marquee dragging and capture the selected region as a snapshot
   */
  finishMarquee(
    page: PageDimensions,
    elementsOnPage: EditElement[],
    zoom = 1.0
  ): AreaSelectionState | null {
    const m = this.marquee();
    this.marquee.set(null);
    if (!m) return null;

    const minX = Math.min(m.startScreenX, m.currentScreenX);
    const minY = Math.min(m.startScreenY, m.currentScreenY);
    const width = Math.abs(m.currentScreenX - m.startScreenX);
    const height = Math.abs(m.currentScreenY - m.startScreenY);

    // Minimum size threshold to prevent accidental clicks from creating microscopic selections
    if (width < 6 || height < 6) {
      this.selection.set(null);
      return null;
    }

    // Clamp screen rectangle within page display bounds
    const pageDisplay = this.transform.getPageDisplaySize(page, zoom);
    const clampedX = Math.max(0, Math.min(minX, pageDisplay.width - 2));
    const clampedY = Math.max(0, Math.min(minY, pageDisplay.height - 2));
    const clampedW = Math.min(width, pageDisplay.width - clampedX);
    const clampedH = Math.min(height, pageDisplay.height - clampedY);

    if (clampedW < 4 || clampedH < 4) {
      this.selection.set(null);
      return null;
    }

    // Convert screen pixel rect to PDF coordinates (points, 72 DPI, bottom-left origin)
    const pdfRect = this.transform.screenRectToPdfRect(
      { x: clampedX, y: clampedY, width: clampedW, height: clampedH },
      page,
      zoom
    );

    // Capture crisp high-resolution snapshot from underlying canvas + overlapping annotations
    const snapshot = this.captureSnapshot(m.pageIndex, page, pdfRect, elementsOnPage);

    // Find overlapping annotation element IDs completely inside or heavily overlapping this rect
    const capturedElementIds = elementsOnPage
      .filter(el => {
        // Exclude whiteout elements to prevent re-capturing background whiteouts
        if (el.type === 'whiteout') return false;
        const overlapX = Math.max(0, Math.min(el.xPt + el.widthPt, pdfRect.xPt + pdfRect.widthPt) - Math.max(el.xPt, pdfRect.xPt));
        const overlapY = Math.max(0, Math.min(el.yPt + el.heightPt, pdfRect.yPt + pdfRect.heightPt) - Math.max(el.yPt, pdfRect.yPt));
        const elArea = el.widthPt * el.heightPt;
        const overlapArea = overlapX * overlapY;
        return elArea > 0 && overlapArea / elArea > 0.45;
      })
      .map(el => el.id);

    const newState: AreaSelectionState = {
      pageIndex: m.pageIndex,
      xPt: pdfRect.xPt,
      yPt: pdfRect.yPt,
      widthPt: pdfRect.widthPt,
      heightPt: pdfRect.heightPt,
      rotation: 0,
      snapshotDataUrl: snapshot?.dataUrl || null,
      naturalWidth: snapshot?.naturalWidth,
      naturalHeight: snapshot?.naturalHeight,
      originalXPt: pdfRect.xPt,
      originalYPt: pdfRect.yPt,
      originalPageIndex: m.pageIndex,
      originalWidthPt: pdfRect.widthPt,
      originalHeightPt: pdfRect.heightPt,
      capturedElementIds
    };

    this.selection.set(newState);
    return newState;
  }

  /**
   * Clears the current area selection and any active marquee
   */
  clearSelection(): void {
    this.selection.set(null);
    this.marquee.set(null);
    this.dragMove.set(null);
  }

  // -------------------------------------------------------------
  // HIGH-RESOLUTION CANVAS SNAPSHOT EXTRACTION
  // -------------------------------------------------------------

  /**
   * Captures the pixel snapshot of the selected PDF area at full canvas resolution
   */
  captureSnapshot(
    pageIndex: number,
    page: PageDimensions,
    pdfRect: { xPt: number; yPt: number; widthPt: number; heightPt: number },
    elementsOnPage: EditElement[] = []
  ): { dataUrl: string; naturalWidth: number; naturalHeight: number } | null {
    const canvas = document.getElementById(`pdf-canvas-${pageIndex}`) as HTMLCanvasElement | null;
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return null;
    }

    // Ratio between rendered canvas pixels and PDF points
    const scaleX = canvas.width / page.widthPt;
    const scaleY = canvas.height / page.heightPt;

    // PDF point space origin is bottom-left:
    // Top of rectangle in PDF space is yPt + heightPt.
    // Distance from top of page is: page.heightPt - (yPt + heightPt)
    const topPt = page.heightPt - (pdfRect.yPt + pdfRect.heightPt);

    const sx = Math.max(0, Math.floor(pdfRect.xPt * scaleX));
    const sy = Math.max(0, Math.floor(topPt * scaleY));
    const sw = Math.min(canvas.width - sx, Math.ceil(pdfRect.widthPt * scaleX));
    const sh = Math.min(canvas.height - sy, Math.ceil(pdfRect.heightPt * scaleY));

    if (sw <= 0 || sh <= 0) return null;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base PDF page canvas crop
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    // 2. Render any overlapping annotation elements onto the crop canvas
    // so user selections preserve highlights, stamps, text edits, and shapes
    this.compositeAnnotationsOntoCanvas(ctx, elementsOnPage, pdfRect, scaleX, scaleY);

    try {
      const dataUrl = cropCanvas.toDataURL('image/png');
      return {
        dataUrl,
        naturalWidth: sw,
        naturalHeight: sh
      };
    } catch {
      return null;
    }
  }

  /**
   * Helper to composite overlapping vector/text annotations into the snapshot canvas
   */
  private compositeAnnotationsOntoCanvas(
    ctx: CanvasRenderingContext2D,
    elements: EditElement[],
    selectionRect: { xPt: number; yPt: number; widthPt: number; heightPt: number },
    scaleX: number,
    scaleY: number
  ): void {
    for (const el of elements) {
      if (el.type === 'whiteout') {
        const relX = (el.xPt - selectionRect.xPt) * scaleX;
        const relY = ((selectionRect.yPt + selectionRect.heightPt) - (el.yPt + el.heightPt)) * scaleY;
        const w = el.widthPt * scaleX;
        const h = el.heightPt * scaleY;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(relX, relY, w, h);
      } else if (el.type === 'highlight') {
        const relX = (el.xPt - selectionRect.xPt) * scaleX;
        const relY = ((selectionRect.yPt + selectionRect.heightPt) - (el.yPt + el.heightPt)) * scaleY;
        const w = el.widthPt * scaleX;
        const h = el.heightPt * scaleY;
        ctx.save();
        ctx.globalAlpha = el.opacity ?? 0.35;
        ctx.fillStyle = el.color.startsWith('var(') ? '#fef08a' : el.color;
        ctx.fillRect(relX, relY, w, h);
        ctx.restore();
      }
    }
  }

  // -------------------------------------------------------------
  // OPERATIONS: MOVE, CUT, COPY, PASTE, DELETE, DUPLICATE, NUDGE
  // -------------------------------------------------------------

  /**
   * Copy current area selection to clipboard
   */
  copy(): void {
    const current = this.selection();
    if (!current) return;
    this.clipboard.set({ ...current });
  }

  /**
   * Cut current area selection: copy to clipboard, cover original with whiteout, remove captured elements
   */
  cut(
    elementsSignal: { update(fn: (list: EditElement[]) => EditElement[]): void },
    page: PageDimensions
  ): void {
    const current = this.selection();
    if (!current) return;

    this.clipboard.set({ ...current });
    this.deleteArea(elementsSignal, page);
  }

  /**
   * Delete selected area: covers original area with whiteout and removes captured elements
   */
  deleteArea(
    elementsSignal: { update(fn: (list: EditElement[]) => EditElement[]): void },
    page: PageDimensions
  ): void {
    const current = this.selection();
    if (!current) return;

    const whiteoutEl: WhiteoutEditElement = {
      id: `wo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: current.pageIndex,
      type: 'whiteout',
      xPt: current.xPt,
      yPt: current.yPt,
      widthPt: current.widthPt,
      heightPt: current.heightPt,
      fillColor: 'var(--pt-surface-white)'
    };

    const capturedIds = new Set(current.capturedElementIds || []);

    let removedElements: EditElement[] = [];

    const cmd: Command = {
      description: 'Delete Area Selection',
      execute: () => {
        elementsSignal.update(list => {
          removedElements = list.filter(e => capturedIds.has(e.id));
          const filtered = list.filter(e => !capturedIds.has(e.id));
          return [...filtered, whiteoutEl];
        });
      },
      undo: () => {
        elementsSignal.update(list => {
          const withoutWhiteout = list.filter(e => e.id !== whiteoutEl.id);
          return [...withoutWhiteout, ...removedElements];
        });
      }
    };

    this.history.execute(cmd);
    this.clearSelection();
  }

  /**
   * Paste from clipboard onto the specified target page as a standard ImageEditElement
   */
  paste(
    elementsSignal: { update(fn: (list: EditElement[]) => EditElement[]): void },
    targetPage: PageDimensions,
    onElementSelected?: (id: string) => void
  ): ImageEditElement | null {
    const clip = this.clipboard();
    if (!clip || !clip.snapshotDataUrl) return null;

    // Position offset on page: offset by +20pt, -20pt from original, clamped inside page
    const offsetX = clip.pageIndex === targetPage.pageIndex ? 20 : 0;
    const offsetY = clip.pageIndex === targetPage.pageIndex ? -20 : 0;

    const xPt = Math.max(10, Math.min(clip.xPt + offsetX, targetPage.widthPt - clip.widthPt - 10));
    const yPt = Math.max(10, Math.min(clip.yPt + offsetY, targetPage.heightPt - clip.heightPt - 10));

    const imageEl: ImageEditElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: targetPage.pageIndex,
      type: 'image',
      xPt,
      yPt,
      widthPt: clip.widthPt,
      heightPt: clip.heightPt,
      dataUrl: clip.snapshotDataUrl,
      naturalWidth: clip.naturalWidth || Math.round(clip.widthPt * 2),
      naturalHeight: clip.naturalHeight || Math.round(clip.heightPt * 2),
      rotation: clip.rotation || 0
    };

    const cmd: Command = {
      description: 'Paste Area Selection',
      execute: () => {
        elementsSignal.update(list => [...list, imageEl]);
        if (onElementSelected) onElementSelected(imageEl.id);
      },
      undo: () => {
        elementsSignal.update(list => list.filter(e => e.id !== imageEl.id));
      }
    };

    this.history.execute(cmd);
    this.clearSelection();
    return imageEl;
  }

  /**
   * Duplicate current area selection: creates an offset ImageEditElement copy immediately
   */
  duplicate(
    elementsSignal: { update(fn: (list: EditElement[]) => EditElement[]): void },
    page: PageDimensions,
    onElementSelected?: (id: string) => void
  ): ImageEditElement | null {
    const current = this.selection();
    if (!current || !current.snapshotDataUrl) return null;

    const xPt = Math.max(10, Math.min(current.xPt + 20, page.widthPt - current.widthPt - 10));
    const yPt = Math.max(10, Math.min(current.yPt - 20, page.heightPt - current.heightPt - 10));

    const imageEl: ImageEditElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: current.pageIndex,
      type: 'image',
      xPt,
      yPt,
      widthPt: current.widthPt,
      heightPt: current.heightPt,
      dataUrl: current.snapshotDataUrl,
      naturalWidth: current.naturalWidth || Math.round(current.widthPt * 2),
      naturalHeight: current.naturalHeight || Math.round(current.heightPt * 2),
      rotation: current.rotation || 0
    };

    const cmd: Command = {
      description: 'Duplicate Area Selection',
      execute: () => {
        elementsSignal.update(list => [...list, imageEl]);
        if (onElementSelected) onElementSelected(imageEl.id);
      },
      undo: () => {
        elementsSignal.update(list => list.filter(e => e.id !== imageEl.id));
      }
    };

    this.history.execute(cmd);
    this.clearSelection();
    return imageEl;
  }

  /**
   * Commits dragging movement of an area selection:
   * 1. Creates a WhiteoutEditElement at the original position
   * 2. Removes any captured elements from the original page
   * 3. Creates a new ImageEditElement at the target position
   * 4. Clears area selection and selects the new ImageEditElement
   */
  commitMove(
    elementsSignal: { update(fn: (list: EditElement[]) => EditElement[]): void },
    targetPageIndex: number,
    newXPt: number,
    newYPt: number,
    sourcePage: PageDimensions,
    targetPage: PageDimensions,
    onElementSelected?: (id: string) => void
  ): ImageEditElement | null {
    const current = this.selection();
    if (!current || !current.snapshotDataUrl) return null;

    // If moved by less than 2 points, don't create unnecessary whiteout
    const dist = Math.hypot(newXPt - current.originalXPt, newYPt - current.originalYPt);
    if (dist < 2 && targetPageIndex === current.originalPageIndex) {
      return null;
    }

    const whiteoutEl: WhiteoutEditElement = {
      id: `wo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: current.originalPageIndex,
      type: 'whiteout',
      xPt: current.originalXPt,
      yPt: current.originalYPt,
      widthPt: current.originalWidthPt,
      heightPt: current.originalHeightPt,
      fillColor: 'var(--pt-surface-white)'
    };

    const imageEl: ImageEditElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: targetPageIndex,
      type: 'image',
      xPt: Math.max(0, Math.min(newXPt, targetPage.widthPt - current.widthPt)),
      yPt: Math.max(0, Math.min(newYPt, targetPage.heightPt - current.heightPt)),
      widthPt: current.widthPt,
      heightPt: current.heightPt,
      dataUrl: current.snapshotDataUrl,
      naturalWidth: current.naturalWidth || Math.round(current.widthPt * 2),
      naturalHeight: current.naturalHeight || Math.round(current.heightPt * 2),
      rotation: current.rotation || 0
    };

    const capturedIds = new Set(current.capturedElementIds || []);
    let removedElements: EditElement[] = [];

    const cmd: Command = {
      description: 'Move Area Selection',
      execute: () => {
        elementsSignal.update(list => {
          removedElements = list.filter(e => capturedIds.has(e.id));
          const filtered = list.filter(e => !capturedIds.has(e.id));
          return [...filtered, whiteoutEl, imageEl];
        });
        if (onElementSelected) onElementSelected(imageEl.id);
      },
      undo: () => {
        elementsSignal.update(list => {
          const filtered = list.filter(e => e.id !== whiteoutEl.id && e.id !== imageEl.id);
          return [...filtered, ...removedElements];
        });
      }
    };

    this.history.execute(cmd);
    this.clearSelection();
    return imageEl;
  }

  /**
   * Nudge area selection position by delta points (clamped to page bounds)
   */
  nudge(dxPt: number, dyPt: number, page: PageDimensions): void {
    const current = this.selection();
    if (!current) return;

    const newX = Math.max(0, Math.min(current.xPt + dxPt, page.widthPt - current.widthPt));
    const newY = Math.max(0, Math.min(current.yPt + dyPt, page.heightPt - current.heightPt));

    this.selection.set({
      ...current,
      xPt: newX,
      yPt: newY
    });
  }

  /**
   * Update active selection dimensions & rotation (e.g. from resize handles)
   */
  updateSelectionBounds(bounds: { xPt: number; yPt: number; widthPt: number; heightPt: number; rotation?: number }): void {
    const current = this.selection();
    if (!current) return;
    this.selection.set({
      ...current,
      xPt: bounds.xPt,
      yPt: bounds.yPt,
      widthPt: bounds.widthPt,
      heightPt: bounds.heightPt,
      rotation: bounds.rotation !== undefined ? bounds.rotation : current.rotation
    });
  }
}
