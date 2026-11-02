import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ElementRef,
  ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  EDIT_PDF_FEATURES,
  EditPdfFeatureConfig,
  EditPdfOcrMode,
  SUPPORTED_OCR_LANGUAGES,
  TessdataLanguage,
  EditPdfOcrResult,
  EditPdfOcrLine
} from '@paperflow/contracts';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { UploadConsentService } from '../../core/services/upload-consent.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { BrowserPdfService, ValidatedPdfFile } from '../../core/services/browser-pdf.service';
import {
  EditToolType,
  PageDimensions,
  EditElement,
  TextEditElement,
  ShapeEditElement,
  HighlightEditElement,
  WhiteoutEditElement,
  DrawEditElement,
  ImageEditElement,
  SignEditElement,
  LinkEditElement,
  OcrTextLayerElement,
  LowConfidenceWord
} from './models/document-model';
import { CoordinateTransformService } from './services/coordinate-transform';
import { CommandHistoryService, Command } from './services/command-history';
import { PdfExportService } from './services/pdf-export.service';
import { OcrService } from './services/ocr.service';
import { ContentEditableModelDirective } from './directives/content-editable-model.directive';

type EditorViewMode = 'upload' | 'editor';

if (typeof window !== 'undefined' && pdfjsLib && (pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

@Component({
  selector: 'app-edit-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DropzoneComponent,
    ContentEditableModelDirective
  ],
  templateUrl: './edit-pdf.component.html',
  styleUrl: './edit-pdf.component.css'
})
export class EditPdfComponent implements OnInit, OnDestroy {
  private uploadConsent = inject(UploadConsentService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);
  private browserPdf = inject(BrowserPdfService);
  private transform = inject(CoordinateTransformService);
  readonly history = inject(CommandHistoryService);
  private exportService = inject(PdfExportService);
  private ocrService = inject(OcrService);

  private _pageCanvasRef?: ElementRef<HTMLCanvasElement>;

  @ViewChild('pageCanvas') set pageCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this._pageCanvasRef = ref;
    if (ref) {
      setTimeout(() => this.renderCurrentPageToCanvas(), 0);
    }
  }

  get pageCanvasRef(): ElementRef<HTMLCanvasElement> | undefined {
    return this._pageCanvasRef;
  }

  @ViewChild('fileInputImage') fileInputImage!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputAddMore') fileInputAddMore!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasViewport') canvasViewportRef?: ElementRef<HTMLElement>;

  readonly activeDrawingPageIndex = signal<number>(0);
  private isUserScrollingToPage = false;
  private isPageSwitching = false;
  private wheelAccumulator = 0;
  private wheelResetTimer: any = null;
  @ViewChild('fileInputSigUpload') fileInputSigUpload!: ElementRef<HTMLInputElement>;

  private _sigPadRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sigPad') set sigPad(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this._sigPadRef = ref;
  }
  get sigPadRef(): ElementRef<HTMLCanvasElement> | undefined {
    return this._sigPadRef;
  }

  // Document state
  readonly viewMode = signal<EditorViewMode>('upload');
  readonly currentPdfBytes = signal<Uint8Array | null>(null);
  readonly currentFileName = signal<string>('document.pdf');
  readonly pages = signal<PageDimensions[]>([]);
  readonly currentPageIndex = signal<number>(0);
  readonly zoom = signal<number>(1.0);
  readonly elements = signal<EditElement[]>([]);
  readonly selectedElementId = signal<string | null>(null);
  readonly pageThumbnails = signal<Map<number, string>>(new Map());

  // Cached PDF.js document proxy for high-performance canvas page rendering
  private cachedPdfDoc: any = null;
  private currentRenderTask: any = null;

  // Workspace Mode (Annotate vs In-Place Edit)
  readonly editorMode = signal<'annotate' | 'edit'>('annotate');
  readonly isExtractingPageText = signal<boolean>(false);

  // Tools & Selection
  readonly features = EDIT_PDF_FEATURES;
  readonly browserTools = computed(() => this.features.filter(f => f.category === 'tools'));
  readonly cloudTools = computed(() => this.features.filter(f => f.category === 'cloud_tools'));
  readonly activeTool = signal<EditToolType>('select');

  // Text Properties
  readonly textFont = signal<string>('Inter');
  readonly textSize = signal<number>(15);
  readonly textColor = signal<string>('var(--pt-navy)');
  readonly isTextBold = signal<boolean>(false);
  readonly isTextItalic = signal<boolean>(false);
  readonly isTextUnderline = signal<boolean>(false);
  readonly textAlign = signal<'left' | 'center' | 'right'>('left');
  readonly textCustomColor = signal<string>('#14213D');

  // Shape Properties
  readonly shapeType = signal<'rectangle' | 'circle' | 'line' | 'arrow' | 'star'>('rectangle');
  readonly strokeColor = signal<string>('var(--pt-navy)');
  readonly fillColor = signal<string>('transparent');
  readonly strokeWidth = signal<number>(2);

  // Draw Properties
  readonly drawStrokeWidth = signal<number>(2);
  readonly drawColor = signal<string>('var(--pt-teal-700)');
  readonly isDrawingActive = signal<boolean>(false);
  readonly activeDrawingPath = signal<string>('');
  private currentDrawingScreenPoints: Array<{ x: number; y: number }> = [];

  // Highlight Properties
  readonly highlightColor = signal<string>('var(--pt-amber)');
  readonly highlightOpacity = signal<number>(0.35);

  // Signature Studio Properties
  readonly signatureTab = signal<'type' | 'draw' | 'upload'>('type');
  readonly signatureText = signal<string>('John Doe');
  readonly signatureFont = signal<string>("'Dancing Script', cursive");
  readonly signatureColor = signal<string>('var(--pt-navy)');
  readonly signatureSize = signal<number>(26);
  readonly signatureCustomColor = signal<string>('#14213D');
  readonly signatureDrawnDataUrl = signal<string | null>(null);
  private isSigPadDrawing = false;
  private sigPadPoints: Array<{ x: number; y: number }> = [];

  // Link Properties
  readonly linkUrl = signal<string>('https://');

  // Cloud OCR Properties
  readonly ocrPageRange = signal<'current' | 'all' | 'custom'>('current');
  readonly ocrCustomRange = signal<string>('1');
  readonly ocrRangeError = signal<string | null>(null);
  readonly ocrSelectedLanguages = signal<string[]>(['eng']);
  readonly ocrAvailableLanguages = signal<readonly TessdataLanguage[]>(SUPPORTED_OCR_LANGUAGES);
  readonly ocrDeskew = signal<boolean>(true);
  readonly ocrMode = signal<EditPdfOcrMode>('searchable');
  readonly isOcrRunning = signal<boolean>(false);
  readonly ocrProgress = signal<number>(0);
  readonly ocrStatusText = signal<string>('');
  readonly ocrSummaryToast = signal<{
    pagesCount: number;
    linesCount: number;
    avgConfidence: number;
    language: string;
    warnings: string[];
  } | null>(null);
  readonly lowConfidenceReviewWords = signal<LowConfidenceWord[]>([]);

  // UI state
  readonly isLeftSidebarCollapsed = signal<boolean>(false);
  readonly isSidePanelOpenMobile = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isExporting = signal<boolean>(false);

  // Freehand drawing state
  private isDrawing = false;
  private currentDrawingPoints: Array<{ xPt: number; yPt: number }> = [];

  // Element dragging state
  private isDraggingElement = false;
  private dragStartMouse = { x: 0, y: 0 };
  private dragStartElementPos = { xPt: 0, yPt: 0 };
  private dragStartPageIndex = 0;
  private draggedElementId: string | null = null;

  // Element resizing state
  private isResizingElement = false;
  private resizeHandle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null = null;
  private resizeStartMouse = { x: 0, y: 0 };
  private resizeStartRect = { xPt: 0, yPt: 0, widthPt: 0, heightPt: 0 };
  private resizingElementId: string | null = null;

  // Active inline text selection state
  private savedTextRange: Range | null = null;
  private savedTextElementId: string | null = null;

  // Active page computed metrics
  readonly currentPage = computed<PageDimensions | null>(() => {
    const list = this.pages();
    const idx = this.currentPageIndex();
    if (idx >= 0 && idx < list.length) {
      return list[idx];
    }
    return null;
  });

  readonly currentPageElements = computed<EditElement[]>(() => {
    const idx = this.currentPageIndex();
    return this.elements().filter(e => e.pageIndex === idx);
  });

  readonly selectedElement = computed<EditElement | null>(() => {
    const id = this.selectedElementId();
    if (!id) return null;
    return this.elements().find(e => e.id === id) || null;
  });

  readonly displaySize = computed(() => {
    const page = this.currentPage();
    if (!page) return { width: 595, height: 842 };
    return this.transform.getPageDisplaySize(page, this.zoom());
  });

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'Edit PDF Online Free - Add Text, Shapes, Signatures & OCR | PDFTailor',
      description:
        'Edit PDF documents in your browser with private, client-side canvas editing. Add text, images, shapes, signatures, and optional cloud OCR to make scanned text editable.',
      keywords: ['edit pdf', 'free pdf editor', 'pdf ocr', 'make text editable', 'sign pdf', 'annotate pdf'],
      canonical: 'https://pdftailor.in/edit-pdf',
      faqs: []
    });
  }

  ngOnDestroy(): void {
    this.ocrService.cancel();
  }

  // --- PDF Loading ---
  async onFilesSelected(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    this.errorMessage.set(null);

    const file = files[0];
    const validation = await this.browserPdf.validatePdf(file);
    if (!validation.isValid) {
      this.errorMessage.set(validation.error || 'The selected file is not a valid PDF.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(buffer);
      await this.loadPdfBytes(pdfBytes, file.name);
    } catch {
      this.errorMessage.set('Could not load the PDF document. Please verify the file is not corrupted.');
    }
  }

  async loadPdfBytes(pdfBytes: Uint8Array, fileName: string): Promise<void> {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const count = doc.getPageCount();
    const pageList: PageDimensions[] = [];

    for (let i = 0; i < count; i++) {
      const p = doc.getPage(i);
      const { width, height } = p.getSize();
      pageList.push({
        pageIndex: i,
        widthPt: Math.round(width),
        heightPt: Math.round(height),
        rotation: p.getRotation().angle || 0
      });
    }

    this.currentPdfBytes.set(pdfBytes);
    this.currentFileName.set(fileName);
    this.pages.set(pageList);
    this.currentPageIndex.set(0);
    this.elements.set([]);
    this.history.clear();
    this.viewMode.set('editor');
    this.layoutService.hideFooter();

    try {
      this.cachedPdfDoc = await (pdfjsLib as any).getDocument({
        data: pdfBytes.slice(0),
        verbosity: 0,
        isEvalSupported: false
      }).promise;
      this.generateThumbnails();
    } catch (err) {
      console.warn('PDF.js initial load warning:', err);
    }

    setTimeout(() => this.renderCurrentPageToCanvas(), 50);
  }

  private async generateThumbnails(): Promise<void> {
    if (!this.cachedPdfDoc) return;
    const thumbs = new Map<number, string>();
    const total = this.cachedPdfDoc.numPages;

    for (let i = 1; i <= total; i++) {
      try {
        const page = await this.cachedPdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.18 });
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(viewport.width);
        offscreen.height = Math.floor(viewport.height);
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumbs.set(i - 1, offscreen.toDataURL('image/jpeg', 0.8));
        }
      } catch {
        // Fallback to CSS doc lines for thumbnail
      }
    }
    this.pageThumbnails.set(thumbs);
  }

  
  getPageDisplaySize(page: PageDimensions): { width: number; height: number } {
    return this.transform.getPageDisplaySize(page, this.zoom());
  }

  getElementsByPage(pageIndex: number): EditElement[] {
    return this.elements().filter(e => e.pageIndex === pageIndex);
  }

  onPageClick(pageIndex: number, event: MouseEvent): void {
    event.stopPropagation();
    this.currentPageIndex.set(pageIndex);
    this.onCanvasClick(event, pageIndex);
  }

  onPageMouseDown(pageIndex: number, event: MouseEvent): void {
    this.currentPageIndex.set(pageIndex);
    this.activeDrawingPageIndex.set(pageIndex);
    this.onCanvasMouseDown(event);
  }

  onPageMouseMove(pageIndex: number, event: MouseEvent): void {
    if (this.isDrawing) {
      if (this.activeDrawingPageIndex() === pageIndex) {
        this.onCanvasMouseMove(event);
      }
    } else {
      this.onCanvasMouseMove(event);
    }
  }

  onPageTouchStart(pageIndex: number, event: TouchEvent): void {
    this.currentPageIndex.set(pageIndex);
    this.activeDrawingPageIndex.set(pageIndex);
    this.onCanvasTouchStart(event);
  }

  onPageTouchMove(pageIndex: number, event: TouchEvent): void {
    if (this.isDrawing) {
      if (this.activeDrawingPageIndex() === pageIndex) {
        this.onCanvasTouchMove(event);
      }
    } else {
      this.onCanvasTouchMove(event);
    }
  }

  onViewportScroll(): void {
    if (this.isUserScrollingToPage) return;

    const vp = this.canvasViewportRef?.nativeElement;
    if (!vp) return;

    const vpRect = vp.getBoundingClientRect();
    const vpCenterY = vpRect.top + vpRect.height / 2;

    let closestPageIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < this.pages().length; i++) {
      const pageEl = document.getElementById(`pdf-page-${i}`);
      if (!pageEl) continue;

      const pageRect = pageEl.getBoundingClientRect();
      const pageCenterY = pageRect.top + pageRect.height / 2;
      const dist = Math.abs(pageCenterY - vpCenterY);

      if (dist < minDistance) {
        minDistance = dist;
        closestPageIndex = i;
      }
    }

    if (closestPageIndex !== this.currentPageIndex()) {
      this.currentPageIndex.set(closestPageIndex);
      this.scrollActiveThumbnailIntoView(closestPageIndex);
    }
  }

  scrollToPage(index: number): void {
    if (index < 0 || index >= this.pages().length) return;
    this.currentPageIndex.set(index);
    this.scrollActiveThumbnailIntoView(index);

    const pageEl = document.getElementById(`pdf-page-${index}`);
    if (pageEl) {
      this.isUserScrollingToPage = true;
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        this.isUserScrollingToPage = false;
      }, 500);
    }
  }

    async renderAllPages(): Promise<void> {
    if (!this.cachedPdfDoc) {
      const bytes = this.currentPdfBytes();
      if (bytes) {
        this.cachedPdfDoc = await (pdfjsLib as any).getDocument({
          data: bytes.slice(0),
          verbosity: 0,
          isEvalSupported: false
        }).promise;
      }
    }
    if (!this.cachedPdfDoc) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    for (let i = 0; i < this.pages().length; i++) {
      const pageInfo = this.pages()[i];
      const canvas = document.getElementById(`pdf-canvas-${i}`) as HTMLCanvasElement | null;
      if (!canvas) continue;

      try {
        const pdfPage = await this.cachedPdfDoc.getPage(pageInfo.pageIndex + 1);
        const display = this.getPageDisplaySize(pageInfo);
        const unscaledViewport = pdfPage.getViewport({ scale: 1.0, rotation: pageInfo.rotation || 0 });
        const scale = (display.width / unscaledViewport.width) * dpr;
        const viewport = pdfPage.getViewport({ scale, rotation: pageInfo.rotation || 0 });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${display.width}px`;
        canvas.style.height = `${display.height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          await pdfPage.render({ canvasContext: ctx, viewport }).promise;

          // Erase original text on canvas for all page text blocks that are edited or currently selected
          for (const el of this.elements()) {
            if (el.pageIndex === i && el.type === 'text') {
              const textEl = el as TextEditElement;
              if (textEl.isPageTextLine && (textEl.isEdited || this.selectedElementId() === textEl.id)) {
                this.whiteoutOriginalTextOnCanvas(textEl, ctx, pageInfo, dpr);
              }
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`PDF render page ${i + 1} warning:`, err);
        }
      }
    }
  }

  async renderCurrentPageToCanvas(): Promise<void> {
    await this.renderAllPages();
  }

  /**
   * Directly paints a solid white rectangle onto the PDF canvas over the original text bounding box.
   * This permanently erases the PDF.js bitmap pixels so that edited or moved text never shows
   * a ghost/duplicate underneath.
   */
  whiteoutOriginalTextOnCanvas(
    textEl: TextEditElement,
    existingCtx?: CanvasRenderingContext2D,
    pageInfoParam?: PageDimensions,
    dprParam?: number
  ): void {
    const pageIndex = textEl.pageIndex;
    const pageInfo = pageInfoParam || this.pages()[pageIndex];
    if (!pageInfo) return;

    const canvas = (document.getElementById(`pdf-canvas-${pageIndex}`) as HTMLCanvasElement | null)
      || this.pageCanvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = existingCtx || canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprParam !== undefined
      ? dprParam
      : (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    const origX = textEl.originalXPt !== undefined ? textEl.originalXPt : textEl.xPt;
    const origY = textEl.originalYPt !== undefined ? textEl.originalYPt : textEl.yPt;
    const origW = textEl.originalWidthPt !== undefined ? textEl.originalWidthPt : textEl.widthPt;
    const origH = textEl.originalHeightPt !== undefined ? textEl.originalHeightPt : textEl.heightPt;

    const screenRect = this.transform.pdfRectToScreenRect(
      {
        xPt: Math.max(0, origX - 3),
        yPt: Math.max(0, origY - 2),
        widthPt: origW + 6,
        heightPt: origH + 4
      },
      pageInfo,
      this.zoom()
    );

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      Math.floor(screenRect.x * dpr),
      Math.floor(screenRect.y * dpr),
      Math.ceil(screenRect.width * dpr),
      Math.ceil(screenRect.height * dpr)
    );
  }

  // --- Page Navigation & Zoom ---
  setPageIndex(index: number, resetViewportScroll = true): void {
    if (index >= 0 && index < this.pages().length) {
      this.scrollToPage(index);
      setTimeout(() => {
        if (this.editorMode() === 'edit') {
          this.makePageTextEditable();
        }
      }, 20);
    }
  }

  private scrollActiveThumbnailIntoView(index: number): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const thumbEl = document.getElementById(`thumb-page-${index}`);
      if (thumbEl) {
        thumbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 40);
  }

  onViewportWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
      return;
    }

    const totalPages = this.pages().length;
    if (totalPages <= 1) {
      return;
    }

    const vp = this.canvasViewportRef?.nativeElement;
    if (!vp) {
      return;
    }

    const maxScroll = vp.scrollHeight - vp.clientHeight;
    const isAtBottom = maxScroll <= 12 || vp.scrollTop >= maxScroll - 16;
    const isAtTop = maxScroll <= 12 || vp.scrollTop <= 16;

    if (this.isPageSwitching) {
      return;
    }

    clearTimeout(this.wheelResetTimer);
    this.wheelResetTimer = setTimeout(() => {
      this.wheelAccumulator = 0;
    }, 200);

    // Scrolling down (towards next page)
    if (event.deltaY > 0) {
      if (isAtBottom && this.currentPageIndex() < totalPages - 1) {
        this.wheelAccumulator += event.deltaY;
        if (this.wheelAccumulator >= 35) {
          this.isPageSwitching = true;
          this.wheelAccumulator = 0;
          this.setPageIndex(this.currentPageIndex() + 1, true);
          setTimeout(() => {
            this.isPageSwitching = false;
            this.wheelAccumulator = 0;
          }, 320);
        }
      }
    } else if (event.deltaY < 0) {
      // Scrolling up (towards previous page)
      if (isAtTop && this.currentPageIndex() > 0) {
        this.wheelAccumulator += event.deltaY;
        if (this.wheelAccumulator <= -35) {
          this.isPageSwitching = true;
          this.wheelAccumulator = 0;
          this.setPageIndex(this.currentPageIndex() - 1, false);
          requestAnimationFrame(() => {
            if (vp) {
              vp.scrollTop = Math.max(0, vp.scrollHeight - vp.clientHeight);
            }
          });
          setTimeout(() => {
            this.isPageSwitching = false;
            this.wheelAccumulator = 0;
          }, 320);
        }
      }
    }
  }

  prevPage(): void {
    this.scrollToPage(this.currentPageIndex() - 1);
  }

  nextPage(): void {
    this.scrollToPage(this.currentPageIndex() + 1);
  }

  zoomIn(): void {
    const nextZoom = Math.min(3.0, Math.round((this.zoom() + 0.15) * 100) / 100);
    this.zoom.set(nextZoom);
    setTimeout(() => this.renderCurrentPageToCanvas(), 20);
  }

  zoomOut(): void {
    const nextZoom = Math.max(0.5, Math.round((this.zoom() - 0.15) * 100) / 100);
    this.zoom.set(nextZoom);
    setTimeout(() => this.renderCurrentPageToCanvas(), 20);
  }

  resetZoom(): void {
    this.zoom.set(1.0);
    setTimeout(() => this.renderCurrentPageToCanvas(), 20);
  }

  rotatePage(pageIndex: number): void {
    if (pageIndex < 0 || pageIndex >= this.pages().length) return;
    const page = this.pages()[pageIndex];
    const oldRotation = page.rotation;
    const newRotation = (oldRotation + 90) % 360;

    const cmd: Command = {
      description: `Rotate Page ${pageIndex + 1}`,
      execute: () => {
        this.pages.update(list =>
          list.map(p => (p.pageIndex === pageIndex ? { ...p, rotation: newRotation } : p))
        );
        this.updateThumbnailForPage(pageIndex);
        if (this.currentPageIndex() === pageIndex) {
          setTimeout(() => this.renderCurrentPageToCanvas(), 20);
        }
      },
      undo: () => {
        this.pages.update(list =>
          list.map(p => (p.pageIndex === pageIndex ? { ...p, rotation: oldRotation } : p))
        );
        this.updateThumbnailForPage(pageIndex);
        if (this.currentPageIndex() === pageIndex) {
          setTimeout(() => this.renderCurrentPageToCanvas(), 20);
        }
      }
    };

    this.history.execute(cmd);
  }

  rotateCurrentPage(): void {
    this.rotatePage(this.currentPageIndex());
  }

  deletePage(pageIndex: number): void {
    if (this.pages().length <= 1) {
      this.errorMessage.set('A document must have at least one page.');
      return;
    }
    const removedPage = this.pages()[pageIndex];
    const removedElements = this.elements().filter(e => e.pageIndex === pageIndex);

    const cmd: Command = {
      description: `Delete Page ${pageIndex + 1}`,
      execute: () => {
        this.pages.update(list => {
          const updated = list.filter((_, i) => i !== pageIndex);
          return updated.map((p, i) => ({ ...p, pageIndex: i }));
        });
        this.elements.update(list => list.filter(e => e.pageIndex !== pageIndex));
        this.currentPageIndex.set(Math.min(pageIndex, this.pages().length - 1));
        this.generateThumbnails();
        setTimeout(() => this.renderCurrentPageToCanvas(), 20);
      },
      undo: () => {
        this.pages.update(list => {
          const copy = [...list];
          copy.splice(pageIndex, 0, removedPage);
          return copy.map((p, i) => ({ ...p, pageIndex: i }));
        });
        this.elements.update(list => [...list, ...removedElements]);
        this.currentPageIndex.set(pageIndex);
        this.generateThumbnails();
        setTimeout(() => this.renderCurrentPageToCanvas(), 20);
      }
    };

    this.history.execute(cmd);
  }

  deleteCurrentPage(): void {
    this.deletePage(this.currentPageIndex());
  }

  private async updateThumbnailForPage(pageIndex: number): Promise<void> {
    if (!this.cachedPdfDoc || pageIndex < 0 || pageIndex >= this.pages().length) return;
    try {
      const pdfPage = await this.cachedPdfDoc.getPage(pageIndex + 1);
      const pageDim = this.pages()[pageIndex];
      const unscaled = pdfPage.getViewport({ scale: 1.0, rotation: pageDim.rotation || 0 });
      const scale = 120 / Math.max(unscaled.width, unscaled.height);
      const viewport = pdfPage.getViewport({ scale, rotation: pageDim.rotation || 0 });

      const offscreen = document.createElement('canvas');
      offscreen.width = Math.floor(viewport.width);
      offscreen.height = Math.floor(viewport.height);
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        const currentThumbs = new Map(this.pageThumbnails());
        currentThumbs.set(pageIndex, offscreen.toDataURL('image/png'));
        this.pageThumbnails.set(currentThumbs);
      }
    } catch {
      // Best effort
    }
  }

  toggleLeftSidebar(): void {
    this.isLeftSidebarCollapsed.update(v => !v);
  }

  // --- Tool Selection & Canvas Interaction ---
  selectTool(tool: EditToolType): void {
    this.activeTool.set(tool);
    if (tool !== 'select') {
      this.selectedElementId.set(null);
    }
  }

  onCanvasClick(event: MouseEvent, targetPageIndex?: number): void {
    if (this.isDrawing) return;
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    const canvas = (document.getElementById(`pdf-canvas-${pageIndex}`) as HTMLCanvasElement | null)
      || this.pageCanvasRef?.nativeElement;
    if (!page || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;

    const pdfPt = this.transform.screenPointToPdfPoint({ x: screenX, y: screenY }, page, this.zoom());

    switch (this.activeTool()) {
      case 'text':
        this.addTextElement(pdfPt.xPt, pdfPt.yPt, page.pageIndex);
        break;
      case 'shapes':
        this.addShapeElement(pdfPt.xPt, pdfPt.yPt, page.pageIndex);
        break;
      case 'highlight':
        this.addHighlightElement(pdfPt.xPt, pdfPt.yPt, page.pageIndex);
        break;
      case 'whiteout':
        this.addWhiteoutElement(pdfPt.xPt, pdfPt.yPt, page.pageIndex);
        break;
    }
  }

  // --- Freehand Draw Handlers & Real-Time Smooth Spline ---
  onCanvasMouseDown(event: MouseEvent): void {
    this.startDrawing(event.clientX, event.clientY);
  }

  handleDragOrResizeMove(event: MouseEvent): void {
    if (this.isDraggingElement && this.draggedElementId) {
      const draggedEl = this.elements().find(e => e.id === this.draggedElementId);
      const page = draggedEl
        ? (this.pages().find(p => p.pageIndex === draggedEl.pageIndex) || this.currentPage())
        : this.currentPage();
      if (!page) return;

      if (draggedEl && draggedEl.type === 'text' && (draggedEl as TextEditElement).isPageTextLine) {
        const textEl = draggedEl as TextEditElement;
        if (!textEl.isEdited) {
          textEl.isEdited = true;
          this.whiteoutOriginalTextOnCanvas(textEl);
        }
      }

      const dxScreen = event.clientX - this.dragStartMouse.x;
      const dyScreen = event.clientY - this.dragStartMouse.y;
      const dxPt = dxScreen / this.zoom();
      const dyPt = -dyScreen / this.zoom();

      this.elements.update(list =>
        list.map(e =>
          e.id === this.draggedElementId
            ? { ...e, xPt: Math.round(this.dragStartElementPos.xPt + dxPt), yPt: Math.round(this.dragStartElementPos.yPt + dyPt) }
            : e
        )
      );
      return;
    }

    if (this.isResizingElement && this.resizingElementId && this.resizeHandle) {
      const resizingEl = this.elements().find(e => e.id === this.resizingElementId);
      if (!resizingEl) return;
      const page = this.pages().find(p => p.pageIndex === resizingEl.pageIndex) || this.currentPage();
      if (!page) return;

      const startScreen = this.transform.pdfRectToScreenRect(
        {
          xPt: this.resizeStartRect.xPt,
          yPt: this.resizeStartRect.yPt,
          widthPt: this.resizeStartRect.widthPt,
          heightPt: this.resizeStartRect.heightPt
        },
        page,
        this.zoom()
      );

      const dx = event.clientX - this.resizeStartMouse.x;
      const dy = event.clientY - this.resizeStartMouse.y;

      let newLeft = startScreen.x;
      let newTop = startScreen.y;
      let newWidth = startScreen.width;
      let newHeight = startScreen.height;

      const handle = this.resizeHandle;

      if (resizingEl.type === 'image' || resizingEl.type === 'sign') {
        const aspect = (startScreen.width > 0 && startScreen.height > 0)
          ? (startScreen.width / startScreen.height)
          : 1;

        if (handle === 'se') {
          newWidth = Math.max(20, startScreen.width + dx);
          newHeight = Math.max(16, newWidth / aspect);
        } else if (handle === 'sw') {
          newWidth = Math.max(20, startScreen.width - dx);
          newLeft = startScreen.x + startScreen.width - newWidth;
          newHeight = Math.max(16, newWidth / aspect);
        } else if (handle === 'ne') {
          newWidth = Math.max(20, startScreen.width + dx);
          newHeight = Math.max(16, newWidth / aspect);
          newTop = startScreen.y + startScreen.height - newHeight;
        } else if (handle === 'nw') {
          newWidth = Math.max(20, startScreen.width - dx);
          newLeft = startScreen.x + startScreen.width - newWidth;
          newHeight = Math.max(16, newWidth / aspect);
          newTop = startScreen.y + startScreen.height - newHeight;
        } else if (handle === 'e' || handle === 'w') {
          if (handle === 'e') {
            newWidth = Math.max(20, startScreen.width + dx);
          } else {
            newWidth = Math.max(20, startScreen.width - dx);
            newLeft = startScreen.x + startScreen.width - newWidth;
          }
          newHeight = Math.max(16, newWidth / aspect);
        } else if (handle === 's' || handle === 'n') {
          if (handle === 's') {
            newHeight = Math.max(16, startScreen.height + dy);
          } else {
            newHeight = Math.max(16, startScreen.height - dy);
            newTop = startScreen.y + startScreen.height - newHeight;
          }
          newWidth = Math.max(20, newHeight * aspect);
        }
      } else {
        if (handle.includes('e')) {
          newWidth = Math.max(20, startScreen.width + dx);
        }
        if (handle.includes('s')) {
          newHeight = Math.max(16, startScreen.height + dy);
        }
        if (handle.includes('w')) {
          const potentialW = startScreen.width - dx;
          if (potentialW >= 20) {
            newLeft = startScreen.x + dx;
            newWidth = potentialW;
          } else {
            newLeft = startScreen.x + startScreen.width - 20;
            newWidth = 20;
          }
        }
        if (handle.includes('n')) {
          const potentialH = startScreen.height - dy;
          if (potentialH >= 16) {
            newTop = startScreen.y + dy;
            newHeight = potentialH;
          } else {
            newTop = startScreen.y + startScreen.height - 16;
            newHeight = 16;
          }
        }
      }

      const newPdfRect = this.transform.screenRectToPdfRect(
        { x: newLeft, y: newTop, width: newWidth, height: newHeight },
        page,
        this.zoom()
      );

      this.elements.update(list =>
        list.map(e =>
          e.id === this.resizingElementId
            ? {
                ...e,
                xPt: Math.round(newPdfRect.xPt),
                yPt: Math.round(newPdfRect.yPt),
                widthPt: Math.max(10, Math.round(newPdfRect.widthPt)),
                heightPt: Math.max(8, Math.round(newPdfRect.heightPt))
              }
            : e
        )
      );
    }
  }

  finishDragOrResize(): void {
    if (this.isDraggingElement && this.draggedElementId) {
      const draggedId = this.draggedElementId;
      const el = this.elements().find(e => e.id === draggedId);
      const startPos = { ...this.dragStartElementPos };
      const startPageIndex = this.dragStartPageIndex;

      this.isDraggingElement = false;
      this.draggedElementId = null;

      if (!el) return;

      const originPage = this.pages().find(p => p.pageIndex === startPageIndex) || this.currentPage();
      if (!originPage) return;

      let targetPageIndex = startPageIndex;
      let finalX = el.xPt;
      let finalY = el.yPt;

      if (typeof document !== 'undefined') {
        const originPageEl = document.getElementById(`pdf-page-${startPageIndex}`);
        if (originPageEl) {
          const originRect = originPageEl.getBoundingClientRect();
          const elScreen = this.transform.pdfRectToScreenRect(
            { xPt: el.xPt, yPt: el.yPt, widthPt: el.widthPt, heightPt: el.heightPt },
            originPage,
            this.zoom()
          );

          // Center of the element in global screen coordinates
          const centerClientY = originRect.top + elScreen.y + elScreen.height / 2;

          for (let i = 0; i < this.pages().length; i++) {
            const pageEl = document.getElementById(`pdf-page-${i}`);
            if (!pageEl) continue;
            const pRect = pageEl.getBoundingClientRect();
            if (centerClientY >= pRect.top && centerClientY <= pRect.bottom) {
              targetPageIndex = i;
              break;
            }
          }

          if (targetPageIndex !== startPageIndex) {
            const targetPage = this.pages().find(p => p.pageIndex === targetPageIndex);
            const targetPageEl = document.getElementById(`pdf-page-${targetPageIndex}`);
            if (targetPage && targetPageEl) {
              const targetRect = targetPageEl.getBoundingClientRect();
              const screenLeftInTarget = (originRect.left + elScreen.x) - targetRect.left;
              const screenTopInTarget = (originRect.top + elScreen.y) - targetRect.top;

              const newPdfRect = this.transform.screenRectToPdfRect(
                {
                  x: screenLeftInTarget,
                  y: screenTopInTarget,
                  width: elScreen.width,
                  height: elScreen.height
                },
                targetPage,
                this.zoom()
              );

              finalX = Math.round(newPdfRect.xPt);
              finalY = Math.round(newPdfRect.yPt);
            }
          }
        }
      }

      if (targetPageIndex !== startPageIndex || el.xPt !== startPos.xPt || el.yPt !== startPos.yPt) {
        const description = targetPageIndex !== startPageIndex
          ? `Move Element to Page ${targetPageIndex + 1}`
          : 'Move Element';

        const cmd: Command = {
          description,
          execute: () => {
            this.elements.update(list =>
              list.map(e =>
                e.id === draggedId
                  ? {
                      ...e,
                      pageIndex: targetPageIndex,
                      xPt: finalX,
                      yPt: finalY,
                      ...(e.type === 'text' && (e as TextEditElement).isPageTextLine ? { isEdited: true } : {})
                    }
                  : e
              )
            );
            if (targetPageIndex !== this.currentPageIndex()) {
              this.currentPageIndex.set(targetPageIndex);
            }
          },
          undo: () => {
            this.elements.update(list =>
              list.map(e => (e.id === draggedId ? { ...e, pageIndex: startPageIndex, xPt: startPos.xPt, yPt: startPos.yPt } : e))
            );
            if (startPageIndex !== this.currentPageIndex()) {
              this.currentPageIndex.set(startPageIndex);
            }
          }
        };
        this.history.execute(cmd);
      }
      return;
    }

    if (this.isResizingElement && this.resizingElementId) {
      const resizeId = this.resizingElementId;
      const el = this.elements().find(e => e.id === resizeId);
      const startRect = { ...this.resizeStartRect };

      this.isResizingElement = false;
      this.resizeHandle = null;
      this.resizingElementId = null;

      if (
        el &&
        (el.xPt !== startRect.xPt ||
          el.yPt !== startRect.yPt ||
          el.widthPt !== startRect.widthPt ||
          el.heightPt !== startRect.heightPt)
      ) {
        const finalRect = {
          xPt: el.xPt,
          yPt: el.yPt,
          widthPt: el.widthPt,
          heightPt: el.heightPt
        };
        const cmd: Command = {
          description: 'Resize Element',
          execute: () => {
            this.elements.update(list =>
              list.map(e => (e.id === resizeId ? { ...e, ...finalRect } : e))
            );
          },
          undo: () => {
            this.elements.update(list =>
              list.map(e => (e.id === resizeId ? { ...e, ...startRect } : e))
            );
          }
        };
        this.history.execute(cmd);
      }
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (this.isDraggingElement || this.isResizingElement) {
      this.handleDragOrResizeMove(event);
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    if (this.isDraggingElement || this.isResizingElement) {
      this.finishDragOrResize();
    }
    if (this.isDrawing) {
      this.endDrawing();
    }
  }

  @HostListener('window:touchend')
  onWindowTouchEnd(): void {
    if (this.isDraggingElement || this.isResizingElement) {
      this.finishDragOrResize();
    }
    if (this.isDrawing) {
      this.endDrawing();
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.isDraggingElement || this.isResizingElement) {
      this.handleDragOrResizeMove(event);
      return;
    }

    if (!this.isDrawing || this.activeTool() !== 'draw') return;
    this.moveDrawing(event.clientX, event.clientY);
  }

  onCanvasMouseUp(): void {
    if (this.isDraggingElement || this.isResizingElement) {
      this.finishDragOrResize();
      return;
    }
    this.endDrawing();
  }

  onCanvasTouchStart(event: TouchEvent): void {
    if (this.activeTool() !== 'draw') return;
    if (event.touches.length > 0) {
      event.preventDefault();
      const t = event.touches[0];
      this.startDrawing(t.clientX, t.clientY);
    }
  }

  onCanvasTouchMove(event: TouchEvent): void {
    if (!this.isDrawing || this.activeTool() !== 'draw') return;
    if (event.touches.length > 0) {
      event.preventDefault();
      const t = event.touches[0];
      this.moveDrawing(t.clientX, t.clientY);
    }
  }

  onCanvasTouchEnd(): void {
    if (this.isDraggingElement || this.isResizingElement) {
      this.finishDragOrResize();
      return;
    }
    this.endDrawing();
  }

  private startDrawing(clientX: number, clientY: number): void {
    if (this.activeTool() !== 'draw') return;
    const pageIndex = this.activeDrawingPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    const canvas = (document.getElementById(`pdf-canvas-${pageIndex}`) as HTMLCanvasElement | null)
      || this.pageCanvasRef?.nativeElement;
    if (!page || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    this.isDrawing = true;
    this.isDrawingActive.set(true);
    this.currentDrawingScreenPoints = [{ x: screenX, y: screenY }];
    this.activeDrawingPath.set(`M ${screenX} ${screenY} L ${screenX + 0.1} ${screenY + 0.1}`);
  }

  private moveDrawing(clientX: number, clientY: number): void {
    const pageIndex = this.activeDrawingPageIndex();
    const canvas = (document.getElementById(`pdf-canvas-${pageIndex}`) as HTMLCanvasElement | null)
      || this.pageCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const pts = this.currentDrawingScreenPoints;
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const dist = Math.hypot(screenX - last.x, screenY - last.y);
      if (dist < 1.5) return;
    }

    pts.push({ x: screenX, y: screenY });
    const smooth = this.screenPointsToSmoothSvgPath(pts);
    this.activeDrawingPath.set(smooth);
  }

  private endDrawing(): void {
    if (this.isDraggingElement || this.isResizingElement) {
      this.finishDragOrResize();
      return;
    }

    if (!this.isDrawing || this.activeTool() !== 'draw') {
      this.isDrawing = false;
      this.isDrawingActive.set(false);
      return;
    }

    this.isDrawing = false;
    this.isDrawingActive.set(false);
    const pageIndex = this.activeDrawingPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    const screenPts = this.currentDrawingScreenPoints;
    if (!page || screenPts.length < 2) {
      this.activeDrawingPath.set('');
      this.currentDrawingScreenPoints = [];
      return;
    }

    // Convert screen points to PDF points
    const pdfPts = screenPts.map(p =>
      this.transform.screenPointToPdfPoint({ x: p.x, y: p.y }, page, this.zoom())
    );

    const xs = pdfPts.map(p => p.xPt);
    const ys = pdfPts.map(p => p.yPt);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const newElement: DrawEditElement = {
      id: `draw-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'draw',
      xPt: minX,
      yPt: minY,
      widthPt: Math.max(8, maxX - minX),
      heightPt: Math.max(8, maxY - minY),
      points: pdfPts,
      strokeColor: this.drawColor(),
      strokeWidth: this.drawStrokeWidth()
    };

    const cmd: Command = {
      description: 'Freehand Draw',
      execute: () => {
        this.elements.update(list => [...list, newElement]);
        this.selectedElementId.set(newElement.id);
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== newElement.id));
        this.selectedElementId.set(null);
      }
    };

    this.history.execute(cmd);
    this.activeDrawingPath.set('');
    this.currentDrawingScreenPoints = [];
  }

  screenPointsToSmoothSvgPath(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
    }
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      d += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  onElementMouseDown(el: EditElement, event: MouseEvent): void {
    if (this.activeTool() !== 'select') return;
    if (this.editorMode() === 'annotate' && (el as TextEditElement).isPageTextLine) return;
    event.stopPropagation();
    this.selectElement(el, event);
    this.isDraggingElement = true;
    this.draggedElementId = el.id;
    this.dragStartMouse = { x: event.clientX, y: event.clientY };
    this.dragStartElementPos = { xPt: el.xPt, yPt: el.yPt };
    this.dragStartPageIndex = el.pageIndex ?? this.currentPageIndex();
  }

  onResizeHandleMouseDown(
    el: EditElement,
    handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
    event: MouseEvent
  ): void {
    if (this.activeTool() !== 'select') return;
    event.stopPropagation();
    event.preventDefault();

    this.isResizingElement = true;
    this.resizeHandle = handle;
    this.resizingElementId = el.id;
    this.resizeStartMouse = { x: event.clientX, y: event.clientY };
    this.resizeStartRect = {
      xPt: el.xPt,
      yPt: el.yPt,
      widthPt: el.widthPt,
      heightPt: el.heightPt
    };
  }

  onTextareaMouseDown(event: MouseEvent, el: EditElement): void {
    event.stopPropagation();
    this.selectElement(el, event);
  }

  onTextareaSelectionChange(el: EditElement): void {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      this.savedTextRange = sel.getRangeAt(0).cloneRange();
      this.savedTextElementId = el.id;
    }
  }

  // --- Element Creators & Setters ---
  addTextElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement: TextEditElement = {
      id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'text',
      xPt,
      yPt,
      widthPt: 220,
      heightPt: 28,
      text: 'Click or edit text',
      fontFamily: this.textFont(),
      fontSizePt: this.textSize(),
      color: this.textColor(),
      bold: this.isTextBold(),
      italic: this.isTextItalic()
    };

    const cmd: Command = {
      description: 'Add Text Box',
      execute: () => {
        this.elements.update(list => [...list, newElement]);
        this.selectedElementId.set(newElement.id);
        this.activeTool.set('select');
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== newElement.id));
        this.selectedElementId.set(null);
      }
    };

    this.history.execute(cmd);
  }

  setShapeType(type: 'rectangle' | 'circle' | 'line' | 'arrow' | 'star'): void {
    this.shapeType.set(type);
    this.updateSelectedShapeProperty('shapeType', type);
  }

  setStrokeColor(color: string): void {
    this.strokeColor.set(color);
    this.updateSelectedShapeProperty('strokeColor', color);
  }

  setFillColor(color: string): void {
    this.fillColor.set(color);
    this.updateSelectedShapeProperty('fillColor', color);
  }

  setStrokeWidth(w: number): void {
    this.strokeWidth.set(w);
    this.updateSelectedShapeProperty('strokeWidth', w);
  }

  updateSelectedShapeProperty(field: keyof ShapeEditElement, value: any): void {
    const el = this.selectedElement();
    if (!el || el.type !== 'shape') return;

    const shapeEl = el as ShapeEditElement;
    const oldVal = shapeEl[field];

    const cmd: Command = {
      description: `Change shape ${field}`,
      execute: () => {
        this.elements.update(list =>
          list.map(e => (e.id === shapeEl.id ? { ...e, [field]: value } : e))
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e => (e.id === shapeEl.id ? { ...e, [field]: oldVal } : e))
        );
      }
    };
    this.history.execute(cmd);
  }

  addShapeElement(xPt?: number, yPt?: number, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const widthPt = this.shapeType() === 'line' || this.shapeType() === 'arrow' ? 140 : 160;
    const heightPt = this.shapeType() === 'line' || this.shapeType() === 'arrow' ? 70 : 100;
    const finalX = xPt !== undefined ? xPt : Math.round((page.widthPt - widthPt) / 2);
    const finalY = yPt !== undefined ? yPt : Math.round((page.heightPt - heightPt) / 2);

    const newElement: ShapeEditElement = {
      id: `shape-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'shape',
      shapeType: this.shapeType(),
      xPt: finalX,
      yPt: finalY,
      widthPt,
      heightPt,
      strokeColor: this.strokeColor(),
      fillColor: this.fillColor(),
      strokeWidth: this.strokeWidth()
    };

    const cmd: Command = {
      description: `Add Shape (${this.shapeType()})`,
      execute: () => {
        this.elements.update(list => [...list, newElement]);
        this.selectedElementId.set(newElement.id);
        this.activeTool.set('select');
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== newElement.id));
        this.selectedElementId.set(null);
      }
    };

    this.history.execute(cmd);
  }

  addHighlightElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement: HighlightEditElement = {
      id: `hl-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'highlight',
      xPt,
      yPt,
      widthPt: 180,
      heightPt: 22,
      color: this.highlightColor(),
      opacity: this.highlightOpacity()
    };

    const cmd: Command = {
      description: 'Add Highlight',
      execute: () => {
        this.elements.update(list => [...list, newElement]);
        this.selectedElementId.set(newElement.id);
        this.activeTool.set('select');
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== newElement.id));
        this.selectedElementId.set(null);
      }
    };

    this.history.execute(cmd);
  }

  addWhiteoutElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement: WhiteoutEditElement = {
      id: `wo-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'whiteout',
      xPt,
      yPt,
      widthPt: 160,
      heightPt: 30,
      fillColor: 'var(--pt-surface-white)'
    };

    const cmd: Command = {
      description: 'Add Whiteout',
      execute: () => {
        this.elements.update(list => [...list, newElement]);
        this.selectedElementId.set(newElement.id);
        this.activeTool.set('select');
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== newElement.id));
        this.selectedElementId.set(null);
      }
    };

    this.history.execute(cmd);
  }

  // --- Signature Studio Handlers ---
  setSignatureTab(tab: 'type' | 'draw' | 'upload'): void {
    this.signatureTab.set(tab);
    if (tab === 'draw') {
      setTimeout(() => this.clearSigPad(), 50);
    }
  }

  setSignatureFont(font: string): void {
    this.signatureFont.set(font);
    this.updateSelectedSignatureProperty('fontFamily', font);
  }

  setSignatureColor(color: string): void {
    this.signatureColor.set(color);
    this.updateSelectedSignatureProperty('color', color);
  }

  setSignatureText(text: string): void {
    this.signatureText.set(text);
    const el = this.selectedElement();
    if (!el || el.type !== 'sign') return;

    const signEl = el as SignEditElement;
    const oldText = signEl.signatureText;
    const oldUrl = signEl.dataUrl;

    const cmd: Command = {
      description: 'Change signature text',
      execute: () => {
        this.elements.update(list =>
          list.map(e => (e.id === signEl.id ? ({ ...e, signatureText: text, dataUrl: text } as EditElement) : e))
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e => (e.id === signEl.id ? ({ ...e, signatureText: oldText, dataUrl: oldUrl } as EditElement) : e))
        );
      }
    };
    this.history.execute(cmd);
  }

  setSignatureSize(size: number): void {
    this.signatureSize.set(size);
    const el = this.selectedElement();
    if (!el || el.type !== 'sign') return;

    const signEl = el as SignEditElement;
    const oldSize = signEl.fontSizePt;
    const oldHeight = signEl.heightPt;
    const newHeight = Math.round(size * 1.6);

    const cmd: Command = {
      description: 'Change signature size',
      execute: () => {
        this.elements.update(list =>
          list.map(e => (e.id === signEl.id ? ({ ...e, fontSizePt: size, heightPt: newHeight } as EditElement) : e))
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e => (e.id === signEl.id ? ({ ...e, fontSizePt: oldSize, heightPt: oldHeight } as EditElement) : e))
        );
      }
    };
    this.history.execute(cmd);
  }

  updateSelectedSignatureProperty(field: keyof SignEditElement, value: any): void {
    const el = this.selectedElement();
    if (!el || el.type !== 'sign') return;

    const signEl = el as SignEditElement;
    const oldVal = signEl[field];

    const cmd: Command = {
      description: `Change signature ${field}`,
      execute: () => {
        this.elements.update(list =>
          list.map(e => (e.id === signEl.id ? { ...e, [field]: value } : e))
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e => (e.id === signEl.id ? { ...e, [field]: oldVal } : e))
        );
      }
    };
    this.history.execute(cmd);
  }

  // Signature Pad Drawing
  onSigPadMouseDown(event: MouseEvent): void {
    this.startSigPadDrawing(event.offsetX, event.offsetY);
  }

  onSigPadMouseMove(event: MouseEvent): void {
    if (!this.isSigPadDrawing) return;
    this.moveSigPadDrawing(event.offsetX, event.offsetY);
  }

  onSigPadMouseUp(): void {
    this.endSigPadDrawing();
  }

  onSigPadTouchStart(event: TouchEvent): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas || event.touches.length === 0) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    this.startSigPadDrawing(x, y);
  }

  onSigPadTouchMove(event: TouchEvent): void {
    if (!this.isSigPadDrawing) return;
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas || event.touches.length === 0) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    this.moveSigPadDrawing(x, y);
  }

  onSigPadTouchEnd(): void {
    this.endSigPadDrawing();
  }

  private startSigPadDrawing(x: number, y: number): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.isSigPadDrawing = true;
    this.sigPadPoints = [{ x, y }];
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.signatureColor() === 'var(--pt-navy)' ? '#14213D' : this.signatureColor();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  private moveSigPadDrawing(x: number, y: number): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.sigPadPoints.push({ x, y });
    const pts = this.sigPadPoints;
    if (pts.length < 3) {
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }

    const p0 = pts[pts.length - 2];
    const p1 = pts[pts.length - 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    ctx.stroke();
  }

  private endSigPadDrawing(): void {
    if (!this.isSigPadDrawing) return;
    this.isSigPadDrawing = false;
    const canvas = this.sigPadRef?.nativeElement;
    if (canvas) {
      this.signatureDrawnDataUrl.set(canvas.toDataURL('image/png'));
    }
  }

  clearSigPad(): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.signatureDrawnDataUrl.set(null);
    this.sigPadPoints = [];
  }

  onSignatureFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.signatureDrawnDataUrl.set(reader.result as string);
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }

  addSignatureElement(xPt?: number, yPt?: number, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const mode = this.signatureTab();
    let dataUrl = '';
    let widthPt = 180;
    let heightPt = 48;

    if (mode === 'draw' || mode === 'upload') {
      dataUrl = this.signatureDrawnDataUrl() || '';
      if (!dataUrl) {
        if (mode === 'draw') {
          this.errorMessage.set('Please draw your signature on the pad first.');
        } else {
          this.errorMessage.set('Please upload a signature image first.');
        }
        return;
      }
      widthPt = 160;
      heightPt = 60;
    } else {
      // Type mode
      dataUrl = this.signatureText() || 'John Doe';
      widthPt = Math.max(120, (this.signatureText().length || 8) * 14);
      heightPt = Math.round(this.signatureSize() * 1.6);
    }

    const finalX = xPt !== undefined ? xPt : Math.round((page.widthPt - widthPt) / 2);
    const finalY = yPt !== undefined ? yPt : Math.round((page.heightPt - heightPt) / 2);

    const newElement: SignEditElement = {
      id: `sign-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'sign',
      signMode: mode,
      xPt: finalX,
      yPt: finalY,
      widthPt,
      heightPt,
      dataUrl,
      signatureText: mode === 'type' ? (this.signatureText() || 'John Doe') : undefined,
      fontFamily: mode === 'type' ? this.signatureFont() : undefined,
      color: mode === 'type' ? this.signatureColor() : undefined,
      fontSizePt: mode === 'type' ? this.signatureSize() : undefined
    };

    const cmd: Command = {
      description: 'Add Signature',
      execute: () => {
        this.elements.update(list => [...list, newElement]);
        this.selectedElementId.set(newElement.id);
        this.selectTool('select');
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== newElement.id));
        this.selectedElementId.set(null);
      }
    };

    this.history.execute(cmd);
  }

  addLinkElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement: LinkEditElement = {
      id: `link-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'link',
      xPt,
      yPt,
      widthPt: 180,
      heightPt: 30,
      url: this.linkUrl()
    };

    const cmd: Command = {
      description: 'Add Link',
      execute: () => {
        this.elements.update(list => [...list, newElement]);
        this.selectedElementId.set(newElement.id);
        this.activeTool.set('select');
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== newElement.id));
        this.selectedElementId.set(null);
      }
    };

    this.history.execute(cmd);
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const page = this.currentPage();
        if (!page) return;

        const img = new Image();
        img.onload = () => {
          const maxW = Math.min(250, page.widthPt * 0.6);
          const maxH = Math.min(320, page.heightPt * 0.5);
          const naturalW = img.naturalWidth || img.width || 200;
          const naturalH = img.naturalHeight || img.height || 200;
          const ratio = naturalH / (naturalW || 1);
          let w = maxW;
          let h = w * ratio;
          if (h > maxH) {
            h = maxH;
            w = h / ratio;
          }

          const xPt = Math.max(20, Math.round((page.widthPt - w) / 2));
          const yPt = Math.max(20, Math.round((page.heightPt - h) / 2));

          const newElement: ImageEditElement = {
            id: `img-${Date.now()}`,
            pageIndex: page.pageIndex,
            type: 'image',
            xPt,
            yPt,
            widthPt: Math.round(w),
            heightPt: Math.round(h),
            naturalWidth: naturalW,
            naturalHeight: naturalH,
            dataUrl
          };

          const cmd: Command = {
            description: 'Add Image',
            execute: () => {
              this.elements.update(list => [...list, newElement]);
              this.selectedElementId.set(newElement.id);
              this.activeTool.set('select');
            },
            undo: () => {
              this.elements.update(list => list.filter(e => e.id !== newElement.id));
              this.selectedElementId.set(null);
            }
          };
          this.history.execute(cmd);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }

  // Floating Upload Dock Handlers
  openGoogleDrive(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.open('https://drive.google.com/', '_blank', 'noopener,noreferrer');
  }

  openDropbox(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.open('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');
  }

  async onAddMoreFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      await this.onFilesSelected(files);
      input.value = '';
    }
  }

  selectElement(el: EditElement, event?: Event): void {
    if (this.editorMode() === 'annotate' && (el as TextEditElement).isPageTextLine) return;
    event?.stopPropagation();
    if (el.pageIndex !== undefined && el.pageIndex !== this.currentPageIndex()) {
      this.currentPageIndex.set(el.pageIndex);
    }
    this.selectedElementId.set(el.id);

    if (el.type === 'text') {
      const textEl = el as TextEditElement;
      if (textEl.isPageTextLine) {
        textEl.isEdited = true;
        this.whiteoutOriginalTextOnCanvas(textEl);
      }
      this.textFont.set(textEl.fontFamily || 'Inter');
      this.textSize.set(textEl.fontSizePt || 14);
      this.textColor.set(textEl.color || 'var(--pt-navy)');
      this.isTextBold.set(!!textEl.bold);
      this.isTextItalic.set(!!textEl.italic);
      this.isTextUnderline.set(!!textEl.underline);
      this.textAlign.set(textEl.align || 'left');
    } else if (el.type === 'sign') {
      const signEl = el as SignEditElement;
      if (signEl.signatureText) {
        this.signatureText.set(signEl.signatureText);
      }
      if (signEl.fontFamily) {
        this.signatureFont.set(signEl.fontFamily);
      }
      if (signEl.color) {
        this.signatureColor.set(signEl.color);
      }
      if (signEl.fontSizePt) {
        this.signatureSize.set(signEl.fontSizePt);
      }
    } else if (el.type === 'shape') {
      const shapeEl = el as ShapeEditElement;
      this.shapeType.set(shapeEl.shapeType);
      this.strokeColor.set(shapeEl.strokeColor || 'var(--pt-navy)');
      this.fillColor.set(shapeEl.fillColor || 'transparent');
      this.strokeWidth.set(shapeEl.strokeWidth || 2);
    }
  }

  duplicateSelectedElement(): void {
    const el = this.selectedElement();
    if (!el) return;

    const cloned: EditElement = {
      ...el,
      id: `${el.type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      xPt: el.xPt + 20,
      yPt: el.yPt - 20
    } as EditElement;

    const cmd: Command = {
      description: `Duplicate ${el.type}`,
      execute: () => {
        this.elements.update(list => [...list, cloned]);
        this.selectedElementId.set(cloned.id);
      },
      undo: () => {
        this.elements.update(list => list.filter(e => e.id !== cloned.id));
        this.selectedElementId.set(el.id);
      }
    };
    this.history.execute(cmd);
  }

  bringToFront(): void {
    const el = this.selectedElement();
    if (!el) return;

    const cmd: Command = {
      description: 'Bring to Front',
      execute: () => {
        this.elements.update(list => [...list.filter(e => e.id !== el.id), el]);
      },
      undo: () => {
        this.elements.update(list => [el, ...list.filter(e => e.id !== el.id)]);
      }
    };
    this.history.execute(cmd);
  }

  sendToBack(): void {
    const el = this.selectedElement();
    if (!el) return;

    const cmd: Command = {
      description: 'Send to Back',
      execute: () => {
        this.elements.update(list => [el, ...list.filter(e => e.id !== el.id)]);
      },
      undo: () => {
        this.elements.update(list => [...list.filter(e => e.id !== el.id), el]);
      }
    };
    this.history.execute(cmd);
  }

  deleteSelectedElement(): void {
    const el = this.selectedElement();
    if (!el) return;

    if (el.type === 'text' && (el as TextEditElement).isPageTextLine) {
      const textEl = el as TextEditElement;
      const origX = textEl.originalXPt !== undefined ? textEl.originalXPt : textEl.xPt;
      const origY = textEl.originalYPt !== undefined ? textEl.originalYPt : textEl.yPt;
      const origW = textEl.originalWidthPt !== undefined ? textEl.originalWidthPt : textEl.widthPt;
      const origH = textEl.originalHeightPt !== undefined ? textEl.originalHeightPt : textEl.heightPt;
      const coverEl: WhiteoutEditElement = {
        id: `deleted-page-text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: el.pageIndex,
        type: 'whiteout',
        xPt: Math.max(0, origX - 3),
        yPt: Math.max(0, origY - 2),
        widthPt: origW + 6,
        heightPt: origH + 4,
        fillColor: 'var(--pt-surface-white)'
      };

      const cmd: Command = {
        description: 'Delete text',
        execute: () => {
          this.whiteoutOriginalTextOnCanvas(textEl);
          this.elements.update(list => [...list.filter(e => e.id !== el.id), coverEl]);
          this.selectedElementId.set(null);
        },
        undo: () => {
          this.elements.update(list => [...list.filter(e => e.id !== coverEl.id), el]);
          this.selectedElementId.set(el.id);
        }
      };
      this.history.execute(cmd);
      return;
    }

    const cmd: Command = {
      description: `Delete ${el.type}`,
      execute: () => {
        this.elements.update(list => list.filter(e => e.id !== el.id));
        this.selectedElementId.set(null);
      },
      undo: () => {
        this.elements.update(list => [...list, el]);
        this.selectedElementId.set(el.id);
      }
    };

    this.history.execute(cmd);
  }

  // Text Property Updaters
  updateTextProperty(field: keyof TextEditElement, value: any): void {
    const el = this.selectedElement();
    if (!el || el.type !== 'text') return;

    const textEl = el as TextEditElement;
    const oldVal = textEl[field];

    const cmd: Command = {
      description: `Change text ${field}`,
      execute: () => {
        this.elements.update(list =>
          list.map(e => (e.id === textEl.id ? { ...e, [field]: value, ...(textEl.isPageTextLine ? { isEdited: true } : {}) } : e))
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e => (e.id === textEl.id ? { ...e, [field]: oldVal } : e))
        );
      }
    };

    this.history.execute(cmd);
  }

  setTextFont(font: string): void {
    this.textFont.set(font);
    this.updateTextProperty('fontFamily', font);
  }

  setTextSize(size: number): void {
    this.textSize.set(size);
    this.updateTextProperty('fontSizePt', size);
  }

  private resolveColorToCss(colorStr?: string): string {
    if (!colorStr) return '#14213D';
    const colorMap: Record<string, string> = {
      'var(--pt-navy)': '#14213D',
      'var(--pt-navy-deep)': '#0D1629',
      'var(--pt-teal-700)': '#0F766E',
      'var(--pt-teal-800)': '#0B5D57',
      'var(--pt-teal-600)': '#14B8A6',
      'var(--pt-coral)': '#E05D44',
      'var(--pt-amber)': '#D97706',
      'var(--pt-surface-white)': '#FFFFFF'
    };
    if (colorMap[colorStr]) return colorMap[colorStr];
    return colorStr;
  }

  private restoreTextSelection(el: TextEditElement): { hasSelection: boolean; activeEl: HTMLElement | null } {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return { hasSelection: false, activeEl: null };
    }
    const activeEl = document.querySelector(`.text-element.selected .canvas-text-content`) as HTMLElement;
    if (!activeEl) return { hasSelection: false, activeEl: null };

    activeEl.focus();

    const sel = window.getSelection();
    if (sel && this.savedTextRange && this.savedTextElementId === el.id) {
      try {
        sel.removeAllRanges();
        sel.addRange(this.savedTextRange);
      } catch {
        // Stale range
      }
    }

    const hasSelection = !!(sel && !sel.isCollapsed && sel.rangeCount > 0);
    return { hasSelection, activeEl };
  }

  toggleTextBold(): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const { hasSelection, activeEl } = this.restoreTextSelection(el);

    if (hasSelection && activeEl) {
      document.execCommand('bold', false);
      el.html = activeEl.innerHTML;
      el.text = activeEl.innerText;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        this.savedTextRange = sel.getRangeAt(0).cloneRange();
      }
      this.elements.update(list => [...list]);
      return;
    }

    const next = !this.isTextBold();
    this.isTextBold.set(next);
    this.updateTextProperty('bold', next);
  }

  toggleTextItalic(): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const { hasSelection, activeEl } = this.restoreTextSelection(el);

    if (hasSelection && activeEl) {
      document.execCommand('italic', false);
      el.html = activeEl.innerHTML;
      el.text = activeEl.innerText;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        this.savedTextRange = sel.getRangeAt(0).cloneRange();
      }
      this.elements.update(list => [...list]);
      return;
    }

    const next = !this.isTextItalic();
    this.isTextItalic.set(next);
    this.updateTextProperty('italic', next);
  }

  toggleTextUnderline(): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const { hasSelection, activeEl } = this.restoreTextSelection(el);

    if (hasSelection && activeEl) {
      document.execCommand('underline', false);
      el.html = activeEl.innerHTML;
      el.text = activeEl.innerText;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        this.savedTextRange = sel.getRangeAt(0).cloneRange();
      }
      this.elements.update(list => [...list]);
      return;
    }

    const next = !this.isTextUnderline();
    this.isTextUnderline.set(next);
    this.updateTextProperty('underline', next);
  }

  setTextAlign(align: 'left' | 'center' | 'right'): void {
    this.textAlign.set(align);
    this.updateTextProperty('align', align);
  }

  setTextColor(color: string): void {
    this.textColor.set(color);
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const { hasSelection, activeEl } = this.restoreTextSelection(el);

    if (hasSelection && activeEl) {
      const cssColor = this.resolveColorToCss(color);
      document.execCommand('foreColor', false, cssColor);
      el.html = activeEl.innerHTML;
      el.text = activeEl.innerText;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        this.savedTextRange = sel.getRangeAt(0).cloneRange();
      }
      this.elements.update(list => [...list]);
      return;
    }

    this.updateTextProperty('color', color);
  }

  onTextContentChange(el: TextEditElement, val: string | { html: string; text: string }): void {
    if (typeof val === 'string') {
      el.text = val;
    } else if (val) {
      el.html = val.html;
      el.text = val.text;
    }
    if (el.isPageTextLine) {
      if (el.originalText === undefined || el.text !== el.originalText) {
        el.isEdited = true;
      }
    }
    this.elements.update(list => [...list]);
  }

  // --- In-Place Page Text Extraction (Character/Line editing) ---
  setEditorMode(mode: 'annotate' | 'edit'): void {
    // Ignore rapid repeated clicks during text extraction
    if (this.isExtractingPageText()) return;
    // No-op if already in the requested mode
    if (this.editorMode() === mode) return;

    if (mode === 'annotate') {
      // Clear selection so no element stays highlighted
      this.selectedElementId.set(null);
      this.editorMode.set('annotate');
    } else {
      // Switching to Edit Text across entire document
      this.editorMode.set('edit');
      const unextractedPages = this.pages().filter(page =>
        !this.elements().some(e => e.pageIndex === page.pageIndex && (e as TextEditElement).isPageTextLine)
      );
      if (unextractedPages.length === 0) {
        this.activeTool.set('select');
        this.selectedElementId.set(null);
        return;
      }
      // Small delay so the slider thumb animation (220ms) completes before
      // the spinner appears — prevents a jarring visual overlap
      setTimeout(() => this.makePageTextEditable(), 80);
    }
  }

  private buildLineSegment(
    items: Array<{ text: string; x: number; width: number; fontSize: number; height: number }>,
    baselineY: number
  ) {
    let fullText = '';
    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      if (j > 0) {
        const prev = items[j - 1];
        const gap = it.x - (prev.x + prev.width);
        if (gap > 1.5) {
          fullText += ' ';
        }
      }
      fullText += it.text;
    }

    const minX = Math.min(...items.map(it => it.x));
    const maxX = Math.max(...items.map(it => it.x + it.width));
    const maxFont = Math.max(...items.map(it => it.fontSize));
    const fontSize = Math.round(maxFont * 10) / 10;
    const y0 = baselineY - fontSize * 0.25;
    const y1 = baselineY + fontSize * 0.85;

    return {
      text: fullText,
      x0: minX,
      x1: maxX,
      width: Math.max(10, maxX - minX),
      baselineY,
      fontSize,
      y0,
      y1
    };
  }

  private async extractTextForSinglePage(page: PageDimensions): Promise<EditElement[]> {
    if (!this.cachedPdfDoc) return [];

    const pdfPage = await this.cachedPdfDoc.getPage(page.pageIndex + 1);
    const textContent = await pdfPage.getTextContent();
    const rawItems = (textContent.items || []).filter(
      (it: any) => it.str && it.str.trim().length > 0
    );

    if (rawItems.length === 0) {
      return [];
    }

    // 1. Convert raw PDF items to structured glyph objects
    interface GlyphItem {
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
    }

    const glyphs: GlyphItem[] = rawItems.map((item: any) => {
      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12;
      const width = item.width || (fontSize * item.str.length * 0.55);
      const height = item.height || fontSize;
      return { text: item.str, x: tx, y: ty, width, height, fontSize };
    });

    const baselineRows: Array<{ baselineY: number; items: GlyphItem[] }> = [];
    for (const g of glyphs) {
      let row = baselineRows.find(r => Math.abs(r.baselineY - g.y) <= 3.0);
      if (row) {
        row.items.push(g);
      } else {
        baselineRows.push({ baselineY: g.y, items: [g] });
      }
    }

    // 2. Within each baseline row, sort left-to-right and split into LineSegments by large horizontal gaps
    interface LineSegment {
      text: string;
      x0: number;
      x1: number;
      width: number;
      baselineY: number;
      fontSize: number;
      y0: number;
      y1: number;
    }

    const lineSegments: LineSegment[] = [];

    for (const row of baselineRows) {
      row.items.sort((a, b) => a.x - b.x);

      let currentSegmentItems: GlyphItem[] = [];

      for (let i = 0; i < row.items.length; i++) {
        const item = row.items[i];
        if (currentSegmentItems.length === 0) {
          currentSegmentItems.push(item);
          continue;
        }

        const prev = currentSegmentItems[currentSegmentItems.length - 1];
        const gap = item.x - (prev.x + prev.width);

        // If gap exceeds 2.0x font size or 16pt, it is a separate column or table cell
        const maxGap = Math.max(16, prev.fontSize * 2.0);
        if (gap > maxGap) {
          lineSegments.push(this.buildLineSegment(currentSegmentItems, row.baselineY));
          currentSegmentItems = [item];
        } else {
          currentSegmentItems.push(item);
        }
      }

      if (currentSegmentItems.length > 0) {
        lineSegments.push(this.buildLineSegment(currentSegmentItems, row.baselineY));
      }
    }

    // Sort line segments from top to bottom (in PDF coordinates, higher baselineY is higher)
    lineSegments.sort((a, b) => b.baselineY - a.baselineY);

    // 3. Semantic Block Clustering: Group vertically adjacent line segments that share column alignment
    //    and typographic scale into unified multi-line Paragraph Blocks
    interface TextBlock {
      lines: LineSegment[];
      x0: number;
      x1: number;
      y0: number;
      y1: number;
      fontSize: number;
    }

    const isBulletLine = (text: string) => {
      const t = text.trim();
      return /^[•\-\*\u2022\u25cf\u25cb\u25aa\u25b8\u2013\u2014]/.test(t);
    };

    const isSectionHeading = (text: string) => {
      const t = text.trim();
      if (t.length >= 3 && t.length <= 50 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
        return true;
      }
      return false;
    };

    const textBlocks: TextBlock[] = [];

    for (const seg of lineSegments) {
      if (!seg.text.trim()) continue;

      const isSegHeading = isSectionHeading(seg.text);
      const isSegBullet = isBulletLine(seg.text);

      let merged = false;

      if (!isSegHeading) {
        for (const block of textBlocks) {
          const firstLine = block.lines[0];
          const lastLine = block.lines[block.lines.length - 1];

          if (isSectionHeading(firstLine.text)) {
            continue;
          }

          const blockHasBullets = block.lines.some(l => isBulletLine(l.text));
          if (!blockHasBullets && isSegBullet) {
            continue;
          }

          const deltaY = lastLine.baselineY - seg.baselineY;
          const avgFont = (lastLine.fontSize + seg.fontSize) / 2;

          const isVerticallyAdjacent = deltaY >= (avgFont * 0.8) && deltaY <= (avgFont * 2.4);

          const overlap = Math.min(block.x1, seg.x1) - Math.max(block.x0, seg.x0);
          const minW = Math.min(block.x1 - block.x0, seg.width);
          const hasColumnOverlap = overlap > 0 && (overlap / minW >= 0.45 || Math.abs(block.x0 - seg.x0) <= 18);

          const isSameFontSize = Math.abs(lastLine.fontSize - seg.fontSize) <= 2.2;

          if (isVerticallyAdjacent && hasColumnOverlap && isSameFontSize) {
            block.lines.push(seg);
            block.x0 = Math.min(block.x0, seg.x0);
            block.x1 = Math.max(block.x1, seg.x1);
            block.y0 = Math.min(block.y0, seg.y0);
            block.y1 = Math.max(block.y1, seg.y1);
            merged = true;
            break;
          }
        }
      }

      if (!merged) {
        textBlocks.push({
          lines: [seg],
          x0: seg.x0,
          x1: seg.x1,
          y0: seg.y0,
          y1: seg.y1,
          fontSize: seg.fontSize
        });
      }
    }

    const generatedElements: EditElement[] = [];

    for (let idx = 0; idx < textBlocks.length; idx++) {
      const block = textBlocks[idx];
      const fullBlockText = block.lines.map(l => l.text).join('\n');
      if (!fullBlockText.trim()) continue;

      const xPt = block.x0;
      const widthPt = Math.max(30, block.x1 - block.x0 + 12);
      const heightPt = Math.max(16, block.y1 - block.y0 + 4);
      const yPt = block.y0 - 2;
      const baselineY = block.lines[0].baselineY;
      const fontSizePt = Math.round(block.fontSize * 10) / 10;

      const textEl: TextEditElement = {
        id: `page-text-${page.pageIndex}-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: page.pageIndex,
        type: 'text',
        isPageTextLine: true,
        isEdited: false,
        originalText: fullBlockText,
        originalXPt: xPt,
        originalYPt: yPt,
        originalWidthPt: widthPt,
        originalHeightPt: heightPt,
        xPt,
        yPt,
        baselineY,
        widthPt,
        heightPt,
        text: fullBlockText,
        fontFamily: 'Inter',
        fontSizePt,
        color: 'var(--pt-navy)'
      };

      generatedElements.push(textEl);
    }

    return generatedElements;
  }

  async makePageTextEditable(targetPageIndex?: number): Promise<void> {
    if (!this.cachedPdfDoc) return;

    const pagesToProcess = targetPageIndex !== undefined
      ? this.pages().filter(p => p.pageIndex === targetPageIndex)
      : this.pages();

    if (pagesToProcess.length === 0) return;

    // Filter to pages that do not yet have extracted text lines
    const unextractedPages = pagesToProcess.filter(page =>
      !this.elements().some(e => e.pageIndex === page.pageIndex && (e as TextEditElement).isPageTextLine)
    );

    if (unextractedPages.length === 0) {
      this.editorMode.set('edit');
      this.activeTool.set('select');
      const targetPage = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
      const existing = this.elements().find(
        e => (e as TextEditElement).isPageTextLine && e.pageIndex === targetPage
      ) || this.elements().find(e => (e as TextEditElement).isPageTextLine);
      if (existing) {
        this.selectedElementId.set(existing.id);
      }
      return;
    }

    this.isExtractingPageText.set(true);
    try {
      const allGeneratedElements: EditElement[] = [];

      for (const page of unextractedPages) {
        try {
          const pageElements = await this.extractTextForSinglePage(page);
          allGeneratedElements.push(...pageElements);
        } catch (pageErr) {
          console.warn(`Could not extract text for page ${page.pageIndex + 1}:`, pageErr);
        }
      }

      if (allGeneratedElements.length === 0) {
        const anyExisting = this.elements().some(e => (e as TextEditElement).isPageTextLine);
        if (!anyExisting) {
          this.errorMessage.set(
            'No digital text found on this page (it appears to be a scanned image). You can recognize text using OCR.'
          );
          this.startOcrRecognition();
        }
        return;
      }

      const cmd: Command = {
        description: targetPageIndex !== undefined
          ? `Make Page ${targetPageIndex + 1} Text Editable`
          : 'Make All Pages Text Editable',
        execute: () => {
          this.elements.update(list => [...list, ...allGeneratedElements]);
          this.editorMode.set('edit');
          this.selectTool('select');
          this.selectedElementId.set(null);
        },
        undo: () => {
          const idsToRemove = new Set(allGeneratedElements.map(e => e.id));
          this.elements.update(list => list.filter(e => !idsToRemove.has(e.id)));
          this.editorMode.set('annotate');
        }
      };

      this.history.execute(cmd);
    } catch (err) {
      console.error('Failed to extract text from pages:', err);
      this.errorMessage.set('Could not extract text from document.');
    } finally {
      this.isExtractingPageText.set(false);
    }
  }

  // --- OCR Cloud Tool Flow ---
  validateOcrPageRange(): boolean {
    const mode = this.ocrPageRange();
    if (mode === 'current' || mode === 'all') {
      this.ocrRangeError.set(null);
      return true;
    }

    const rangeStr = this.ocrCustomRange().trim();
    if (!rangeStr) {
      this.ocrRangeError.set('Please specify page range (e.g. 1-3, 5).');
      return false;
    }

    const total = this.pages().length;
    const parts = rangeStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start < 1 || end > total || start > end) {
          this.ocrRangeError.set(`Invalid range '${trimmed}'. Valid pages are 1 to ${total}.`);
          return false;
        }
      } else {
        const pageNum = parseInt(trimmed, 10);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > total) {
          this.ocrRangeError.set(`Page '${trimmed}' is out of bounds (1-${total}).`);
          return false;
        }
      }
    }

    this.ocrRangeError.set(null);
    return true;
  }

  getSelectedPageIndicesForOcr(): number[] {
    const total = this.pages().length;
    const mode = this.ocrPageRange();

    if (mode === 'current') {
      return [this.currentPageIndex()];
    }
    if (mode === 'all') {
      return Array.from({ length: total }, (_, i) => i);
    }

    // Custom
    const indices = new Set<number>();
    const parts = this.ocrCustomRange().split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10) - 1;
        const end = parseInt(endStr, 10) - 1;
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < total) indices.add(i);
        }
      } else {
        const p = parseInt(trimmed, 10) - 1;
        if (p >= 0 && p < total) indices.add(p);
      }
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  toggleOcrLanguage(code: string): void {
    const current = this.ocrSelectedLanguages();
    if (current.includes(code)) {
      if (current.length > 1) {
        this.ocrSelectedLanguages.set(current.filter(c => c !== code));
      }
    } else {
      if (current.length < 3) {
        this.ocrSelectedLanguages.set([...current, code]);
      }
    }
  }

  async startOcrRecognition(): Promise<void> {
    if (!this.validateOcrPageRange()) return;

    const pageIndices = this.getSelectedPageIndicesForOcr();
    const pageCount = pageIndices.length;
    const bytes = this.currentPdfBytes();
    if (!bytes || pageCount === 0) return;

    // 1. Mandatory Consent Dialog Check
    const consentGranted = await this.uploadConsent.ask({
      actionId: 'edit-pdf-ocr',
      pageCountDescription: `${pageCount} page${pageCount > 1 ? 's' : ''} of this PDF`,
      purposeDescription:
        'Optical Character Recognition (OCR) to detect layout, extract text, and make document content editable.',
      retentionDescription:
        'Uploaded pages are processed in memory and permanently deleted after 10 minutes.'
    });

    if (!consentGranted) {
      return;
    }

    // 2. Build subset PDF (only selected pages leave browser!)
    this.isOcrRunning.set(true);
    this.ocrProgress.set(5);
    this.ocrStatusText.set('Extracting selected pages...');
    this.errorMessage.set(null);

    try {
      const subsetBytes = await this.ocrService.buildPageSubsetPdf(bytes, pageIndices);

      // 3. Send to API and poll
      const result = await this.ocrService.executeOcr(
        subsetBytes,
        {
          languages: this.ocrSelectedLanguages(),
          pages: this.ocrPageRange() === 'all' ? 'all' : pageIndices.map(i => i + 1).join(','),
          deskew: this.ocrDeskew(),
          mode: this.ocrMode()
        },
        update => {
          this.ocrProgress.set(update.progress);
          this.ocrStatusText.set(update.statusText);
        }
      );

      // 4. Apply OCR results to editor as ONE undoable command
      this.applyOcrResultToEditor(result, pageIndices, this.ocrMode());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OCR recognition encountered an error.';
      this.errorMessage.set(msg);
    } finally {
      this.isOcrRunning.set(false);
    }
  }

  cancelOcr(): void {
    this.ocrService.cancel();
    this.isOcrRunning.set(false);
    this.ocrStatusText.set('OCR cancelled.');
  }

  applyOcrResultToEditor(
    result: EditPdfOcrResult,
    targetPageIndices: number[],
    mode: EditPdfOcrMode
  ): void {
    const generatedElements: EditElement[] = [];
    const lowConfWords: LowConfidenceWord[] = [];
    let totalLines = 0;

    for (let i = 0; i < result.pages.length; i++) {
      const pageResult = result.pages[i];
      const actualPageIndex = targetPageIndices[i] ?? pageResult.index;

      if (mode === 'searchable') {
        const layerEl: OcrTextLayerElement = {
          id: `ocr-layer-${actualPageIndex}-${Date.now()}`,
          pageIndex: actualPageIndex,
          type: 'ocr-layer',
          xPt: 0,
          yPt: 0,
          widthPt: pageResult.widthPt,
          heightPt: pageResult.heightPt,
          lines: pageResult.lines,
          language: result.language,
          averageConfidence: result.averageConfidence
        };
        generatedElements.push(layerEl);
        totalLines += pageResult.lines.length;

        for (const line of pageResult.lines) {
          for (const word of line.words) {
            if (word.confidence < 60) {
              lowConfWords.push({
                text: word.text,
                pageIndex: actualPageIndex,
                bbox: word.bbox,
                confidence: word.confidence
              });
            }
          }
        }
      } else {
        interface OcrBlock {
          lines: EditPdfOcrLine[];
          x0: number;
          x1: number;
          y0: number;
          y1: number;
          fontSizePt: number;
          baselineY: number;
          avgConfidence: number;
        }

        const isBulletLine = (text: string) => {
          const t = text.trim();
          return /^[•\-\*\u2022\u25cf\u25cb\u25aa\u25b8\u2013\u2014]/.test(t);
        };

        const isSectionHeading = (text: string) => {
          const t = text.trim();
          if (t.length >= 3 && t.length <= 50 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
            return true;
          }
          return false;
        };

        const ocrBlocks: OcrBlock[] = [];
        const sortedLines = [...pageResult.lines].sort((a, b) => b.bbox[1] - a.bbox[1]);

        for (const line of sortedLines) {
          totalLines++;
          const [lx0, ly0, lx1, ly1] = line.bbox;
          const fontSize = line.fontSizePt || 14;

          const isSegHeading = isSectionHeading(line.text);
          const isSegBullet = isBulletLine(line.text);

          let merged = false;

          if (!isSegHeading) {
            for (const b of ocrBlocks) {
              const firstL = b.lines[0];
              const lastL = b.lines[b.lines.length - 1];

              if (isSectionHeading(firstL.text)) {
                continue;
              }

              const blockHasBullets = b.lines.some(l => isBulletLine(l.text));
              if (!blockHasBullets && isSegBullet) {
                continue;
              }

              const deltaY = lastL.bbox[1] - line.bbox[1];
              const avgFont = (b.fontSizePt + fontSize) / 2;

              const isVerticallyAdjacent = deltaY >= (avgFont * 0.8) && deltaY <= (avgFont * 2.4);
              const overlap = Math.min(b.x1, lx1) - Math.max(b.x0, lx0);
              const minW = Math.min(b.x1 - b.x0, lx1 - lx0);
              const hasOverlap = overlap > 0 && (overlap / minW >= 0.45 || Math.abs(b.x0 - lx0) <= 20);
              const isSameFont = Math.abs(b.fontSizePt - fontSize) <= 2.5;

              if (isVerticallyAdjacent && hasOverlap && isSameFont) {
                b.lines.push(line);
                b.x0 = Math.min(b.x0, lx0);
                b.x1 = Math.max(b.x1, lx1);
                b.y0 = Math.min(b.y0, ly0);
                b.y1 = Math.max(b.y1, ly1);
                merged = true;
                break;
              }
            }
          }

          if (!merged) {
            ocrBlocks.push({
              lines: [line],
              x0: lx0,
              x1: lx1,
              y0: ly0,
              y1: ly1,
              fontSizePt: fontSize,
              baselineY: line.baselineY,
              avgConfidence: line.confidence
            });
          }

          for (const word of line.words) {
            if (word.confidence < 60) {
              lowConfWords.push({
                text: word.text,
                pageIndex: actualPageIndex,
                bbox: word.bbox,
                confidence: word.confidence
              });
            }
          }
        }

        for (const block of ocrBlocks) {
          const w = Math.max(30, block.x1 - block.x0 + 6);
          const h = Math.max(16, block.y1 - block.y0 + 4);
          const fullText = block.lines.map(l => l.text).join('\n');

          const coverEl: WhiteoutEditElement = {
            id: `ocr-cover-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: actualPageIndex,
            type: 'whiteout',
            xPt: Math.max(0, block.x0 - 2),
            yPt: Math.max(0, block.y0 - 2),
            widthPt: w + 4,
            heightPt: h + 4,
            fillColor: 'var(--pt-surface-white)'
          };

          const textEl: TextEditElement = {
            id: `ocr-text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: actualPageIndex,
            type: 'text',
            xPt: block.x0,
            yPt: block.y0,
            widthPt: w,
            heightPt: h,
            text: fullText,
            fontFamily: 'Inter',
            fontSizePt: block.fontSizePt,
            color: 'var(--pt-navy)',
            baselineY: block.baselineY,
            isOcrLine: true,
            isPageTextLine: true,
            ocrConfidence: block.avgConfidence
          };

          generatedElements.push(coverEl, textEl);
        }
      }
    }

    this.lowConfidenceReviewWords.set(lowConfWords);

    const cmd: Command = {
      description: `Recognize Text (${mode === 'searchable' ? 'Searchable' : 'Editable'})`,
      execute: () => {
        this.elements.update(list => [...list, ...generatedElements]);
        if (mode === 'editable') {
          this.editorMode.set('edit');
        }
      },
      undo: () => {
        const idsToRemove = new Set(generatedElements.map(e => e.id));
        this.elements.update(list => list.filter(e => !idsToRemove.has(e.id)));
      }
    };

    this.history.execute(cmd);

    this.ocrSummaryToast.set({
      pagesCount: targetPageIndices.length,
      linesCount: totalLines,
      avgConfidence: result.averageConfidence,
      language: result.language,
      warnings: result.warnings || []
    });
  }

  jumpToLowConfidenceWord(word: LowConfidenceWord): void {
    this.setPageIndex(word.pageIndex);
  }

  dismissToast(): void {
    this.ocrSummaryToast.set(null);
  }

  // --- Export and Download ---
  async saveAndDownload(): Promise<void> {
    const bytes = this.currentPdfBytes();
    if (!bytes) return;

    this.isExporting.set(true);
    this.errorMessage.set(null);

    try {
      const exportedBlob = await this.exportService.exportPdf(
        bytes,
        this.pages(),
        this.elements()
      );

      const downloadUrl = URL.createObjectURL(exportedBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const baseName = this.currentFileName().replace(/\.pdf$/i, '');
      link.download = `${baseName}_edited.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export edited PDF document:', err);
      this.errorMessage.set('Failed to export edited PDF document.');
    } finally {
      this.isExporting.set(false);
    }
  }

  // UI coordinate calculation helper for element bounding boxes on canvas
  getElementScreenRect(el: EditElement) {
    const page = this.pages().find(p => p.pageIndex === el.pageIndex) || this.currentPage();
    if (!page) return { left: '0px', top: '0px', width: '0px', height: '0px' };

    const screenRect = this.transform.pdfRectToScreenRect(
      {
        xPt: el.xPt,
        yPt: el.yPt,
        widthPt: el.widthPt,
        heightPt: el.heightPt
      },
      page,
      this.zoom()
    );

    return {
      left: `${screenRect.x}px`,
      top: `${screenRect.y}px`,
      width: `${screenRect.width}px`,
      height: `${screenRect.height}px`
    };
  }

  getDrawPath(el: DrawEditElement): string {
    if (!el.points || el.points.length === 0) return '';
    // Map PDF points to local SVG coordinate space (top-left 0,0, bottom-right widthPt, heightPt)
    const localPts = el.points.map(p => ({
      x: p.xPt - el.xPt,
      y: (el.yPt + el.heightPt) - p.yPt
    }));

    if (localPts.length === 1) {
      return `M ${localPts[0].x} ${localPts[0].y} L ${localPts[0].x + 0.1} ${localPts[0].y + 0.1}`;
    }
    if (localPts.length === 2) {
      return `M ${localPts[0].x} ${localPts[0].y} L ${localPts[1].x} ${localPts[1].y}`;
    }

    let d = `M ${localPts[0].x} ${localPts[0].y}`;
    for (let i = 1; i < localPts.length - 1; i++) {
      const p0 = localPts[i];
      const p1 = localPts[i + 1];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      d += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
    }
    const last = localPts[localPts.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  // Mobile drawer controls
  toggleMobilePanel(): void {
    this.isSidePanelOpenMobile.update(v => !v);
  }

  closeMobilePanel(): void {
    this.isSidePanelOpenMobile.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
      if (event.shiftKey) {
        if (this.history.canRedo()) {
          event.preventDefault();
          this.history.redo();
        }
      } else {
        if (this.history.canUndo()) {
          event.preventDefault();
          this.history.undo();
        }
      }
    } else if (event.key === 'PageDown' || (event.altKey && event.key === 'ArrowDown')) {
      const target = event.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
        event.preventDefault();
        this.nextPage();
      }
    } else if (event.key === 'PageUp' || (event.altKey && event.key === 'ArrowUp')) {
      const target = event.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
        event.preventDefault();
        this.prevPage();
      }
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      const target = event.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && this.selectedElementId()) {
        event.preventDefault();
        this.deleteSelectedElement();
      }
    }
  }
}
