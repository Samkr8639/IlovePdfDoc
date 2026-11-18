/**
 * Watermark Preview Component
 * Live pdf.js multi-page canvas renderer with continuous smooth vertical scrolling,
 * sub-100ms watermark overlay updates, uniform opacity compositing (parity with
 * PDF transparency groups), Over/Below layer stack, and "Hold to compare".
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
  inject,
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
  private hostEl = inject(ElementRef);
  private layoutService = inject(WatermarkLayoutService);

  @ViewChild('pageCanvas', { static: false }) pageCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('watermarkCanvas', { static: false }) watermarkCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewViewport', { static: false }) previewViewportRef?: ElementRef<HTMLDivElement>;

  readonly pdfDocProxy = input<any>(null);
  readonly settings = input.required<WatermarkFileSettings>();
  readonly currentPage = input<number>(1);
  readonly totalPages = input<number>(1);
  readonly zoom = input<number>(1.0);
  readonly isPageIncluded = input<boolean>(true);
  readonly includedPages = input<number[]>([]);
  readonly fontkitFont = input<any>(null);

  @Output() pageChange = new EventEmitter<number>();
  @Output() zoomChange = new EventEmitter<number>();
  @Output() positionChange = new EventEmitter<{ customXPercent: number; customYPercent: number; rotation: number }>();
  @Output() sizeChange = new EventEmitter<{ fontSize?: number; widthPercent?: number }>();

  // Compare state (Hold to compare hides watermark while active)
  readonly isCompareActiveInput = input<boolean>(false, { alias: 'isCompareActive' });
  private internalCompareActive = signal<boolean>(false);
  readonly isCompareActive = computed(() => this.isCompareActiveInput() || this.internalCompareActive());
  readonly isRenderingPage = signal<boolean>(false);

  private activeRenderTasks = new Map<number, any>();
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private loadedImageElement: HTMLImageElement | null = null;
  private cachedPageMetricsMap = new Map<number, VisualPageBox>();
  private keydownListener?: (e: KeyboardEvent) => void;
  private tokenService = new WatermarkTokenService();

  // Scrolling state
  private isScrollTicking = false;
  private isUserScrollingToPage = false;

  // Interactive Drag, Rotate & Resize State
  isDragging = false;
  isRotating = false;
  isResizing = false;
  private resizeStartDist = 0;
  private resizeStartFontSize = 36;
  private resizeStartWidthPercent = 40;
  private dragPointerId = -1;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;
  private activeHandle: 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l' | null = null;
  private currentSinglePlacement: WatermarkPlacement | null = null;
  private guideSnaps = { showCenterX: false, showCenterY: false };
  private activePointerPageNum = 1;

  // Pages array for continuous vertical scroll
  readonly pagesList = computed(() =>
    Array.from({ length: Math.max(1, this.totalPages()) }, (_, i) => i + 1)
  );

  constructor() {
    effect(() => {
      this.pdfDocProxy();
      this.totalPages();
      this.zoom();
      untracked(() => {
        this.renderPdfPages();
      });
    });

    effect(() => {
      this.settings();
      this.currentPage();
      this.isPageIncluded();
      this.includedPages();
      this.fontkitFont();
      untracked(() => {
        this.drawWatermarkOverlay();
      });
    });
  }

  // Computed accessible aria-label describing current page & watermark
  readonly previewAriaLabel = computed(() => {
    return this.getPageAriaLabel(this.currentPage());
  });

  getPageAriaLabel(pageNum: number): string {
    const s = this.settings();
    const isText = s.common.activeTab === 'text';
    const content = isText
      ? `'${s.textConfig.text || 'CONFIDENTIAL'}'`
      : 'image stamp';
    const rot = s.common.rotation ?? 45;
    const pos = s.common.position ?? 'center';
    const includedStr = this.checkIsPageIncluded(pageNum) ? '' : ' (Not included)';
    return `Page ${pageNum} of ${this.totalPages()}, watermark ${content}, ${rot} degrees, ${pos}${includedStr}`;
  }

  checkIsPageIncluded(pageNum: number): boolean {
    const inc = this.includedPages();
    if (inc && inc.length > 0) {
      return inc.includes(pageNum);
    }
    return this.isPageIncluded();
  }

  ngOnInit(): void {
    // Component initialization
  }

  ngOnDestroy(): void {
    this.cancelActiveRenderTasks();
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
    }
    this.offscreenCanvas = null;
    this.loadedImageElement = null;
    this.cachedPageMetricsMap.clear();
  }

  private cancelActiveRenderTasks(): void {
    for (const [, task] of this.activeRenderTasks.entries()) {
      try {
        task.cancel();
      } catch {}
    }
    this.activeRenderTasks.clear();
  }

  /**
   * Backward-compatibility wrapper for single-page render calls and tests.
   */
  async renderPdfPage(): Promise<void> {
    await this.renderPdfPages();
  }

  /**
   * Renders the underlying PDF pages using pdf.js into their corresponding canvases.
   */
  async renderPdfPages(): Promise<void> {
    const doc = this.pdfDocProxy();
    const total = this.totalPages();
    const currentZoom = this.zoom();

    if (!doc || total < 1) {
      return;
    }

    this.cancelActiveRenderTasks();
    this.cachedPageMetricsMap.clear();
    this.isRenderingPage.set(true);

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    try {
      for (let p = 1; p <= total; p++) {
        if (this.pdfDocProxy() !== doc) break; // Terminated/switched document
        const pdfPage = await doc.getPage(p);

        // Extract box metrics
        const crop = pdfPage.view || [0, 0, 612, 792];
        const rot = pdfPage.rotate || 0;
        const userUnit = pdfPage.userUnit || 1.0;

        const metrics = this.layoutService.computeVisualPageBox(
          crop,
          pdfPage.mediaBox || crop,
          rot,
          userUnit,
          p - 1
        );
        this.cachedPageMetricsMap.set(p, metrics);

        const viewport = pdfPage.getViewport({ scale: currentZoom * dpr });

        const pageCanvas = this.getPageCanvas(p);
        const wmCanvas = this.getWatermarkCanvas(p);

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
            const renderContext = {
              canvasContext: ctx,
              viewport,
              background: 'rgba(0,0,0,0)'
            };

            const task = pdfPage.render(renderContext);
            this.activeRenderTasks.set(p, task);
            try {
              await task.promise;
            } catch (err: any) {
              if (err?.name !== 'RenderingCancelledException') {
                console.error(`pdf.js render error for page ${p}:`, err);
              }
            } finally {
              this.activeRenderTasks.delete(p);
            }
          }
        }

        // Immediately draw watermark on this page
        this.drawWatermarkOnPage(p);
      }
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('pdf.js render error:', err);
      }
    } finally {
      this.isRenderingPage.set(false);
    }
  }

  private getPageCanvas(pageNum: number): HTMLCanvasElement | null {
    return this.hostEl.nativeElement.querySelector(`#pdf-canvas-${pageNum}`) ||
      (pageNum === 1 ? this.pageCanvasRef?.nativeElement : null);
  }

  private getWatermarkCanvas(pageNum: number): HTMLCanvasElement | null {
    return this.hostEl.nativeElement.querySelector(`#wm-canvas-${pageNum}`) ||
      (pageNum === 1 ? this.watermarkCanvasRef?.nativeElement : null);
  }

  /**
   * Fast redraw of all watermark overlay canvases (< 100ms) without re-rendering pdf.js.
   */
  drawWatermarkOverlay(): void {
    const total = this.totalPages();
    for (let p = 1; p <= total; p++) {
      this.drawWatermarkOnPage(p);
    }
  }

  /**
   * Fast draw of watermark on a single page overlay canvas.
   */
  private drawWatermarkOnPage(pageNum: number): void {
    const wmCanvas = this.getWatermarkCanvas(pageNum);
    const metrics = this.cachedPageMetricsMap.get(pageNum);
    if (!wmCanvas || !metrics) return;

    const ctx = wmCanvas.getContext('2d');
    if (!ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);

    // If page is excluded, do not paint watermark
    if (!this.checkIsPageIncluded(pageNum)) {
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
        pageNumber: pageNum,
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
        fontFamily: s.textConfig.fontFamily,
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
      metrics,
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
      const canvasX = p.centerX * scale;
      const canvasY = (metrics.visualHeight - p.centerY) * scale;

      offCtx.translate(canvasX, canvasY);
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
              fontFamily: s.textConfig.fontFamily,
              fontkitFont: this.fontkitFont()
            });

        WatermarkTextShaper.renderToCanvas(offCtx, shapedForPlacement, {
          fontSize: resolvedSize,
          bold: s.textConfig.bold,
          italic: s.textConfig.italic,
          underline: s.textConfig.underline,
          colorHex: s.textConfig.color,
          strokeColorHex: s.textConfig.strokeColor,
          strokeWidthPt: s.textConfig.strokeWidth,
          fontFamily: s.textConfig.fontFamily,
          fontkitFont: this.fontkitFont()
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

    // Render interactive selection outline & rotate knob on CURRENT active page
    if (pageNum === this.currentPage()) {
      if (!s.common.mosaic && layout.placements.length === 1) {
        this.currentSinglePlacement = layout.placements[0];
        this.drawInteractiveHandles(ctx, this.currentSinglePlacement, scale, metrics);
      } else {
        this.currentSinglePlacement = null;
      }
    }
  }

  private drawInteractiveHandles(
    ctx: CanvasRenderingContext2D,
    p: WatermarkPlacement,
    scale: number,
    metrics: VisualPageBox
  ): void {
    const canvasX = p.centerX * scale;
    const canvasY = (metrics.visualHeight - p.centerY) * scale;
    const rotRad = (-p.rotation * Math.PI) / 180;

    // Center guide snaps
    if (this.guideSnaps.showCenterX) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#0F766E';
      ctx.lineWidth = 1.5;
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
      ctx.lineWidth = 1.5;
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

    // 1. Bounding box dashed outline
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(-halfW, -halfH, p.width * scale, p.height * scale);

    // 2. Rotate stem line
    const knobY = -halfH - 24;
    ctx.setLineDash([]);
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, knobY);
    ctx.stroke();

    // 3. Rotate knob handle (circular)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, knobY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner knob dot
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(0, knobY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. 4 Corner resize handles (10x10 px squares)
    const cornerSize = 10;
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ];
    for (const c of corners) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.fillRect(c.x - cornerSize / 2, c.y - cornerSize / 2, cornerSize, cornerSize);
      ctx.strokeRect(c.x - cornerSize / 2, c.y - cornerSize / 2, cornerSize, cornerSize);
      ctx.restore();
    }

    // 5. 4 Edge resize handles (8x8 px squares)
    const edgeSize = 8;
    const edges = [
      { x: 0, y: -halfH },
      { x: halfW, y: 0 },
      { x: 0, y: halfH },
      { x: -halfW, y: 0 }
    ];
    for (const ed of edges) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.5;
      ctx.fillRect(ed.x - edgeSize / 2, ed.y - edgeSize / 2, edgeSize, edgeSize);
      ctx.strokeRect(ed.x - edgeSize / 2, ed.y - edgeSize / 2, edgeSize, edgeSize);
      ctx.restore();
    }

    ctx.restore();
  }

  // Pointer Drag, Rotate & Resize Handlers
  onCanvasPointerDown(e: PointerEvent, pageNum: number): void {
    if (this.isCompareActive()) return;
    this.activePointerPageNum = pageNum;
    if (this.currentPage() !== pageNum) {
      this.pageChange.emit(pageNum);
    }

    const metrics = this.cachedPageMetricsMap.get(pageNum);
    if (!this.currentSinglePlacement || !metrics) return;

    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const scale = this.zoom() * dpr;

    const p = this.currentSinglePlacement;
    const cx = p.centerX * scale;
    const cy = (metrics.visualHeight - p.centerY) * scale;
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
    const knobY = -halfH - 24;

    // 1. Check rotate knob hit (within 18px radius)
    if (Math.hypot(localX, localY - knobY) <= 18) {
      this.isRotating = true;
      this.dragPointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // 2. Check 4 corner resize handles hit (within 16px radius)
    const corners: { type: 'tl' | 'tr' | 'br' | 'bl'; x: number; y: number }[] = [
      { type: 'tl', x: -halfW, y: -halfH },
      { type: 'tr', x: halfW, y: -halfH },
      { type: 'br', x: halfW, y: halfH },
      { type: 'bl', x: -halfW, y: halfH }
    ];
    for (const c of corners) {
      if (Math.hypot(localX - c.x, localY - c.y) <= 16) {
        this.isResizing = true;
        this.activeHandle = c.type;
        this.dragPointerId = e.pointerId;
        this.resizeStartDist = Math.max(10, Math.hypot(localX, localY));
        const fsVal = this.settings().textConfig.fontSize;
        const currentFs = typeof fsVal === 'number' ? fsVal : 36;
        this.resizeStartFontSize = currentFs;
        this.resizeStartWidthPercent = this.settings().imageConfig.widthPercent;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 3. Check 4 edge resize handles hit (within 14px radius)
    const edges: { type: 't' | 'r' | 'b' | 'l'; x: number; y: number }[] = [
      { type: 't', x: 0, y: -halfH },
      { type: 'r', x: halfW, y: 0 },
      { type: 'b', x: 0, y: halfH },
      { type: 'l', x: -halfW, y: 0 }
    ];
    for (const ed of edges) {
      if (Math.hypot(localX - ed.x, localY - ed.y) <= 14) {
        this.isResizing = true;
        this.activeHandle = ed.type;
        this.dragPointerId = e.pointerId;
        this.resizeStartDist = Math.max(10, Math.hypot(localX, localY));
        const fsVal = this.settings().textConfig.fontSize;
        const currentFs = typeof fsVal === 'number' ? fsVal : 36;
        this.resizeStartFontSize = currentFs;
        this.resizeStartWidthPercent = this.settings().imageConfig.widthPercent;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 4. Check inside bounding box hit (drag to position anywhere with offset)
    if (Math.abs(localX) <= halfW + 10 && Math.abs(localY) <= halfH + 10) {
      this.isDragging = true;
      this.dragPointerId = e.pointerId;
      this.dragStartOffsetX = clickX - cx;
      this.dragStartOffsetY = clickY - cy;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // 5. Click anywhere on page canvas to jump & drag watermark to that position
    this.isDragging = true;
    this.dragPointerId = e.pointerId;
    this.dragStartOffsetX = 0;
    this.dragStartOffsetY = 0;
    canvas.setPointerCapture(e.pointerId);
    this.updateDragPosition(clickX, clickY, scale, metrics);
  }

  onCanvasPointerMove(e: PointerEvent, pageNum: number): void {
    const metrics = this.cachedPageMetricsMap.get(pageNum);
    if (!metrics) return;
    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ptrX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const ptrY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const scale = this.zoom() * dpr;
    const p = this.currentSinglePlacement;
    if (!p) return;

    const cx = p.centerX * scale;
    const cy = (metrics.visualHeight - p.centerY) * scale;
    const rotRad = (-p.rotation * Math.PI) / 180;

    const dx = ptrX - cx;
    const dy = ptrY - cy;
    const cos = Math.cos(-rotRad);
    const sin = Math.sin(-rotRad);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const halfW = (p.width * scale) / 2;
    const halfH = (p.height * scale) / 2;
    const knobY = -halfH - 24;

    // Hover cursor feedback when idle
    if (!this.isDragging && !this.isRotating && !this.isResizing) {
      const isKnob = Math.hypot(localX, localY - knobY) <= 18;
      const isTL = Math.hypot(localX - (-halfW), localY - (-halfH)) <= 16;
      const isBR = Math.hypot(localX - halfW, localY - halfH) <= 16;
      const isTR = Math.hypot(localX - halfW, localY - (-halfH)) <= 16;
      const isBL = Math.hypot(localX - (-halfW), localY - halfH) <= 16;
      const isT = Math.hypot(localX, localY - (-halfH)) <= 14;
      const isB = Math.hypot(localX, localY - halfH) <= 14;
      const isR = Math.hypot(localX - halfW, localY) <= 14;
      const isL = Math.hypot(localX - (-halfW), localY) <= 14;
      const isBox = Math.abs(localX) <= halfW + 10 && Math.abs(localY) <= halfH + 10;

      if (isKnob) {
        canvas.style.cursor = 'grab';
      } else if (isTL || isBR) {
        canvas.style.cursor = 'nwse-resize';
      } else if (isTR || isBL) {
        canvas.style.cursor = 'nesw-resize';
      } else if (isT || isB) {
        canvas.style.cursor = 'ns-resize';
      } else if (isR || isL) {
        canvas.style.cursor = 'ew-resize';
      } else if (isBox) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }

    if (this.isResizing) {
      canvas.style.cursor = 'nwse-resize';
      const currentDist = Math.max(5, Math.hypot(localX, localY));
      const ratio = currentDist / (this.resizeStartDist || 1);
      if (this.settings().common.activeTab === 'text') {
        const newSize = Math.max(6, Math.min(300, Math.round(this.resizeStartFontSize * ratio)));
        this.sizeChange.emit({ fontSize: newSize });
      } else {
        const newPct = Math.max(5, Math.min(100, Math.round(this.resizeStartWidthPercent * ratio)));
        this.sizeChange.emit({ widthPercent: newPct });
      }
      return;
    }

    if (this.isRotating) {
      canvas.style.cursor = 'grabbing';
      const angleRad = Math.atan2(ptrY - cy, ptrX - cx);
      let deg = Math.round((-angleRad * 180) / Math.PI) - 90;
      deg = ((deg + 180) % 360 + 360) % 360 - 180;

      // Magnetic snap to standard angles within 4 degrees
      const snapAngles = [0, 45, 90, 180, -90, -45, -180];
      for (const snap of snapAngles) {
        if (Math.abs(deg - snap) <= 4) {
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
      canvas.style.cursor = 'grabbing';
      const targetCx = ptrX - this.dragStartOffsetX;
      const targetCy = ptrY - this.dragStartOffsetY;
      this.updateDragPosition(targetCx, targetCy, scale, metrics);
    }
  }

  private updateDragPosition(targetCx: number, targetCy: number, scale: number, metrics: VisualPageBox): void {
    const pageW = metrics.visualWidth * scale;
    const pageH = metrics.visualHeight * scale;

    let xPct = Math.round((targetCx / pageW) * 100);
    let yPct = Math.round(((pageH - targetCy) / pageH) * 100);

    // Clamped strictly to 0..100
    xPct = Math.max(0, Math.min(100, xPct));
    yPct = Math.max(0, Math.min(100, yPct));

    // Magnetic center snapping (within 2%)
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

  onCanvasPointerUp(e: PointerEvent): void {
    if (this.isDragging || this.isRotating || this.isResizing) {
      this.isDragging = false;
      this.isRotating = false;
      this.isResizing = false;
      this.activeHandle = null;
      this.guideSnaps.showCenterX = false;
      this.guideSnaps.showCenterY = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      const canvas = e.target as HTMLElement;
      if (canvas) {
        canvas.style.cursor = 'default';
      }
      this.drawWatermarkOverlay();
    }
  }

  // Multi-Page Continuous Viewport Scroll Handler
  onViewportScroll(): void {
    if (this.isUserScrollingToPage || this.isScrollTicking) return;
    this.isScrollTicking = true;

    requestAnimationFrame(() => {
      this.isScrollTicking = false;
      if (this.isUserScrollingToPage) return;

      const vp = this.previewViewportRef?.nativeElement;
      if (!vp) return;

      const vpRect = vp.getBoundingClientRect();
      const vpCenterY = vpRect.top + vpRect.height / 2;

      let closestPage = 1;
      let minDistance = Infinity;

      for (let p = 1; p <= this.totalPages(); p++) {
        const pageEl = this.hostEl.nativeElement.querySelector(`#watermark-page-${p}`);
        if (!pageEl) continue;

        const pageRect = pageEl.getBoundingClientRect();
        const pageCenterY = pageRect.top + pageRect.height / 2;
        const dist = Math.abs(pageCenterY - vpCenterY);

        if (dist < minDistance) {
          minDistance = dist;
          closestPage = p;
        }
      }

      if (closestPage !== this.currentPage()) {
        this.pageChange.emit(closestPage);
      }
    });
  }

  scrollToPage(pageNum: number): void {
    if (pageNum < 1 || pageNum > this.totalPages()) return;
    const pageEl = this.hostEl.nativeElement.querySelector(`#watermark-page-${pageNum}`);
    if (pageEl && typeof pageEl.scrollIntoView === 'function') {
      this.isUserScrollingToPage = true;
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        this.isUserScrollingToPage = false;
      }, 500);
    }
  }

  onPageClick(pageNum: number): void {
    if (this.currentPage() !== pageNum) {
      this.pageChange.emit(pageNum);
    }
  }

  // Navigation handlers
  goToPrevPage(): void {
    if (this.currentPage() > 1) {
      const target = this.currentPage() - 1;
      this.scrollToPage(target);
      this.pageChange.emit(target);
    }
  }

  goToNextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      const target = this.currentPage() + 1;
      this.scrollToPage(target);
      this.pageChange.emit(target);
    }
  }

  setPageNumber(page: number): void {
    const clamped = Math.max(1, Math.min(this.totalPages(), page));
    if (clamped !== this.currentPage()) {
      this.scrollToPage(clamped);
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

  computeFitZoom(): number {
    const viewport = this.previewViewportRef?.nativeElement;
    const metrics = this.cachedPageMetricsMap.get(this.currentPage()) || this.cachedPageMetricsMap.get(1);
    if (!viewport || !metrics || !metrics.visualWidth || metrics.visualWidth <= 0) {
      return 1.0;
    }
    const availableWidth = viewport.clientWidth - 48; // 24px stage padding on each side
    if (availableWidth <= 0) return 1.0;
    const targetZoom = availableWidth / metrics.visualWidth;
    return Math.max(0.5, Math.min(2.0, Math.round(targetZoom * 100) / 100));
  }

  fitToWidth(): void {
    const fit = this.computeFitZoom();
    this.zoomChange.emit(fit);
  }

  // Hold to compare handlers (Supports local test execution)
  onCompareHoldStart(): void {
    this.internalCompareActive.set(true);
  }

  onCompareHoldEnd(): void {
    this.internalCompareActive.set(false);
  }

  toggleCompare(): void {
    this.internalCompareActive.update(v => !v);
  }

  private isInputElement(target: any): boolean {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }
}
