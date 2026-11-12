import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ElementRef,
  ViewChild,
  HostListener,
  ViewEncapsulation
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
import { repairMojibakeFilename } from '@paperflow/sign-core';
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
  TextLineBounds,
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
import { PdfTextExtractionService } from './services/pdf-text-extraction.service';
import { ElementOperationsService } from './services/element-operations.service';
import { OcrWorkflowService } from './services/ocr-workflow.service';
import { CanvasInteractionService } from './services/canvas-interaction.service';
import { TextFormattingService } from './services/text-formatting.service';
import { PdfRenderingService } from './services/pdf-rendering.service';
import { FreehandDrawingService, LiveHighlightRect } from './services/freehand-drawing.service';
import { ViewportNavigationService } from './services/viewport-navigation.service';
import { ContentEditableModelDirective } from './directives/content-editable-model.directive';
import { EditPdfTopNavComponent } from './components/edit-pdf-top-nav/edit-pdf-top-nav.component';
import { EditPdfHeroComponent } from './components/edit-pdf-hero/edit-pdf-hero.component';
import { PdfThumbnailsPanelComponent } from './components/pdf-thumbnails-panel/pdf-thumbnails-panel.component';
import { PdfBottomBarComponent } from './components/pdf-bottom-bar/pdf-bottom-bar.component';
import { ToolsGridComponent } from './components/tools-grid/tools-grid.component';
import { ShapePanelComponent } from './components/panels/shape-panel/shape-panel.component';
import { TextPanelComponent } from './components/panels/text-panel/text-panel.component';
import { DrawPanelComponent } from './components/panels/draw-panel/draw-panel.component';
import { HighlightPanelComponent } from './components/panels/highlight-panel/highlight-panel.component';
import { WhiteoutPanelComponent } from './components/panels/whiteout-panel/whiteout-panel.component';
import { ImagePanelComponent } from './components/panels/image-panel/image-panel.component';
import { SignPanelComponent } from './components/panels/sign-panel/sign-panel.component';
import { LinkPanelComponent } from './components/panels/link-panel/link-panel.component';
import { OcrPanelComponent } from './components/panels/ocr-panel/ocr-panel.component';
import { ElementInfoPanelComponent } from './components/panels/element-info-panel/element-info-panel.component';
import { AreaSelectionService } from './services/area-selection.service';
import { SelectionOverlayComponent } from './components/selection-overlay/selection-overlay.component';
import { SelectionPanelComponent } from './components/panels/selection-panel/selection-panel.component';

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
    ContentEditableModelDirective,
    EditPdfHeroComponent,
    PdfThumbnailsPanelComponent,
    PdfBottomBarComponent,
    ToolsGridComponent,
    EditPdfTopNavComponent,
    ShapePanelComponent,
    TextPanelComponent,
    DrawPanelComponent,
    HighlightPanelComponent,
    WhiteoutPanelComponent,
    ImagePanelComponent,
    SignPanelComponent,
    LinkPanelComponent,
    OcrPanelComponent,
    ElementInfoPanelComponent,
    SelectionOverlayComponent,
    SelectionPanelComponent
  ],
  templateUrl: './edit-pdf.component.html',
  styleUrl: './edit-pdf.component.css',
  encapsulation: ViewEncapsulation.None
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
  private textExtraction = inject(PdfTextExtractionService);
  private elementOps = inject(ElementOperationsService);
  private ocrWorkflow = inject(OcrWorkflowService);
  private canvasInteraction = inject(CanvasInteractionService);
  private textFormatting = inject(TextFormattingService);
  private pdfRendering = inject(PdfRenderingService);
  private freehandDrawing = inject(FreehandDrawingService);
  private viewportNav = inject(ViewportNavigationService);
  readonly areaSelectionService = inject(AreaSelectionService);
  private wasMarqueeDragged = false;

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
  @ViewChild(SignPanelComponent) signPanel?: SignPanelComponent;

  // Document state
  readonly viewMode = signal<EditorViewMode>('upload');
  readonly currentPdfBytes = signal<Uint8Array | null>(null);
  readonly currentFileName = signal<string>('document.pdf');
  readonly displayFileName = computed(() => repairMojibakeFilename(this.currentFileName()));
  readonly pages = signal<PageDimensions[]>([]);
  readonly currentPageIndex = signal<number>(0);
  readonly zoom = signal<number>(0.85);
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
  readonly activeTool = signal<EditToolType | null>('select');

  // Text Properties
  readonly textFont = signal<string>('Inter');
  readonly textSize = signal<number>(15);
  readonly textColor = signal<string>('var(--pt-navy)');
  readonly isTextBold = signal<boolean>(false);
  readonly isTextItalic = signal<boolean>(false);
  readonly isTextUnderline = signal<boolean>(false);
  readonly isTextStrikeout = signal<boolean>(false);
  readonly textAlign = signal<'left' | 'center' | 'right'>('left');
  readonly textCustomColor = signal<string>('#14213D');
  readonly showTextLinkInput = signal<boolean>(false);
  readonly textLinkUrl = signal<string>('https://');
  readonly isTextLinked = signal<boolean>(false);

  // Shape Properties
  readonly shapeType = signal<'rectangle' | 'circle' | 'line' | 'arrow' | 'star' | 'polygon'>('rectangle');
  // Custom Shape (Polygon) Maker State
  readonly draftPolygonPoints = signal<Array<{ xPt: number; yPt: number }>>([]);
  readonly draftPolygonPageIndex = signal<number | null>(null);
  readonly draftPolygonCursor = signal<{ xScreen: number; yScreen: number } | null>(null);
  readonly strokeColor = signal<string>('var(--pt-navy)');
  readonly fillColor = signal<string>('transparent');
  readonly strokeWidth = signal<number>(2);

  // Draw Properties
  readonly drawStrokeWidth = signal<number>(2);
  readonly drawColor = signal<string>('var(--pt-teal-700)');
  readonly isDrawingActive = signal<boolean>(false);
  readonly activeDrawingPath = signal<string>('');
  private isDrawing = false;

  // Highlight Properties
  readonly highlightColor = signal<string>('var(--pt-amber)');
  readonly highlightOpacity = signal<number>(0.35);
  readonly highlightCustomColor = signal<string>('#F59E0B');
  readonly liveHighlightRect = signal<{ x: number; y: number; width: number; height: number; pageIndex: number } | null>(null);
  private isHighlighting = false;
  private highlightStartPos = { x: 0, y: 0 };
  private highlightPageIndex = 0;
  private justFinishedHighlightDrag = false;

  // Signature Studio Properties
  readonly signatureTab = signal<'type' | 'draw' | 'upload'>('type');
  readonly signatureText = signal<string>('John Doe');
  readonly signatureFont = signal<string>("'Dancing Script', cursive");
  readonly signatureColor = signal<string>('var(--pt-navy)');
  readonly signatureSize = signal<number>(26);
  readonly signatureCustomColor = signal<string>('#14213D');
  readonly signatureDrawnDataUrl = signal<string | null>(null);

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

  // Element rotation state
  isRotatingElement = false;
  private rotatingElementId: string | null = null;
  private rotateStartAngle = 0;
  private rotateCenter: { x: number; y: number } = { x: 0, y: 0 };
  private rotateStartMouseAngle = 0;
  private hasRotatedMoved = false;

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
    const firstPg = pageList[0];
    if (firstPg) {
      this.zoom.set(
        this.viewportNav.computeFitWidthZoom(this.transform.getPageDisplaySize(firstPg, 1.0).width)
      );
    }
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
    const thumbs = await this.pdfRendering.generateThumbnails(this.cachedPdfDoc);
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
    if (this.wasMarqueeDragged) {
      this.wasMarqueeDragged = false;
      return;
    }
    this.onCanvasClick(event, pageIndex);
  }

  onPageMouseDown(pageIndex: number, event: MouseEvent): void {
    this.currentPageIndex.set(pageIndex);
    if (this.activeTool() === 'highlight' && event.button === 0) {
      event.preventDefault();
      this.startHighlightDrag(pageIndex, event.clientX, event.clientY);
      return;
    }
    if (this.activeTool() === 'select' && this.editorMode() === 'annotate' && event.button === 0) {
      this.selectedElementId.set(null);
      const pageEl = document.getElementById(`pdf-page-${pageIndex}`);
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect();
        this.areaSelectionService.startMarquee(pageIndex, event.clientX - rect.left, event.clientY - rect.top);
        this.wasMarqueeDragged = false;
      }
      return;
    }
    this.activeDrawingPageIndex.set(pageIndex);
    this.onCanvasMouseDown(event);
  }

  onPageMouseMove(pageIndex: number, event: MouseEvent): void {
    if (this.areaSelectionService.marquee()) {
      const pageEl = document.getElementById(`pdf-page-${pageIndex}`);
      if (pageEl) {
        this.wasMarqueeDragged = true;
        const rect = pageEl.getBoundingClientRect();
        this.areaSelectionService.updateMarquee(event.clientX - rect.left, event.clientY - rect.top);
      }
      return;
    }
    if (this.activeTool() === 'shapes' && this.shapeType() === 'polygon' && this.draftPolygonPoints().length > 0) {
      if (this.draftPolygonPageIndex() === pageIndex) {
        const canvas = (document.getElementById(`pdf-canvas-${pageIndex}`) as HTMLCanvasElement | null)
          || this.pageCanvasRef?.nativeElement;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          this.draftPolygonCursor.set({
            xScreen: event.clientX - rect.left,
            yScreen: event.clientY - rect.top
          });
        }
      }
    }
    if (this.isHighlighting) {
      this.moveHighlightDrag(event.clientX, event.clientY);
      return;
    }
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
    if (this.activeTool() === 'highlight' && event.touches.length > 0) {
      event.preventDefault();
      const t = event.touches[0];
      this.startHighlightDrag(pageIndex, t.clientX, t.clientY);
      return;
    }
    if (this.activeTool() === 'select' && this.editorMode() === 'annotate' && event.touches.length > 0) {
      this.selectedElementId.set(null);
      const t = event.touches[0];
      const pageEl = document.getElementById(`pdf-page-${pageIndex}`);
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect();
        this.areaSelectionService.startMarquee(pageIndex, t.clientX - rect.left, t.clientY - rect.top);
        this.wasMarqueeDragged = false;
      }
      return;
    }
    this.activeDrawingPageIndex.set(pageIndex);
    this.onCanvasTouchStart(event);
  }

  onPageTouchMove(pageIndex: number, event: TouchEvent): void {
    if (this.areaSelectionService.marquee() && event.touches.length > 0) {
      const t = event.touches[0];
      const pageEl = document.getElementById(`pdf-page-${pageIndex}`);
      if (pageEl) {
        this.wasMarqueeDragged = true;
        const rect = pageEl.getBoundingClientRect();
        this.areaSelectionService.updateMarquee(t.clientX - rect.left, t.clientY - rect.top);
      }
      return;
    }
    if (this.isHighlighting && event.touches.length > 0) {
      event.preventDefault();
      const t = event.touches[0];
      this.moveHighlightDrag(t.clientX, t.clientY);
      return;
    }
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
        const ctx = await this.pdfRendering.renderPageToCanvas(
          this.cachedPdfDoc,
          pageInfo,
          canvas,
          dpr,
          this.zoom()
        );

        if (ctx) {
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
   * Uses precise per-line bounds so that nearby table lines, horizontal rules, and borders remain intact.
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

    if (!textEl.backgroundColor) {
      const overlappingHighlight = this.elements().find(el =>
        el.type === 'highlight' &&
        el.pageIndex === pageIndex &&
        !(
          textEl.xPt + textEl.widthPt < el.xPt ||
          textEl.xPt > el.xPt + el.widthPt ||
          textEl.yPt + textEl.heightPt < el.yPt ||
          textEl.yPt > el.yPt + el.heightPt
        )
      ) as HighlightEditElement | undefined;

      if (overlappingHighlight) {
        textEl.backgroundColor = overlappingHighlight.color || '#fef08a';
      }
    }

    this.pdfRendering.whiteoutOriginalText(textEl, ctx, pageInfo, dpr, this.zoom());
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
    this.scrollToPage(this.viewportNav.prevPage(this.currentPageIndex()));
  }

  nextPage(): void {
    this.scrollToPage(this.viewportNav.nextPage(this.currentPageIndex(), this.pages().length));
  }

  zoomIn(): void {
    this.zoom.set(this.viewportNav.zoomIn(this.zoom()));
    setTimeout(() => this.renderCurrentPageToCanvas(), 20);
  }

  zoomOut(): void {
    this.zoom.set(this.viewportNav.zoomOut(this.zoom()));
    setTimeout(() => this.renderCurrentPageToCanvas(), 20);
  }

  resetZoom(): void {
    const active = this.pages()[this.currentPageIndex()] || this.pages()[0];
    const widthAt100 = active ? this.transform.getPageDisplaySize(active, 1.0).width : undefined;
    this.zoom.set(this.viewportNav.resetZoom(widthAt100));
    setTimeout(() => this.renderCurrentPageToCanvas(), 20);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.viewMode() !== 'editor' || typeof window === 'undefined') return;
    const active = this.pages()[this.currentPageIndex()] || this.pages()[0];
    if (!active) return;
    const widthAt100 = this.transform.getPageDisplaySize(active, 1.0).width;
    if (window.innerWidth <= 768) {
      const fit = this.viewportNav.computeFitWidthZoom(widthAt100, window.innerWidth);
      if (this.zoom() * widthAt100 > window.innerWidth - 20) {
        this.zoom.set(fit);
        setTimeout(() => this.renderCurrentPageToCanvas(), 20);
      }
    }
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
        this.elements.update(list =>
          list
            .filter(e => e.pageIndex !== pageIndex)
            .map(e => (e.pageIndex > pageIndex ? { ...e, pageIndex: e.pageIndex - 1 } : e))
        );
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
        this.elements.update(list => {
          const shifted = list.map(e => (e.pageIndex >= pageIndex ? { ...e, pageIndex: e.pageIndex + 1 } : e));
          return [...shifted, ...removedElements];
        });
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
    // If the clicked tool is already active, deselect it (toggle off to null)
    if (this.activeTool() === tool) {
      if (this.draftPolygonPoints().length > 0) {
        this.cancelPolygonShape();
      }
      if (this.isDrawing) {
        this.isDrawing = false;
        this.isDrawingActive.set(false);
      }
      this.selectedElementId.set(null);
      this.areaSelectionService.clearSelection();
      this.activeTool.set(null);
      return;
    }

    if (this.draftPolygonPoints().length > 0 && tool !== 'shapes') {
      this.cancelPolygonShape();
    }
    if (this.isDrawing && tool !== 'draw') {
      this.isDrawing = false;
      this.isDrawingActive.set(false);
    }
    this.activeTool.set(tool);
    if (tool !== 'select') {
      this.selectedElementId.set(null);
      this.areaSelectionService.clearSelection();
    }
  }

  onCanvasClick(event: MouseEvent, targetPageIndex?: number): void {
    if (this.isDrawing || this.justFinishedHighlightDrag) return;
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
      case 'select':
      case null:
        if (!this.wasMarqueeDragged) {
          this.areaSelectionService.clearSelection();
          this.selectedElementId.set(null);
        }
        break;
      case 'text':
        this.addTextElement(pdfPt.xPt, pdfPt.yPt, page.pageIndex);
        break;
      case 'shapes':
        if (this.shapeType() === 'polygon') {
          this.handlePolygonCanvasClick(pdfPt, { x: screenX, y: screenY }, page.pageIndex);
        } else {
          this.addShapeElement(pdfPt.xPt, pdfPt.yPt, page.pageIndex);
        }
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
    if (this.activeTool() !== 'draw') return;
    this.startDrawing(event.clientX, event.clientY);
  }

  handleDragOrResizeMove(event: MouseEvent): void {
    if (this.isRotatingElement && this.rotatingElementId) {
      this.handleRotateMove(event);
      return;
    }
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
      const moved = this.canvasInteraction.calculateDragMove(
        dxScreen,
        dyScreen,
        this.zoom(),
        this.dragStartElementPos
      );

      this.elements.update(list =>
        list.map(e =>
          e.id === this.draggedElementId
            ? { ...e, xPt: moved.xPt, yPt: moved.yPt }
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
      const isPreserveAspect = resizingEl.type === 'image' || resizingEl.type === 'sign';

      const resized = this.canvasInteraction.calculateResize(
        this.resizeHandle,
        dx,
        dy,
        startScreen,
        isPreserveAspect,
        page,
        this.zoom()
      );

      this.elements.update(list =>
        list.map(e =>
          e.id === this.resizingElementId
            ? { ...e, ...resized }
            : e
        )
      );
    }
  }

  finishDragOrResize(): void {
    if (this.isRotatingElement) {
      this.finishRotate();
      return;
    }
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

  changeFile(): void {
    if (this.elements().length > 0 && this.viewMode() === 'editor') {
      const ok = window.confirm('You have unsaved edits in your document. Are you sure you want to change file?');
      if (!ok) return;
    }
    this.elements.set([]);
    this.history.clear();
    this.selectedElementId.set(null);
    this.currentPdfBytes.set(null);
    this.currentFileName.set('document.pdf');
    this.pages.set([]);
    this.viewMode.set('upload');
    this.layoutService.showFooter();
  }

  canDeactivate(): boolean {
    if (this.elements().length > 0 && this.viewMode() === 'editor') {
      return window.confirm('You have unsaved edits in your document. Are you sure you want to leave?');
    }
    return true;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.elements().length > 0 && this.viewMode() === 'editor') {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (this.isHighlighting) {
      this.moveHighlightDrag(event.clientX, event.clientY);
      return;
    }
    if (this.isDraggingElement || this.isResizingElement || this.isRotatingElement) {
      this.handleDragOrResizeMove(event);
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    if (this.areaSelectionService.marquee()) {
      const m = this.areaSelectionService.marquee();
      if (m) {
        const page = this.pages().find(p => p.pageIndex === m.pageIndex);
        if (page) {
          const pageElements = this.getElementsByPage(m.pageIndex);
          this.areaSelectionService.finishMarquee(page, pageElements, this.zoom());
        } else {
          this.areaSelectionService.clearSelection();
        }
      }
      return;
    }
    if (this.isHighlighting) {
      this.finishHighlightDrag();
      return;
    }
    if (this.isDraggingElement || this.isResizingElement || this.isRotatingElement) {
      this.finishDragOrResize();
    }
    if (this.isDrawing) {
      this.endDrawing();
    }
  }

  @HostListener('window:touchend')
  onWindowTouchEnd(): void {
    if (this.areaSelectionService.marquee()) {
      const m = this.areaSelectionService.marquee();
      if (m) {
        const page = this.pages().find(p => p.pageIndex === m.pageIndex);
        if (page) {
          const pageElements = this.getElementsByPage(m.pageIndex);
          this.areaSelectionService.finishMarquee(page, pageElements, this.zoom());
        } else {
          this.areaSelectionService.clearSelection();
        }
      }
      return;
    }
    if (this.isHighlighting) {
      this.finishHighlightDrag();
      return;
    }
    if (this.isDraggingElement || this.isResizingElement || this.isRotatingElement) {
      this.finishDragOrResize();
    }
    if (this.isDrawing) {
      this.endDrawing();
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.isHighlighting) {
      this.moveHighlightDrag(event.clientX, event.clientY);
      return;
    }
    if (this.isDraggingElement || this.isResizingElement || this.isRotatingElement) {
      this.handleDragOrResizeMove(event);
      return;
    }

    if (!this.isDrawing || this.activeTool() !== 'draw') return;
    this.moveDrawing(event.clientX, event.clientY);
  }

  onCanvasMouseUp(): void {
    if (this.areaSelectionService.marquee()) {
      const m = this.areaSelectionService.marquee();
      if (m) {
        const page = this.pages().find(p => p.pageIndex === m.pageIndex);
        if (page) {
          const pageElements = this.getElementsByPage(m.pageIndex);
          this.areaSelectionService.finishMarquee(page, pageElements, this.zoom());
        } else {
          this.areaSelectionService.clearSelection();
        }
      }
      return;
    }
    if (this.isHighlighting) {
      this.finishHighlightDrag();
      return;
    }
    if (this.isDraggingElement || this.isResizingElement || this.isRotatingElement) {
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
    if (this.isHighlighting && event.touches.length > 0) {
      event.preventDefault();
      const t = event.touches[0];
      this.moveHighlightDrag(t.clientX, t.clientY);
      return;
    }
    if (!this.isDrawing || this.activeTool() !== 'draw') return;
    if (event.touches.length > 0) {
      event.preventDefault();
      const t = event.touches[0];
      this.moveDrawing(t.clientX, t.clientY);
    }
  }

  onCanvasTouchEnd(): void {
    if (this.areaSelectionService.marquee()) {
      const m = this.areaSelectionService.marquee();
      if (m) {
        const page = this.pages().find(p => p.pageIndex === m.pageIndex);
        if (page) {
          const pageElements = this.getElementsByPage(m.pageIndex);
          this.areaSelectionService.finishMarquee(page, pageElements, this.zoom());
        } else {
          this.areaSelectionService.clearSelection();
        }
      }
      return;
    }
    if (this.isHighlighting) {
      this.finishHighlightDrag();
      return;
    }
    if (this.isDraggingElement || this.isResizingElement || this.isRotatingElement) {
      this.finishDragOrResize();
      return;
    }
    this.endDrawing();
  }

  private startHighlightDrag(pageIndex: number, clientX: number, clientY: number): void {
    const pageEl = document.getElementById(`pdf-page-${pageIndex}`);
    if (!pageEl) return;
    this.isHighlighting = true;
    this.highlightPageIndex = pageIndex;
    const initialRect = this.freehandDrawing.startHighlightDrag(
      pageIndex,
      clientX,
      clientY,
      pageEl.getBoundingClientRect()
    );
    this.liveHighlightRect.set(initialRect);
  }

  private moveHighlightDrag(clientX: number, clientY: number): void {
    if (!this.isHighlighting) return;
    const pageEl = document.getElementById(`pdf-page-${this.highlightPageIndex}`);
    if (!pageEl) return;
    const rect = this.freehandDrawing.moveHighlightDrag(
      clientX,
      clientY,
      pageEl.getBoundingClientRect()
    );
    if (rect) {
      this.liveHighlightRect.set(rect);
    }
  }

  private finishHighlightDrag(): void {
    if (!this.isHighlighting) return;
    this.isHighlighting = false;
    const liveRect = this.liveHighlightRect();
    this.liveHighlightRect.set(null);

    const pageIndex = this.highlightPageIndex;
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement = this.freehandDrawing.finishHighlightDrag(
      liveRect,
      page,
      this.zoom(),
      this.highlightColor(),
      this.highlightOpacity()
    );

    if (newElement) {
      this.justFinishedHighlightDrag = true;
      setTimeout(() => {
        this.justFinishedHighlightDrag = false;
      }, 150);

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
    const path = this.freehandDrawing.startDrawing(screenX, screenY);
    this.activeDrawingPath.set(path);
  }

  private moveDrawing(clientX: number, clientY: number): void {
    const pageIndex = this.activeDrawingPageIndex();
    const canvas = (document.getElementById(`pdf-canvas-${pageIndex}`) as HTMLCanvasElement | null)
      || this.pageCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const path = this.freehandDrawing.moveDrawing(clientX - rect.left, clientY - rect.top);
    if (path) {
      this.activeDrawingPath.set(path);
    }
  }

  private endDrawing(): void {
    if (this.isDraggingElement || this.isResizingElement || this.isRotatingElement) {
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

    const newElement = this.freehandDrawing.finishDrawing(
      page,
      this.zoom(),
      this.drawColor(),
      this.drawStrokeWidth()
    );

    if (!newElement) {
      this.activeDrawingPath.set('');
      return;
    }

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
  }

  screenPointsToSmoothSvgPath(points: Array<{ x: number; y: number }>): string {
    return this.canvasInteraction.smoothSplinePoints(points);
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

  onRotateHandleMouseDown(el: EditElement, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.selectElement(el, event);
    this.isRotatingElement = true;
    this.rotatingElementId = el.id;
    this.rotateStartAngle = el.rotation || 0;
    this.hasRotatedMoved = false;

    const target = event.currentTarget as HTMLElement | null;
    const canvasElement = target?.closest('.canvas-element') as HTMLElement | null;
    if (canvasElement) {
      const rect = canvasElement.getBoundingClientRect();
      this.rotateCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    } else {
      this.rotateCenter = { x: event.clientX, y: event.clientY };
    }

    this.rotateStartMouseAngle = Math.atan2(
      event.clientY - this.rotateCenter.y,
      event.clientX - this.rotateCenter.x
    ) * (180 / Math.PI);
  }

  handleRotateMove(event: MouseEvent): void {
    if (!this.isRotatingElement || !this.rotatingElementId) return;
    const el = this.elements().find(e => e.id === this.rotatingElementId);
    if (!el) return;

    const currentMouseAngle = Math.atan2(
      event.clientY - this.rotateCenter.y,
      event.clientX - this.rotateCenter.x
    ) * (180 / Math.PI);

    const deltaAngle = currentMouseAngle - this.rotateStartMouseAngle;
    if (Math.abs(deltaAngle) > 2) {
      this.hasRotatedMoved = true;
    }

    let newAngle = Math.round((this.rotateStartAngle + deltaAngle) % 360);
    if (newAngle < 0) newAngle += 360;

    if (event.shiftKey) {
      newAngle = Math.round(newAngle / 15) * 15;
    } else {
      if (Math.abs(newAngle - 0) <= 3 || Math.abs(newAngle - 360) <= 3) newAngle = 0;
      else if (Math.abs(newAngle - 90) <= 3) newAngle = 90;
      else if (Math.abs(newAngle - 180) <= 3) newAngle = 180;
      else if (Math.abs(newAngle - 270) <= 3) newAngle = 270;
    }

    this.elements.update(list =>
      list.map(e => (e.id === el.id ? { ...e, rotation: newAngle } : e))
    );
  }

  finishRotate(): void {
    if (!this.isRotatingElement || !this.rotatingElementId) return;

    const elId = this.rotatingElementId;
    const oldAngle = this.rotateStartAngle;
    const currentEl = this.elements().find(e => e.id === elId);
    const finalAngle = currentEl?.rotation || 0;

    this.isRotatingElement = false;
    this.rotatingElementId = null;

    if (!this.hasRotatedMoved) {
      this.rotateSelectedElement(90);
      return;
    }

    if (finalAngle !== oldAngle) {
      const cmd: Command = {
        description: `Rotate element to ${finalAngle}°`,
        execute: () => {
          this.elements.update(list =>
            list.map(e => (e.id === elId ? { ...e, rotation: finalAngle } : e))
          );
        },
        undo: () => {
          this.elements.update(list =>
            list.map(e => (e.id === elId ? { ...e, rotation: oldAngle } : e))
          );
        }
      };
      this.history.execute(cmd);
    }
  }

  rotateSelectedElement(delta = 90): void {
    const el = this.selectedElement();
    if (!el) return;

    const oldAngle = el.rotation || 0;
    const newAngle = ((oldAngle + delta) % 360 + 360) % 360;

    const cmd: Command = {
      description: `Rotate element by ${delta}°`,
      execute: () => {
        this.elements.update(list =>
          list.map(e => (e.id === el.id ? { ...e, rotation: newAngle } : e))
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e => (e.id === el.id ? { ...e, rotation: oldAngle } : e))
        );
      }
    };
    this.history.execute(cmd);
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

      const range = sel.getRangeAt(0);
      let parent: Node | null = range.commonAncestorContainer;
      if (parent && parent.nodeType === Node.TEXT_NODE) parent = parent.parentElement;
      const anchor = (parent as HTMLElement)?.closest?.('a');
      if (anchor) {
        this.isTextLinked.set(true);
        const href = anchor.getAttribute('href');
        if (href) this.textLinkUrl.set(href);
      } else {
        this.isTextLinked.set(false);
      }
    }
  }

  // --- Element Creators & Setters ---
  addTextElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement = this.elementOps.createTextElement(page, {
      xPt,
      yPt,
      fontFamily: this.textFont(),
      fontSizePt: this.textSize(),
      color: this.textColor(),
      bold: this.isTextBold(),
      italic: this.isTextItalic()
    });

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

  setShapeType(type: 'rectangle' | 'circle' | 'line' | 'arrow' | 'star' | 'polygon'): void {
    if (type !== 'polygon') {
      this.cancelPolygonShape();
    }
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

    const newElement = this.elementOps.createShapeElement(page, {
      shapeType: this.shapeType(),
      strokeColor: this.strokeColor(),
      fillColor: this.fillColor(),
      strokeWidth: this.strokeWidth(),
      xPt,
      yPt
    });

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

  handlePolygonCanvasClick(
    pdfPt: { xPt: number; yPt: number },
    screenPt: { x: number; y: number },
    pageIndex: number
  ): void {
    const currentPoints = this.draftPolygonPoints();
    const currentPageIdx = this.draftPolygonPageIndex();

    if (currentPageIdx !== null && currentPageIdx !== pageIndex) {
      this.cancelPolygonShape();
    }

    const page = this.pages()[pageIndex] || this.currentPage();
    if (currentPoints.length >= 3 && page) {
      const startScreen = this.transform.pdfPointToScreenPoint(currentPoints[0], page, this.zoom());
      const dist = Math.hypot(screenPt.x - startScreen.x, screenPt.y - startScreen.y);
      if (dist <= 22) {
        this.finishPolygonShape();
        return;
      }
    }

    this.draftPolygonPageIndex.set(pageIndex);
    this.draftPolygonPoints.update(pts => [...pts, { xPt: pdfPt.xPt, yPt: pdfPt.yPt }]);
  }

  onPageDblClick(pageIndex: number, event: MouseEvent): void {
    if (this.activeTool() === 'shapes' && this.shapeType() === 'polygon') {
      if (this.draftPolygonPoints().length >= 3) {
        event.preventDefault();
        event.stopPropagation();
        this.finishPolygonShape();
      }
    }
  }

  finishPolygonShape(): void {
    const currentPoints = this.draftPolygonPoints();
    const pageIndex = this.draftPolygonPageIndex();
    if (currentPoints.length < 3 || pageIndex === null) {
      return;
    }

    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const screenPoints = currentPoints.map(p => this.transform.pdfPointToScreenPoint(p, page, this.zoom()));
    const screenXs = screenPoints.map(p => p.x);
    const screenYs = screenPoints.map(p => p.y);
    const minScreenX = Math.min(...screenXs);
    const maxScreenX = Math.max(...screenXs);
    const minScreenY = Math.min(...screenYs);
    const maxScreenY = Math.max(...screenYs);

    const screenWidth = Math.max(20, maxScreenX - minScreenX);
    const screenHeight = Math.max(20, maxScreenY - minScreenY);

    const normalizedPoints = screenPoints.map(p => ({
      x: Math.round(((p.x - minScreenX) / screenWidth) * 100 * 10) / 10,
      y: Math.round(((p.y - minScreenY) / screenHeight) * 100 * 10) / 10
    }));

    const pdfRect = this.transform.screenRectToPdfRect(
      { x: minScreenX, y: minScreenY, width: screenWidth, height: screenHeight },
      page,
      this.zoom()
    );

    const newElement = this.elementOps.createShapeElement(page, {
      shapeType: 'polygon',
      strokeColor: this.strokeColor(),
      fillColor: this.fillColor(),
      strokeWidth: this.strokeWidth(),
      xPt: pdfRect.xPt,
      yPt: pdfRect.yPt,
      widthPt: pdfRect.widthPt,
      heightPt: pdfRect.heightPt,
      points: normalizedPoints
    });
    newElement.pageIndex = pageIndex;

    const cmd: Command = {
      description: 'Add Custom Polygon Shape',
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
    this.cancelPolygonShape();
  }

  cancelPolygonShape(): void {
    this.draftPolygonPoints.set([]);
    this.draftPolygonPageIndex.set(null);
    this.draftPolygonCursor.set(null);
  }

  getPolygonPoints(el: ShapeEditElement): string {
    const pts = (el.points && el.points.length >= 3)
      ? el.points
      : [
        { x: 50, y: 0 },
        { x: 95, y: 25 },
        { x: 95, y: 75 },
        { x: 50, y: 100 },
        { x: 5, y: 75 },
        { x: 5, y: 25 }
      ];
    return pts.map(p => `${p.x},${p.y}`).join(' ');
  }

  getDraftScreenPoints(page: PageDimensions): Array<{ x: number; y: number }> {
    return this.draftPolygonPoints().map(p =>
      this.transform.pdfPointToScreenPoint(p, page, this.zoom())
    );
  }

  getDraftPolylinePoints(page: PageDimensions): string {
    return this.getDraftScreenPoints(page).map(sp => `${sp.x},${sp.y}`).join(' ');
  }

  getDraftFirstScreenPoint(page: PageDimensions): { x: number; y: number } | null {
    const pts = this.getDraftScreenPoints(page);
    return pts.length > 0 ? pts[0] : null;
  }

  getDraftLastScreenPoint(page: PageDimensions): { x: number; y: number } | null {
    const pts = this.getDraftScreenPoints(page);
    return pts.length > 0 ? pts[pts.length - 1] : null;
  }

  isDraftCursorNearStart(page: PageDimensions): boolean {
    const start = this.getDraftFirstScreenPoint(page);
    const cursor = this.draftPolygonCursor();
    if (!start || !cursor || this.draftPolygonPoints().length < 2) return false;
    return Math.hypot(cursor.xScreen - start.x, cursor.yScreen - start.y) <= 22;
  }

  addHighlightElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement = this.elementOps.createHighlightElement(page, {
      xPt,
      yPt,
      color: this.highlightColor(),
      opacity: this.highlightOpacity()
    });

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

  setHighlightColor(color: string): void {
    this.highlightColor.set(color);
    if (color && !color.startsWith('var(')) {
      this.highlightCustomColor.set(color);
    }
    const el = this.selectedElement();
    if (el && el.type === 'highlight') {
      const hlEl = el as HighlightEditElement;
      const oldColor = hlEl.color;
      if (oldColor === color) return;
      const cmd: Command = {
        description: 'Change Highlight Color',
        execute: () => {
          this.elements.update(list =>
            list.map(e => (e.id === hlEl.id ? { ...e, color } : e))
          );
        },
        undo: () => {
          this.elements.update(list =>
            list.map(e => (e.id === hlEl.id ? { ...e, color: oldColor } : e))
          );
        }
      };
      this.history.execute(cmd);
    }
  }

  setHighlightOpacity(opacity: number): void {
    this.highlightOpacity.set(opacity);
    const el = this.selectedElement();
    if (el && el.type === 'highlight') {
      const hlEl = el as HighlightEditElement;
      const oldOpacity = hlEl.opacity;
      if (oldOpacity === opacity) return;
      const cmd: Command = {
        description: 'Change Highlight Opacity',
        execute: () => {
          this.elements.update(list =>
            list.map(e => (e.id === hlEl.id ? { ...e, opacity } : e))
          );
        },
        undo: () => {
          this.elements.update(list =>
            list.map(e => (e.id === hlEl.id ? { ...e, opacity: oldOpacity } : e))
          );
        }
      };
      this.history.execute(cmd);
    }
  }

  isHighlightCustomActive(): boolean {
    const c = this.highlightColor();
    return !!c && !c.startsWith('var(');
  }

  addWhiteoutElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement = this.elementOps.createWhiteoutElement(page, { xPt, yPt });

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
    if (color && !color.startsWith('var(')) {
      this.signatureCustomColor.set(color);
    }
    this.updateSelectedSignatureProperty('color', color);
  }

  isSignatureCustomActive(): boolean {
    const c = this.signatureColor();
    return !!c && !c.startsWith('var(');
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

  clearSigPad(): void {
    if (this.signPanel) {
      this.signPanel.clearSigPad();
    }
    this.signatureDrawnDataUrl.set(null);
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
    if (mode === 'draw' || mode === 'upload') {
      const dataUrl = this.signatureDrawnDataUrl();
      if (!dataUrl) {
        if (mode === 'draw') {
          this.errorMessage.set('Please draw your signature on the pad first.');
        } else {
          this.errorMessage.set('Please upload a signature image first.');
        }
        return;
      }
    }

    const newElement = this.elementOps.createSignElement(page, {
      tab: mode,
      text: this.signatureText(),
      fontFamily: this.signatureFont(),
      color: this.signatureColor(),
      fontSizePt: this.signatureSize(),
      drawnDataUrl: this.signatureDrawnDataUrl(),
      xPt,
      yPt
    });

    const cmd: Command = {
      description: 'Add Signature',
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

  addLinkElement(xPt = 100, yPt = 100, targetPageIndex?: number): void {
    const pageIndex = targetPageIndex !== undefined ? targetPageIndex : this.currentPageIndex();
    const page = this.pages()[pageIndex] || this.currentPage();
    if (!page) return;

    const newElement = this.elementOps.createLinkElement(page, {
      xPt,
      yPt,
      url: this.linkUrl()
    });

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
    if (this.activeTool() !== 'select') return;
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
      this.isTextStrikeout.set(!!textEl.strikeout);
      this.textAlign.set(textEl.align || 'left');
      const hasLink = !!(textEl.linkUrl || (textEl.html && textEl.html.includes('<a ')));
      this.isTextLinked.set(hasLink);
      if (textEl.linkUrl) {
        this.textLinkUrl.set(textEl.linkUrl);
      } else if (textEl.html && textEl.html.includes('href="')) {
        const match = textEl.html.match(/href="([^"]*)"/i);
        if (match) this.textLinkUrl.set(match[1]);
      }
      this.showTextLinkInput.set(false);
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
        if (!signEl.color.startsWith('var(')) {
          this.signatureCustomColor.set(signEl.color);
        }
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
    } else if (el.type === 'highlight') {
      const hlEl = el as HighlightEditElement;
      if (hlEl.color) {
        this.highlightColor.set(hlEl.color);
        if (!hlEl.color.startsWith('var(')) {
          this.highlightCustomColor.set(hlEl.color);
        }
      }
      if (hlEl.opacity !== undefined) {
        this.highlightOpacity.set(hlEl.opacity);
      }
    }
  }

  duplicateSelectedElement(): void {
    const el = this.selectedElement();
    if (!el) return;

    const cloned = this.elementOps.duplicateElement(el);

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
        this.elements.update(list => this.elementOps.bringToFront(list, el.id));
      },
      undo: () => {
        this.elements.update(list => this.elementOps.sendToBack(list, el.id));
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
        this.elements.update(list => this.elementOps.sendToBack(list, el.id));
      },
      undo: () => {
        this.elements.update(list => this.elementOps.bringToFront(list, el.id));
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
          this.elements.update(list => [...this.elementOps.deleteElement(list, el.id), coverEl]);
          this.selectedElementId.set(null);
        },
        undo: () => {
          this.elements.update(list => [...this.elementOps.deleteElement(list, coverEl.id), el]);
          this.selectedElementId.set(el.id);
        }
      };
      this.history.execute(cmd);
      return;
    }

    const cmd: Command = {
      description: `Delete ${el.type}`,
      execute: () => {
        this.elements.update(list => this.elementOps.deleteElement(list, el.id));
        this.selectedElementId.set(null);
      },
      undo: () => {
        this.elements.update(list => [...list, el]);
        this.selectedElementId.set(el.id);
      }
    };

    this.history.execute(cmd);
  }

  // --- Area Selection Action Handlers ---
  onAreaSelectionMoved(event: { targetPageIndex: number; newXPt: number; newYPt: number }): void {
    const current = this.areaSelectionService.selection();
    if (!current) return;
    const sourcePage = this.pages().find(p => p.pageIndex === current.originalPageIndex) || this.currentPage()!;
    const targetPage = this.pages().find(p => p.pageIndex === event.targetPageIndex) || sourcePage;
    this.areaSelectionService.commitMove(
      this.elements,
      event.targetPageIndex,
      event.newXPt,
      event.newYPt,
      sourcePage,
      targetPage,
      newId => this.selectedElementId.set(newId)
    );
  }

  deleteAreaSelection(): void {
    const p = this.currentPage();
    if (p) this.areaSelectionService.deleteArea(this.elements, p);
  }

  cutAreaSelection(): void {
    const p = this.currentPage();
    if (p) this.areaSelectionService.cut(this.elements, p);
  }

  copyAreaSelection(): void {
    this.areaSelectionService.copy();
  }

  pasteAreaSelection(): void {
    const p = this.currentPage();
    if (p) {
      this.areaSelectionService.paste(this.elements, p, newId => this.selectedElementId.set(newId));
    }
  }

  duplicateAreaSelection(): void {
    const p = this.currentPage();
    if (p) {
      this.areaSelectionService.duplicate(this.elements, p, newId => this.selectedElementId.set(newId));
    }
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
        if (textEl.isPageTextLine) {
          textEl.isEdited = true;
          this.whiteoutOriginalTextOnCanvas(textEl);
        }
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

  setTextAlign(align: 'left' | 'center' | 'right'): void {
    this.textAlign.set(align);
    this.updateTextProperty('align', align);
  }

  resolveColorToCss(colorStr?: string): string {
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
    const res = this.textFormatting.restoreTextSelection(el, this.savedTextRange);
    return { hasSelection: res.hasSelection, activeEl: res.activeEl };
  }

  toggleTextBold(): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const res = this.textFormatting.applyInlineFormatting('bold', el, this.savedTextRange);
    if (res.handled) {
      this.savedTextRange = res.updatedRange;
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

    const res = this.textFormatting.applyInlineFormatting('italic', el, this.savedTextRange);
    if (res.handled) {
      this.savedTextRange = res.updatedRange;
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

    const res = this.textFormatting.applyInlineFormatting('underline', el, this.savedTextRange);
    if (res.handled) {
      this.savedTextRange = res.updatedRange;
      this.elements.update(list => [...list]);
      return;
    }

    const next = !this.isTextUnderline();
    this.isTextUnderline.set(next);
    this.updateTextProperty('underline', next);
  }

  toggleTextStrikeout(): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const res = this.textFormatting.applyInlineFormatting('strikeThrough', el, this.savedTextRange);
    if (res.handled) {
      this.savedTextRange = res.updatedRange;
      this.elements.update(list => [...list]);
      return;
    }

    const next = !this.isTextStrikeout();
    this.isTextStrikeout.set(next);
    this.updateTextProperty('strikeout', next);
  }

  toggleTextLinkInput(): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const existingUrl = this.textFormatting.detectLinkUrl(el, this.savedTextRange);
    if (existingUrl) {
      this.textLinkUrl.set(existingUrl);
      this.isTextLinked.set(true);
    } else {
      if (!this.textLinkUrl() || !this.textLinkUrl().startsWith('http')) {
        this.textLinkUrl.set('https://');
      }
      this.isTextLinked.set(false);
    }

    this.showTextLinkInput.update(v => !v);
  }

  closeTextLinkInput(): void {
    this.showTextLinkInput.set(false);
  }

  applyTextLink(inputUrl?: string): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const targetUrl = (inputUrl !== undefined ? inputUrl : this.textLinkUrl()).trim();
    if (!targetUrl || targetUrl === 'https://' || targetUrl === 'http://') {
      this.removeTextLink();
      return;
    }

    const formattedUrl = this.textFormatting.formatUrl(targetUrl);
    this.textLinkUrl.set(formattedUrl);

    const oldHtml = el.html || el.text;
    const oldText = el.text;
    const oldLinkUrl = el.linkUrl;

    const res = this.textFormatting.applyLink(el, formattedUrl, this.savedTextRange);
    this.savedTextRange = res.updatedRange;

    this.isTextLinked.set(true);
    this.showTextLinkInput.set(false);

    const newHtml = el.html;
    const newText = el.text;
    const newLinkUrl = el.linkUrl;

    const cmd: Command = {
      description: 'Embed Link in Text',
      execute: () => {
        this.elements.update(list =>
          list.map(e =>
            e.id === el.id
              ? ({
                ...e,
                html: newHtml,
                text: newText,
                linkUrl: newLinkUrl,
                isEdited: el.isPageTextLine ? true : (e as TextEditElement).isEdited
              } as TextEditElement)
              : e
          )
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e =>
            e.id === el.id
              ? ({
                ...e,
                html: oldHtml,
                text: oldText,
                linkUrl: oldLinkUrl
              } as TextEditElement)
              : e
          )
        );
      }
    };
    this.history.execute(cmd);
    this.elements.update(list => [...list]);
  }

  removeTextLink(): void {
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const oldHtml = el.html || el.text;
    const oldText = el.text;
    const oldLinkUrl = el.linkUrl;

    const res = this.textFormatting.removeLink(el, this.savedTextRange);
    this.savedTextRange = res.updatedRange;

    this.isTextLinked.set(false);
    this.showTextLinkInput.set(false);

    const newHtml = el.html;
    const newText = el.text;

    const cmd: Command = {
      description: 'Remove Link from Text',
      execute: () => {
        this.elements.update(list =>
          list.map(e => {
            if (e.id === el.id) {
              const updated = { ...e, html: newHtml, text: newText };
              delete (updated as TextEditElement).linkUrl;
              return updated as TextEditElement;
            }
            return e;
          })
        );
      },
      undo: () => {
        this.elements.update(list =>
          list.map(e =>
            e.id === el.id
              ? ({
                ...e,
                html: oldHtml,
                text: oldText,
                linkUrl: oldLinkUrl
              } as TextEditElement)
              : e
          )
        );
      }
    };
    this.history.execute(cmd);
    this.elements.update(list => [...list]);
  }

  setTextColor(color: string): void {
    this.textColor.set(color);
    if (color && !color.startsWith('var(')) {
      this.textCustomColor.set(color);
    }
    const el = this.selectedElement() as TextEditElement;
    if (!el || el.type !== 'text') return;

    const cssColor = this.resolveColorToCss(color);
    const res = this.textFormatting.applyInlineColor(cssColor, el, this.savedTextRange);
    if (res.handled) {
      if (el.isPageTextLine) {
        el.isEdited = true;
        this.whiteoutOriginalTextOnCanvas(el);
      }
      this.savedTextRange = res.updatedRange;
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
          const pageElements = await this.textExtraction.extractTextForSinglePage(this.cachedPdfDoc, page);
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
          this.activeTool.set('select');
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
    const res = this.ocrWorkflow.validatePageRange(
      this.ocrPageRange(),
      this.ocrCustomRange(),
      this.pages().length
    );
    this.ocrRangeError.set(res.error);
    return res.valid;
  }

  getSelectedPageIndicesForOcr(): number[] {
    return this.ocrWorkflow.parsePageIndices(
      this.ocrPageRange(),
      this.ocrCustomRange(),
      this.pages().length,
      this.currentPageIndex()
    );
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
    const { elements: generatedElements, lowConfidenceWords: lowConfWords, totalLines } =
      this.ocrWorkflow.convertOcrResultToElements(result, targetPageIndices, mode);

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
    if (this.isExporting()) return;
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
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
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
    if (!page) return { left: '0px', top: '0px', width: '0px', height: '0px', transform: 'none' };

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
      transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none',
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

    nudgeSelectedElement(dx: number, dy: number): void {
    const id = this.selectedElementId();
    if (!id) return;
    this.elements.update(list =>
      list.map(el => {
        if (el.id !== id) return el;
        return {
          ...el,
          xPt: Math.round(el.xPt + dx),
          yPt: Math.round(el.yPt + dy)
        };
      })
    );
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isEditingText =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest?.('[contenteditable="true"]')) ||
        Boolean(target.closest?.('.canvas-text-area')));

    const keyLower = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (keyLower === 'z' || keyLower === 'y')) {
      if (isEditingText) {
        return; // Allow native undo/redo in text fields
      }
      const isRedo = (keyLower === 'z' && event.shiftKey) || keyLower === 'y';
      if (isRedo) {
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
      return;
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
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')) ||
          Boolean(target.closest?.('.canvas-text-area')));

      if (!isEditingText) {
        if (this.areaSelectionService.hasSelection()) {
          event.preventDefault();
          this.deleteAreaSelection();
        } else if (this.selectedElementId()) {
          event.preventDefault();
          this.deleteSelectedElement();
        }
      }
    } else if (event.key === 'Escape') {
      if (this.areaSelectionService.hasSelection()) {
        this.areaSelectionService.clearSelection();
      } else if (this.draftPolygonPoints().length > 0) {
        this.cancelPolygonShape();
      } else if (this.activeTool() !== null) {
        this.selectTool(this.activeTool()!);
      } else if (this.selectedElementId()) {
        this.selectedElementId.set(null);
      }
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')) ||
          Boolean(target.closest?.('.canvas-text-area')));

      if (!isEditingText && this.areaSelectionService.hasSelection()) {
        event.preventDefault();
        this.copyAreaSelection();
      }
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')) ||
          Boolean(target.closest?.('.canvas-text-area')));

      if (!isEditingText && this.areaSelectionService.canPaste()) {
        event.preventDefault();
        this.pasteAreaSelection();
      }
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')) ||
          Boolean(target.closest?.('.canvas-text-area')));

      if (!isEditingText && this.areaSelectionService.hasSelection()) {
        event.preventDefault();
        this.cutAreaSelection();
      }
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')) ||
          Boolean(target.closest?.('.canvas-text-area')));

      if (!isEditingText && this.areaSelectionService.hasSelection()) {
        event.preventDefault();
        this.duplicateAreaSelection();
      }
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')) ||
          Boolean(target.closest?.('.canvas-text-area')));

      if (!isEditingText && this.currentPage()) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (event.key === 'ArrowUp') dy = step;
        if (event.key === 'ArrowDown') dy = -step;
        if (event.key === 'ArrowLeft') dx = -step;
        if (event.key === 'ArrowRight') dx = step;

        if (this.areaSelectionService.hasSelection()) {
          this.areaSelectionService.nudge(dx, dy, this.currentPage()!);
        } else if (this.selectedElementId()) {
          this.nudgeSelectedElement(dx, dy);
        }
      }
    }
  }
}
