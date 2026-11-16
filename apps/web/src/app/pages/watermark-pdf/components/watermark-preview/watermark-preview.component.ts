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

  // Compare state (Hold to compare hides watermark while active)
  readonly isCompareActive = signal<boolean>(false);
  readonly isRenderingPage = signal<boolean>(false);

  private activeRenderTask: any = null;
  private currentPdfPage: any = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private loadedImageElement: HTMLImageElement | null = null;
  private cachedPageMetrics: VisualPageBox | null = null;
  private keydownListener?: (e: KeyboardEvent) => void;

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
      const text = s.textConfig.text || 'CONFIDENTIAL';
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
        WatermarkTextShaper.renderToCanvas(offCtx, textMetrics.shaped, {
          fontSize: p.fontSize || 36,
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
