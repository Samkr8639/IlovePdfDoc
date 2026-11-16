/**
 * Watermark Preview Component
 * Live pdf.js canvas renderer with sub-100ms watermark overlay updates,
 * uniform opacity compositing (parity with PDF transparency groups),
 * Over/Below layer stack, and "Hold to compare".
 */

import {
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  effect,
  input,
  signal,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  WatermarkFileSettings,
  WatermarkGridPosition,
  WatermarkLayer
} from '@paperflow/contracts';
import { WatermarkLayoutService } from '../../../../core/services/watermark-pdf/watermark-layout.service';
import { WatermarkTextShaper } from '../../../../core/services/watermark-pdf/watermark-text-shaper';
import { WatermarkTokenService } from '../../../../core/services/watermark-pdf/watermark-token.service';
import { VisualPageBox, WatermarkPlacement } from '../../../../core/services/watermark-pdf/watermark-document-model';

@Component({
  selector: 'app-watermark-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './watermark-preview.component.html',
  styleUrl: './watermark-preview.component.css'
})
export class WatermarkPreviewComponent implements OnInit, OnDestroy {
  @ViewChild('pageCanvas', { static: false }) pageCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('watermarkCanvas', { static: false }) watermarkCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewViewport', { static: false }) previewViewportRef?: ElementRef<HTMLDivElement>;

  readonly pdfDocProxy = input<any>(null);
  readonly settings = input.required<WatermarkFileSettings>();
  readonly currentPage = input<number>(1);
  readonly totalPages = input<number>(1);
  readonly zoom = input<number>(1.0);
  readonly isPageIncluded = input<boolean>(true);
  readonly fontkitFont = input<any>(null);

  @Output() pageChange = new EventEmitter<number>();
  @Output() zoomChange = new EventEmitter<number>();
  @Output() positionChange = new EventEmitter<{ customXPercent: number; customYPercent: number; rotation: number }>();
  @Output() sizeChange = new EventEmitter<{ fontSize?: number; widthPercent?: number }>();

  // Compare state (Hold to compare hides watermark while active)
  readonly isCompareActive = signal<boolean>(false);
  readonly isRenderingPage = signal<boolean>(false);

  private activeRenderTask: any = null;
  private currentPdfPage: any = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private loadedImageElement: HTMLImageElement | null = null;
  private cachedPageMetrics: VisualPageBox | null = null;
  private keydownListener?: (e: KeyboardEvent) => void;
  private tokenService = new WatermarkTokenService();

  // Interactive Drag, Rotate & Resize State
  isDragging = false;
  isRotating = false;
  isResizing = false;
  private resizeStartDist = 0;
  private resizeStartFontSize = 36;
  private resizeStartWidthPercent = 40;
  private dragPointerId = -1;
  private currentSinglePlacement: WatermarkPlacement | null = null;
  private guideSnaps = { showCenterX: false, showCenterY: false };

  constructor(private layoutService: WatermarkLayoutService) {
    effect(() => {
      this.pdfDocProxy();
      this.currentPage();
      this.zoom();
      untracked(() => {
        this.renderPdfPage();
      });
    });

    effect(() => {
      this.settings();
      this.isPageIncluded();
      this.fontkitFont();
      untracked(() => {
        this.drawWatermarkOverlay();
      });
    });
  }

  // Computed accessible aria-label describing current page & watermark
  readonly previewAriaLabel = computed(() => {
    const s = this.settings();
    const isText = s.common.activeTab === 'text';
    const content = isText
      ? `'${s.textConfig.text || 'CONFIDENTIAL'}'`
      : 'image stamp';
    const rot = s.common.rotation ?? 45;
    const pos = s.common.position ?? 'center';
    const includedStr = this.isPageIncluded() ? '' : ' (Not included)';
    return `Page ${this.currentPage()} of ${this.totalPages()}, watermark ${content}, ${rot} degrees, ${pos}${includedStr}`;
  });

