import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AreaSelectionService } from '../../services/area-selection.service';
import { CoordinateTransformService, ScreenRect } from '../../services/coordinate-transform';
import { CanvasInteractionService } from '../../services/canvas-interaction.service';
import { PageDimensions } from '../../models/document-model';

@Component({
  selector: 'app-selection-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- LIVE MARQUEE SELECTION DRAG RECTANGLE -->
    @if (areaService.marquee(); as m) {
      @if (m.pageIndex === pageIndex()) {
        <div
          class="marquee-selection-rectangle"
          [style.left.px]="getMarqueeScreenRect(m).x"
          [style.top.px]="getMarqueeScreenRect(m).y"
          [style.width.px]="getMarqueeScreenRect(m).width"
          [style.height.px]="getMarqueeScreenRect(m).height">
          <div class="marquee-border-glow"></div>
        </div>
      }
    }

    <!-- ACTIVE AREA SELECTION BOX WITH 8 HANDLES, ROTATE, QUICK ACTIONS, AND GHOST PREVIEW -->
    @if (areaService.selection(); as sel) {
      @if (sel.pageIndex === pageIndex()) {
        <div
          class="active-area-selection-box"
          [class.is-dragging]="isMoving()"
          [style.left.px]="getSelectionScreenRect(sel).x"
          [style.top.px]="getSelectionScreenRect(sel).y"
          [style.width.px]="getSelectionScreenRect(sel).width"
          [style.height.px]="getSelectionScreenRect(sel).height"
          [style.transform]="sel.rotation ? 'rotate(' + sel.rotation + 'deg)' : 'none'"
          (mousedown)="onSelectionBodyMouseDown($event)"
          (touchstart)="onSelectionBodyTouchStart($event)">

          <!-- Optional ghost preview of captured snapshot during drag -->
          @if (sel.snapshotDataUrl && isMoving()) {
            <div class="area-selection-ghost-preview">
              <img [src]="sel.snapshotDataUrl" alt="Selection Ghost" draggable="false" />
            </div>
          }

          <!-- 8 RESIZE HANDLES -->
          <div class="resize-handle handle-nw" (mousedown)="onResizeHandleMouseDown('nw', $event)"></div>
          <div class="resize-handle handle-n" (mousedown)="onResizeHandleMouseDown('n', $event)"></div>
          <div class="resize-handle handle-ne" (mousedown)="onResizeHandleMouseDown('ne', $event)"></div>
          <div class="resize-handle handle-e" (mousedown)="onResizeHandleMouseDown('e', $event)"></div>
          <div class="resize-handle handle-se" (mousedown)="onResizeHandleMouseDown('se', $event)"></div>
          <div class="resize-handle handle-s" (mousedown)="onResizeHandleMouseDown('s', $event)"></div>
          <div class="resize-handle handle-sw" (mousedown)="onResizeHandleMouseDown('sw', $event)"></div>
          <div class="resize-handle handle-w" (mousedown)="onResizeHandleMouseDown('w', $event)"></div>

          <!-- QUICK ACTION: DELETE BUTTON -->
          <button
            type="button"
            class="element-quick-delete-btn"
            (click)="deleteArea.emit(); $event.stopPropagation()"
            (mousedown)="$event.stopPropagation()"
            title="Delete selection (or press Delete key)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>

          <!-- QUICK ACTION: DUPLICATE BUTTON -->
          <button
            type="button"
            class="element-quick-duplicate-btn"
            (click)="duplicateArea.emit(); $event.stopPropagation()"
            (mousedown)="$event.stopPropagation()"
            title="Duplicate area (or press Ctrl+D)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>

          <!-- QUICK ACTION: ROTATE HANDLE -->
          <button
            type="button"
            class="element-quick-rotate-btn"
            (mousedown)="onRotateHandleMouseDown($event)"
            (click)="$event.stopPropagation()"
            title="Drag to rotate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </button>
        </div>
      }
    }
  `,
  styles: [`
    :host {
      display: contents;
    }

    /* Live Marquee Drag Box */
    .marquee-selection-rectangle {
      position: absolute;
      border: 1.5px dashed var(--pt-teal-700, #0d9488);
      background-color: rgba(13, 148, 136, 0.12);
      pointer-events: none;
      z-index: 40;
      box-sizing: border-box;
      animation: marquee-dash 1.2s linear infinite;
    }

    @keyframes marquee-dash {
      to {
        stroke-dashoffset: -16;
      }
    }

    /* Active Selection Box */
    .active-area-selection-box {
      position: absolute;
      border: 1.5px dashed var(--pt-teal-700, #0d9488);
      background-color: rgba(13, 148, 136, 0.06);
      cursor: move;
      z-index: 45;
      box-sizing: border-box;
      user-select: none;
      transition: box-shadow 0.15s ease;
    }

    .active-area-selection-box:hover {
      background-color: rgba(13, 148, 136, 0.1);
      box-shadow: 0 0 0 1px var(--pt-teal-700, #0d9488);
    }

    .active-area-selection-box.is-dragging {
      opacity: 0.85;
      border-style: solid;
      box-shadow: 0 4px 14px rgba(13, 148, 136, 0.25);
    }

    .area-selection-ghost-preview {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.75;
      overflow: hidden;
      display: flex;
    }

    .area-selection-ghost-preview img {
      width: 100%;
      height: 100%;
      object-fit: fill;
      pointer-events: none;
    }

    /* Quick Duplicate Button on Selection */
    .element-quick-duplicate-btn {
      position: absolute;
      top: -28px;
      right: 28px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #ffffff;
      color: var(--pt-teal-700, #0d9488);
      border: 1px solid rgba(13, 148, 136, 0.35);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.15s ease;
      padding: 0;
    }

    .element-quick-duplicate-btn:hover {
      background: var(--pt-teal-700, #0d9488);
      color: #ffffff;
      transform: scale(1.1);
    }
  `]
})
export class SelectionOverlayComponent {
  readonly areaService = inject(AreaSelectionService);
  private readonly transform = inject(CoordinateTransformService);
  private readonly canvasInteraction = inject(CanvasInteractionService);

  readonly pageIndex = input.required<number>();
  readonly page = input.required<PageDimensions>();
  readonly zoom = input.required<number>();

  readonly moveSelection = output<{
    targetPageIndex: number;
    newXPt: number;
    newYPt: number;
  }>();
  readonly deleteArea = output<void>();
  readonly duplicateArea = output<void>();

  readonly isMoving = signal<boolean>(false);
  private moveStart = { screenX: 0, screenY: 0, startXPt: 0, startYPt: 0 };

  private resizingHandle: string | null = null;
  private resizeStartScreen: ScreenRect = { x: 0, y: 0, width: 0, height: 0 };
  private resizeStartMouse = { x: 0, y: 0 };

  private isRotating = false;
  private rotateCenter = { x: 0, y: 0 };

  // -------------------------------------------------------------
  // RECTANGLE SCREEN COORDINATE HELPERS
  // -------------------------------------------------------------

  getMarqueeScreenRect(m: { startScreenX: number; startScreenY: number; currentScreenX: number; currentScreenY: number }): ScreenRect {
    const x = Math.min(m.startScreenX, m.currentScreenX);
    const y = Math.min(m.startScreenY, m.currentScreenY);
    const width = Math.abs(m.currentScreenX - m.startScreenX);
    const height = Math.abs(m.currentScreenY - m.startScreenY);
    return { x, y, width, height };
  }

  getSelectionScreenRect(sel: { xPt: number; yPt: number; widthPt: number; heightPt: number }): ScreenRect {
    return this.transform.pdfRectToScreenRect(
      {
        xPt: sel.xPt,
        yPt: sel.yPt,
        widthPt: sel.widthPt,
        heightPt: sel.heightPt
      },
      this.page(),
      this.zoom()
    );
  }

  // -------------------------------------------------------------
  // MOVE DRAGGING (On selection body)
  // -------------------------------------------------------------

  onSelectionBodyMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const sel = this.areaService.selection();
    if (!sel) return;

    this.isMoving.set(true);
    this.moveStart = {
      screenX: event.clientX,
      screenY: event.clientY,
      startXPt: sel.xPt,
      startYPt: sel.yPt
    };
  }

  onSelectionBodyTouchStart(event: TouchEvent): void {
    if (event.touches.length === 0) return;
    event.stopPropagation();
    const t = event.touches[0];
    const sel = this.areaService.selection();
    if (!sel) return;

    this.isMoving.set(true);
    this.moveStart = {
      screenX: t.clientX,
      screenY: t.clientY,
      startXPt: sel.xPt,
      startYPt: sel.yPt
    };
  }

  // -------------------------------------------------------------
  // RESIZE DRAGGING (On 8 handles)
  // -------------------------------------------------------------

  onResizeHandleMouseDown(handle: string, event: MouseEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const sel = this.areaService.selection();
    if (!sel) return;

    this.resizingHandle = handle;
    this.resizeStartMouse = { x: event.clientX, y: event.clientY };
    this.resizeStartScreen = this.getSelectionScreenRect(sel);
  }

  // -------------------------------------------------------------
  // ROTATE DRAGGING
  // -------------------------------------------------------------

  onRotateHandleMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const sel = this.areaService.selection();
    if (!sel) return;

    const screenRect = this.getSelectionScreenRect(sel);
    const canvas = document.getElementById(`pdf-canvas-${this.pageIndex()}`);
    const canvasRect = canvas?.getBoundingClientRect();

    if (canvasRect) {
      this.rotateCenter = {
        x: canvasRect.left + screenRect.x + screenRect.width / 2,
        y: canvasRect.top + screenRect.y + screenRect.height / 2
      };
      this.isRotating = true;
    }
  }

  // -------------------------------------------------------------
  // GLOBAL WINDOW LISTENERS FOR DRAG / RESIZE / ROTATE
  // -------------------------------------------------------------

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (this.isMoving()) {
      this.handleMoveDrag(event.clientX, event.clientY);
    } else if (this.resizingHandle) {
      this.handleResizeDrag(event.clientX, event.clientY, event.shiftKey);
    } else if (this.isRotating) {
      this.handleRotateDrag(event.clientX, event.clientY);
    }
  }

  @HostListener('window:touchmove', ['$event'])
  onWindowTouchMove(event: TouchEvent): void {
    if (event.touches.length === 0) return;
    const t = event.touches[0];
    if (this.isMoving()) {
      this.handleMoveDrag(t.clientX, t.clientY);
    }
  }

  @HostListener('window:mouseup', ['$event'])
  onWindowMouseUp(event: MouseEvent): void {
    if (this.isMoving()) {
      this.finishMoveDrag(event.clientX, event.clientY);
    }
    this.resizingHandle = null;
    this.isRotating = false;
  }

  @HostListener('window:touchend')
  onWindowTouchEnd(): void {
    if (this.isMoving()) {
      this.isMoving.set(false);
    }
    this.resizingHandle = null;
    this.isRotating = false;
  }

  private handleMoveDrag(clientX: number, clientY: number): void {
    const sel = this.areaService.selection();
    if (!sel) return;

    const dxScreen = clientX - this.moveStart.screenX;
    const dyScreen = clientY - this.moveStart.screenY;

    // Convert screen deltas to PDF point deltas (dxPt = dx / zoom, dyPt = -dy / zoom)
    const newPos = this.canvasInteraction.calculateDragMove(
      dxScreen,
      dyScreen,
      this.zoom(),
      { xPt: this.moveStart.startXPt, yPt: this.moveStart.startYPt }
    );

    // Clamp within current page bounds
    const p = this.page();
    const clampedX = Math.max(0, Math.min(newPos.xPt, p.widthPt - sel.widthPt));
    const clampedY = Math.max(0, Math.min(newPos.yPt, p.heightPt - sel.heightPt));

    this.areaService.selection.set({
      ...sel,
      xPt: clampedX,
      yPt: clampedY
    });
  }

  private finishMoveDrag(clientX: number, clientY: number): void {
    this.isMoving.set(false);
    const sel = this.areaService.selection();
    if (!sel) return;

    // Detect if cursor is over another page
    let targetPageIndex = this.pageIndex();
    const pageContainers = document.querySelectorAll('.paper-canvas-container');
    for (let i = 0; i < pageContainers.length; i++) {
      const rect = pageContainers[i].getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        targetPageIndex = i;
        break;
      }
    }

    this.moveSelection.emit({
      targetPageIndex,
      newXPt: sel.xPt,
      newYPt: sel.yPt
    });
  }

  private handleResizeDrag(clientX: number, clientY: number, preserveAspect: boolean): void {
    const sel = this.areaService.selection();
    if (!sel || !this.resizingHandle) return;

    const dx = clientX - this.resizeStartMouse.x;
    const dy = clientY - this.resizeStartMouse.y;

    const newBounds = this.canvasInteraction.calculateResize(
      this.resizingHandle,
      dx,
      dy,
      this.resizeStartScreen,
      preserveAspect,
      this.page(),
      this.zoom()
    );

    this.areaService.updateSelectionBounds(newBounds);
  }

  private handleRotateDrag(clientX: number, clientY: number): void {
    const sel = this.areaService.selection();
    if (!sel) return;

    const rad = Math.atan2(clientY - this.rotateCenter.y, clientX - this.rotateCenter.x);
    let deg = Math.round((rad * 180) / Math.PI) + 90;
    deg = ((deg % 360) + 360) % 360;

    // Snap to 0, 90, 180, 270 if within 5 degrees
    if (Math.abs(deg - 0) < 5 || Math.abs(deg - 360) < 5) deg = 0;
    else if (Math.abs(deg - 90) < 5) deg = 90;
    else if (Math.abs(deg - 180) < 5) deg = 180;
    else if (Math.abs(deg - 270) < 5) deg = 270;

    this.areaService.updateSelectionBounds({
      xPt: sel.xPt,
      yPt: sel.yPt,
      widthPt: sel.widthPt,
      heightPt: sel.heightPt,
      rotation: deg
    });
  }
}