  ngOnInit(): void {
    // Keyboard shortcut 'C' for toggle compare
    this.keydownListener = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && !this.isInputElement(e.target)) {
        e.preventDefault();
        this.toggleCompare();
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  ngOnDestroy(): void {
    if (this.activeRenderTask) {
      try {
        this.activeRenderTask.cancel();
      } catch {}
    }
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
    }
    this.offscreenCanvas = null;
    this.loadedImageElement = null;
  }

  /**
   * Renders the underlying PDF page using pdf.js.
   */
  async renderPdfPage(): Promise<void> {
    const doc = this.pdfDocProxy();
    const pageNum = this.currentPage();
    const total = this.totalPages();
    const currentZoom = this.zoom();

    if (!doc || pageNum < 1 || pageNum > total) {
      return;
    }

    if (this.activeRenderTask) {
      try {
        this.activeRenderTask.cancel();
      } catch {}
      this.activeRenderTask = null;
    }

    this.isRenderingPage.set(true);

    try {
      this.currentPdfPage = await doc.getPage(pageNum);
      const page = this.currentPdfPage;

      // Extract box metrics
      const crop = page.view || [0, 0, 612, 792];
      const rot = page.rotate || 0;
      const userUnit = page.userUnit || 1.0;

      this.cachedPageMetrics = this.layoutService.computeVisualPageBox(
        crop,
        page.mediaBox || crop,
        rot,
        userUnit,
        pageNum - 1
      );

      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      const viewport = page.getViewport({ scale: currentZoom * dpr });

      const pageCanvas = this.pageCanvasRef?.nativeElement;
      const wmCanvas = this.watermarkCanvasRef?.nativeElement;

      if (pageCanvas && wmCanvas) {
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        pageCanvas.style.width = `${viewport.width / dpr}px`;
        pageCanvas.style.height = `${viewport.height / dpr}px`;

        wmCanvas.width = viewport.width;
        wmCanvas.height = viewport.height;
        wmCanvas.style.width = `${viewport.width / dpr}px`;
        wmCanvas.style.height = `${viewport.height / dpr}px`;

        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          // Render page with transparent background so Below layer works accurately!
          const renderContext = {
            canvasContext: ctx,
            viewport,
            background: 'rgba(0,0,0,0)'
          };

          this.activeRenderTask = page.render(renderContext);
          await this.activeRenderTask.promise;
        }
      }

      this.drawWatermarkOverlay();
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('pdf.js render error:', err);
      }
    } finally {
      this.isRenderingPage.set(false);
      this.activeRenderTask = null;
    }
  }

  /**
   * Fast redraw of the watermark overlay canvas (< 100ms) without re-rendering pdf.js.
   */
  drawWatermarkOverlay(): void {
    const wmCanvas = this.watermarkCanvasRef?.nativeElement;
    if (!wmCanvas || !this.cachedPageMetrics) return;

    const ctx = wmCanvas.getContext('2d');
    if (!ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);

    // If page is excluded or compare is active, do not paint watermark
    if (!this.isPageIncluded() || this.isCompareActive()) {
      return;
    }

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const scale = this.zoom() * dpr;

    // Sizing and shaping
    const s = this.settings();
    const isText = s.common.activeTab === 'text';
    let textMetrics: any = null;
    let imageMetrics: any = null;

    if (isText) {
      const rawText = s.textConfig.text || 'CONFIDENTIAL';
      const text = this.tokenService.evaluate(rawText, {
        pageNumber: this.currentPage(),
        totalPages: this.totalPages(),
        filename: 'Document'
      });
      const shaped = WatermarkTextShaper.shapeText(text, {
        fontSize: typeof s.textConfig.fontSize === 'number' ? s.textConfig.fontSize : 36,
        bold: s.textConfig.bold,
        italic: s.textConfig.italic,
        underline: s.textConfig.underline,
        colorHex: s.textConfig.color,
        strokeColorHex: s.textConfig.strokeColor,
        strokeWidthPt: s.textConfig.strokeWidth,
        fontkitFont: this.fontkitFont()
      });

      textMetrics = {
        unitWidth: shaped.unitWidth,
        unitHeight: shaped.unitHeight,
        unscaledWidth: shaped.maxWidth,
        unscaledHeight: shaped.totalHeight,
        shaped
      };
    } else if (s.imageConfig.imageDataUrl) {
      if (!this.loadedImageElement || this.loadedImageElement.src !== s.imageConfig.imageDataUrl) {
        this.loadedImageElement = new Image();
        this.loadedImageElement.onload = () => this.drawWatermarkOverlay();
        this.loadedImageElement.src = s.imageConfig.imageDataUrl;
      }
      imageMetrics = {
        widthPt: s.imageConfig.imageWidthPx * 0.75,
        heightPt: s.imageConfig.imageHeightPx * 0.75
      };
    }

    const layout = this.layoutService.resolvePageLayout(
      this.cachedPageMetrics,
      s,
      true,
      textMetrics,
      imageMetrics
    );

    if (layout.placements.length === 0) return;

    // Opacity parity: Draw entire stamp at full opacity on offscreen canvas,
    // then composite once with globalAlpha = opacity to replicate PDF transparency groups!
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    this.offscreenCanvas.width = wmCanvas.width;
    this.offscreenCanvas.height = wmCanvas.height;
    const offCtx = this.offscreenCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

    // Draw all placements onto offscreen canvas
    for (const p of layout.placements) {
      offCtx.save();
      // Visual page coordinate (vx, vy): origin bottom-left -> Canvas origin top-left
      const canvasX = p.centerX * scale;
      const canvasY = (this.cachedPageMetrics.visualHeight - p.centerY) * scale;

      offCtx.translate(canvasX, canvasY);
      // Canvas rotation: positive is clockwise
      offCtx.rotate((-p.rotation * Math.PI) / 180);
      offCtx.scale(scale, scale);

      if (isText && textMetrics?.shaped) {
        const resolvedSize = p.fontSize || 36;
        const shapedForPlacement = (textMetrics.shaped.fontSize === resolvedSize)
          ? textMetrics.shaped
          : WatermarkTextShaper.shapeText(textMetrics.shaped.text, {
              fontSize: resolvedSize,
              bold: s.textConfig.bold,
              italic: s.textConfig.italic,
              underline: s.textConfig.underline,
              colorHex: s.textConfig.color,
              strokeColorHex: s.textConfig.strokeColor,
              strokeWidthPt: s.textConfig.strokeWidth,
              fontkitFont: this.fontkitFont()
            });

        WatermarkTextShaper.renderToCanvas(offCtx, shapedForPlacement, {
          fontSize: resolvedSize,
          bold: s.textConfig.bold,
          italic: s.textConfig.italic,
          underline: s.textConfig.underline,
          colorHex: s.textConfig.color,
          strokeColorHex: s.textConfig.strokeColor,
          strokeWidthPt: s.textConfig.strokeWidth
        });
      } else if (this.loadedImageElement && this.loadedImageElement.complete) {
        offCtx.drawImage(
          this.loadedImageElement,
          -p.width / 2,
          -p.height / 2,
          p.width,
          p.height
        );
      }

      offCtx.restore();
    }

    // Composite offscreen canvas ONCE with globalAlpha
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1.0, s.common.opacity / 100));
    ctx.drawImage(this.offscreenCanvas, 0, 0);
    ctx.restore();

    // Render interactive selection outline & rotate knob if single watermark
    if (!s.common.mosaic && layout.placements.length === 1) {
      this.currentSinglePlacement = layout.placements[0];
      this.drawInteractiveHandles(ctx, this.currentSinglePlacement, scale);
    } else {
      this.currentSinglePlacement = null;
    }
  }

  private drawInteractiveHandles(ctx: CanvasRenderingContext2D, p: WatermarkPlacement, scale: number): void {
    if (!this.cachedPageMetrics) return;
    const canvasX = p.centerX * scale;
    const canvasY = (this.cachedPageMetrics.visualHeight - p.centerY) * scale;
    const rotRad = (-p.rotation * Math.PI) / 180;

    // Center guide snaps
    if (this.guideSnaps.showCenterX) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#0F766E';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvasX, 0);
      ctx.lineTo(canvasX, ctx.canvas.height);
      ctx.stroke();
      ctx.restore();
    }
    if (this.guideSnaps.showCenterY) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#0F766E';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvasY);
      ctx.lineTo(ctx.canvas.width, canvasY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(canvasX, canvasY);
    ctx.rotate(rotRad);

    const halfW = (p.width * scale) / 2;
    const halfH = (p.height * scale) / 2;

    // Bounding box dashed outline
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(-halfW, -halfH, p.width * scale, p.height * scale);

    // 4 Corner resize handles
    const handleSize = 8;
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ];
    ctx.setLineDash([]);
    for (const c of corners) {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.5;
      ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
    }

    // Rotate stem line
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, -halfH - 20);
    ctx.stroke();

    // Rotate knob handle
    const knobY = -halfH - 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, knobY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Pointer Drag & Rotate Handlers
  onCanvasPointerDown(e: PointerEvent): void {
    if (!this.currentSinglePlacement || !this.cachedPageMetrics) return;

    const canvas = this.watermarkCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const scale = this.zoom() * dpr;

    const p = this.currentSinglePlacement;
    const cx = p.centerX * scale;
    const cy = (this.cachedPageMetrics.visualHeight - p.centerY) * scale;
    const rotRad = (-p.rotation * Math.PI) / 180;

    // Check pointer relative to watermark center
    const dx = clickX - cx;
    const dy = clickY - cy;

    // Unrotate point back to local axis
    const cos = Math.cos(-rotRad);
    const sin = Math.sin(-rotRad);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const halfW = (p.width * scale) / 2;
    const halfH = (p.height * scale) / 2;
    const knobY = -halfH - 20;

    // Check rotate knob hit (within 14px)
    if (Math.hypot(localX, localY - knobY) <= 14) {
      this.isRotating = true;
      this.dragPointerId = e.pointerId;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Check 4 corner resize handles hit (within 12px)
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ];
    for (const c of corners) {
      if (Math.hypot(localX - c.x, localY - c.y) <= 12) {
        this.isResizing = true;
        this.dragPointerId = e.pointerId;
        this.resizeStartDist = Math.max(10, Math.hypot(localX, localY));
        const fsVal = this.settings().textConfig.fontSize;
        const currentFs = typeof fsVal === 'number' ? fsVal : 36;
        this.resizeStartFontSize = currentFs;
        this.resizeStartWidthPercent = this.settings().imageConfig.widthPercent;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    // Check bounding box hit
    if (Math.abs(localX) <= halfW + 10 && Math.abs(localY) <= halfH + 10) {
      this.isDragging = true;
      this.dragPointerId = e.pointerId;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  onCanvasPointerMove(e: PointerEvent): void {
    if (!this.cachedPageMetrics) return;
    const canvas = this.watermarkCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ptrX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const ptrY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const scale = this.zoom() * dpr;
    const p = this.currentSinglePlacement;
    if (!p) return;

    const cx = p.centerX * scale;
    const cy = (this.cachedPageMetrics.visualHeight - p.centerY) * scale;
    const rotRad = (-p.rotation * Math.PI) / 180;

    const dx = ptrX - cx;
    const dy = ptrY - cy;
    const cos = Math.cos(-rotRad);
    const sin = Math.sin(-rotRad);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const halfW = (p.width * scale) / 2;
    const halfH = (p.height * scale) / 2;
    const knobY = -halfH - 20;

    // Dynamic cursor feedback when hovering
    if (!this.isDragging && !this.isRotating && !this.isResizing) {
      const corners = [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH }
      ];
      const isKnobHover = Math.hypot(localX, localY - knobY) <= 14;
      const isCornerHover = corners.some(c => Math.hypot(localX - c.x, localY - c.y) <= 12);
      const isBoxHover = Math.abs(localX) <= halfW + 10 && Math.abs(localY) <= halfH + 10;

      if (isKnobHover) {
        canvas.style.cursor = 'grab';
      } else if (isCornerHover) {
        canvas.style.cursor = 'nwse-resize';
      } else if (isBoxHover) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    }

    if (this.isResizing) {
      const currentDist = Math.hypot(localX, localY);
      const ratio = currentDist / (this.resizeStartDist || 1);
      if (this.settings().common.activeTab === 'text') {
        const newSize = Math.max(8, Math.min(200, Math.round(this.resizeStartFontSize * ratio)));
        this.sizeChange.emit({ fontSize: newSize });
      } else {
        const newPct = Math.max(5, Math.min(100, Math.round(this.resizeStartWidthPercent * ratio)));
        this.sizeChange.emit({ widthPercent: newPct });
      }
      return;
    }

    if (this.isRotating) {
      const angleRad = Math.atan2(ptrY - cy, ptrX - cx);
      // Canvas angle: 0 is right, Math.PI/2 is down
      let deg = Math.round((-angleRad * 180) / Math.PI) - 90;
      deg = ((deg + 180) % 360 + 360) % 360 - 180;

      // Magnetic snap to standard angles (0, 45, 90, 180, 270/-90) within 3 degrees
      const snapAngles = [0, 45, 90, 180, -90, -45, -180];
      for (const snap of snapAngles) {
        if (Math.abs(deg - snap) <= 3) {
          deg = snap;
          break;
        }
      }

      this.positionChange.emit({
        customXPercent: this.settings().common.customXPercent,
        customYPercent: this.settings().common.customYPercent,
        rotation: deg
      });
      return;
    }

    if (this.isDragging) {
      const pageW = this.cachedPageMetrics.visualWidth * scale;
      const pageH = this.cachedPageMetrics.visualHeight * scale;

      let xPct = Math.round((ptrX / pageW) * 100);
      let yPct = Math.round(((pageH - ptrY) / pageH) * 100);

      // Clamp 0 to 100
      xPct = Math.max(0, Math.min(100, xPct));
      yPct = Math.max(0, Math.min(100, yPct));

      // Magnetic snapping to 50% center
      this.guideSnaps.showCenterX = Math.abs(xPct - 50) <= 2;
      if (this.guideSnaps.showCenterX) xPct = 50;

      this.guideSnaps.showCenterY = Math.abs(yPct - 50) <= 2;
      if (this.guideSnaps.showCenterY) yPct = 50;

      this.positionChange.emit({
        customXPercent: xPct,
        customYPercent: yPct,
        rotation: this.settings().common.rotation
      });
    }
  }

  onCanvasPointerUp(e: PointerEvent): void {
    if (this.isDragging || this.isRotating || this.isResizing) {
      this.isDragging = false;
      this.isRotating = false;
      this.isResizing = false;
      this.guideSnaps.showCenterX = false;
      this.guideSnaps.showCenterY = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      this.drawWatermarkOverlay();
    }
  }

  // Navigation handlers
  goToPrevPage(): void {
    if (this.currentPage() > 1) {
      this.pageChange.emit(this.currentPage() - 1);
    }
  }

  goToNextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.pageChange.emit(this.currentPage() + 1);
    }
  }

  setPageNumber(page: number): void {
    const clamped = Math.max(1, Math.min(this.totalPages(), page));
    if (clamped !== this.currentPage()) {
      this.pageChange.emit(clamped);
    }
  }

  // Zoom handlers
  zoomIn(): void {
    const next = Math.min(3.0, Number((this.zoom() + 0.25).toFixed(2)));
    this.zoomChange.emit(next);
  }

  zoomOut(): void {
    const next = Math.max(0.5, Number((this.zoom() - 0.25).toFixed(2)));
    this.zoomChange.emit(next);
  }

  resetZoom(): void {
    this.zoomChange.emit(1.0);
  }

  // Hold to compare handlers
  onCompareHoldStart(): void {
    this.isCompareActive.set(true);
    this.drawWatermarkOverlay();
  }

  onCompareHoldEnd(): void {
    this.isCompareActive.set(false);
    this.drawWatermarkOverlay();
  }

  toggleCompare(): void {
    this.isCompareActive.update(v => !v);
    this.drawWatermarkOverlay();
  }

  private isInputElement(target: any): boolean {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }
}
