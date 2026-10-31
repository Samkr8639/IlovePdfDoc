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
import {
  EDIT_PDF_FEATURES,
  EditPdfFeatureConfig,
  EditPdfOcrMode,
  SUPPORTED_OCR_LANGUAGES,
  TessdataLanguage,
  EditPdfOcrResult
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
  OcrTextLayerElement,
  LowConfidenceWord
} from './models/document-model';
import { CoordinateTransformService } from './services/coordinate-transform';
import { CommandHistoryService, Command } from './services/command-history';
import { PdfExportService } from './services/pdf-export.service';
import { OcrService } from './services/ocr.service';

type EditorViewMode = 'upload' | 'editor';

@Component({
  selector: 'app-edit-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DropzoneComponent
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

  @ViewChild('pageCanvas') pageCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInputImage') fileInputImage!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputAppend') fileInputAppend!: ElementRef<HTMLInputElement>;

  // Document state
  readonly viewMode = signal<EditorViewMode>('upload');
  readonly currentPdfBytes = signal<Uint8Array | null>(null);
  readonly currentFileName = signal<string>('document.pdf');
  readonly pages = signal<PageDimensions[]>([]);
  readonly currentPageIndex = signal<number>(0);
  readonly zoom = signal<number>(1.0);
  readonly elements = signal<EditElement[]>([]);
  readonly selectedElementId = signal<string | null>(null);

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

  // Shape / Draw Properties
  readonly shapeType = signal<'rectangle' | 'circle' | 'line'>('rectangle');
  readonly strokeColor = signal<string>('var(--pt-navy)');
  readonly fillColor = signal<string>('transparent');
  readonly strokeWidth = signal<number>(2);

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
  readonly isSignatureModalOpen = signal<boolean>(false);

  // Freehand drawing state
  private isDrawing = false;
  private currentDrawingPoints: Array<{ xPt: number; yPt: number }> = [];

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
    } catch (err: unknown) {
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

    // Initial render
    setTimeout(() => this.renderCurrentPageToCanvas(), 50);
  }

  async renderCurrentPageToCanvas(): Promise<void> {
    const bytes = this.currentPdfBytes();
    const page = this.currentPage();
    if (!bytes || !page || !this.pageCanvasRef) return;

    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const pdfjs = await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');

      const loadingTask = pdfjs.getDocument({
        data: bytes,
        verbosity: 0,
        isEvalSupported: false
      });
      const pdfDoc = await loadingTask.promise;
      const pdfPage = await pdfDoc.getPage(page.pageIndex + 1);

      const canvas = this.pageCanvasRef.nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const display = this.displaySize();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

      canvas.width = display.width * dpr;
      canvas.height = display.height * dpr;
      ctx.scale(dpr, dpr);

      const viewport = pdfPage.getViewport({
        scale: this.zoom() * (display.width / (page.widthPt * this.zoom()))
      });

      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    } catch {
      // Graceful fallback if pdf.js rendering is interrupted
    }
  }

  // --- Page Navigation & Zoom ---
  setPageIndex(index: number): void {
    if (index >= 0 && index < this.pages().length) {
      this.currentPageIndex.set(index);
      this.selectedElementId.set(null);
      setTimeout(() => this.renderCurrentPageToCanvas(), 20);
    }
  }

  prevPage(): void {
    this.setPageIndex(this.currentPageIndex() - 1);
  }

  nextPage(): void {
    this.setPageIndex(this.currentPageIndex() + 1);
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

  rotateCurrentPage(): void {
    const page = this.currentPage();
    if (!page) return;
    const newRotation = (page.rotation + 90) % 360;

    const pageIndex = page.pageIndex;
    const oldRotation = page.rotation;

    const cmd: Command = {
      description: `Rotate Page ${pageIndex + 1}`,
      execute: () => {
        this.pages.update(list =>
          list.map(p => (p.pageIndex === pageIndex ? { ...p, rotation: newRotation } : p))
        );
        setTimeout(() => this.renderCurrentPageToCanvas(), 20);
      },
      undo: () => {
        this.pages.update(list =>
          list.map(p => (p.pageIndex === pageIndex ? { ...p, rotation: oldRotation } : p))
        );
        setTimeout(() => this.renderCurrentPageToCanvas(), 20);
      }
    };

    this.history.execute(cmd);
  }

  deleteCurrentPage(): void {
    if (this.pages().length <= 1) {
      this.errorMessage.set('A document must have at least one page.');
      return;
    }
    const idx = this.currentPageIndex();
    const removedPage = this.pages()[idx];
    const removedElements = this.elements().filter(e => e.pageIndex === idx);

    const cmd: Command = {
      description: `Delete Page ${idx + 1}`,
      execute: () => {
        this.pages.update(list => {
          const updated = list.filter((_, i) => i !== idx);
          return updated.map((p, i) => ({ ...p, pageIndex: i }));
        });
        this.elements.update(list => list.filter(e => e.pageIndex !== idx));
        this.currentPageIndex.set(Math.min(idx, this.pages().length - 1));
        setTimeout(() => this.renderCurrentPageToCanvas(), 20);
      },
      undo: () => {
        this.pages.update(list => {
          const copy = [...list];
          copy.splice(idx, 0, removedPage);
          return copy.map((p, i) => ({ ...p, pageIndex: i }));
        });
        this.elements.update(list => [...list, ...removedElements]);
        this.currentPageIndex.set(idx);
        setTimeout(() => this.renderCurrentPageToCanvas(), 20);
      }
    };

    this.history.execute(cmd);
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

  onCanvasClick(event: MouseEvent): void {
    const page = this.currentPage();
    if (!page) return;

    const rect = this.pageCanvasRef.nativeElement.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;

    const pdfPt = this.transform.screenPointToPdfPoint({ x: screenX, y: screenY }, page, this.zoom());

    switch (this.activeTool()) {
      case 'text':
        this.addTextElement(pdfPt.xPt, pdfPt.yPt);
        break;
      case 'shapes':
        this.addShapeElement(pdfPt.xPt, pdfPt.yPt);
        break;
      case 'highlight':
        this.addHighlightElement(pdfPt.xPt, pdfPt.yPt);
        break;
      case 'whiteout':
        this.addWhiteoutElement(pdfPt.xPt, pdfPt.yPt);
        break;
    }
  }

  addTextElement(xPt: number, yPt: number): void {
    const page = this.currentPage();
    if (!page) return;

    const newElement: TextEditElement = {
      id: `text-${Date.now()}`,
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

  addShapeElement(xPt: number, yPt: number): void {
    const page = this.currentPage();
    if (!page) return;

    const newElement: ShapeEditElement = {
      id: `shape-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'shape',
      shapeType: this.shapeType(),
      xPt,
      yPt,
      widthPt: 160,
      heightPt: 90,
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

  addHighlightElement(xPt: number, yPt: number): void {
    const page = this.currentPage();
    if (!page) return;

    const newElement: HighlightEditElement = {
      id: `hl-${Date.now()}`,
      pageIndex: page.pageIndex,
      type: 'highlight',
      xPt,
      yPt,
      widthPt: 180,
      heightPt: 22,
      color: 'var(--pt-amber)', // subtle amber highlight
      opacity: 0.35
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

  addWhiteoutElement(xPt: number, yPt: number): void {
    const page = this.currentPage();
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

  selectElement(el: EditElement, event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedElementId.set(el.id);
  }

  deleteSelectedElement(): void {
    const el = this.selectedElement();
    if (!el) return;

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
          list.map(e => (e.id === textEl.id ? { ...e, [field]: value } : e))
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
        // Mode 1: Searchable invisible text layer
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

        // Flag low confidence words
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
        // Mode 2: Editable text boxes with cover rectangles
        for (const line of pageResult.lines) {
          totalLines++;
          const [x0, y0, x1, y1] = line.bbox;
          const w = Math.max(12, x1 - x0);
          const h = Math.max(12, y1 - y0);

          // (a) Cover whiteout rectangle
          const coverEl: WhiteoutEditElement = {
            id: `ocr-cover-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: actualPageIndex,
            type: 'whiteout',
            xPt: Math.max(0, x0 - 2),
            yPt: Math.max(0, y0 - 1),
            widthPt: w + 4,
            heightPt: h + 2,
            fillColor: 'var(--pt-surface-white)'
          };

          // (b) Editable text element
          const textEl: TextEditElement = {
            id: `ocr-text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: actualPageIndex,
            type: 'text',
            xPt: x0,
            yPt: y0,
            widthPt: w,
            heightPt: h,
            text: line.text,
            fontFamily: 'Inter',
            fontSizePt: line.fontSizePt || 14,
            color: 'var(--pt-navy)',
            baselineY: line.baselineY,
            isOcrLine: true,
            ocrConfidence: line.confidence
          };

          generatedElements.push(coverEl, textEl);

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
      }
    }

    this.lowConfidenceReviewWords.set(lowConfWords);

    // Apply as single undoable command
    const cmd: Command = {
      description: `Recognize Text (${mode === 'searchable' ? 'Searchable' : 'Editable'})`,
      execute: () => {
        this.elements.update(list => [...list, ...generatedElements]);
      },
      undo: () => {
        const idsToRemove = new Set(generatedElements.map(e => e.id));
        this.elements.update(list => list.filter(e => !idsToRemove.has(e.id)));
      }
    };

    this.history.execute(cmd);

    // Summary toast
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
    } catch (err: unknown) {
      this.errorMessage.set('Failed to export edited PDF document.');
    } finally {
      this.isExporting.set(false);
    }
  }

  // UI coordinate calculation helper for element bounding boxes on canvas
  getElementScreenRect(el: EditElement) {
    const page = this.currentPage();
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
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      // Delete selected element if not currently typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && this.selectedElementId()) {
        event.preventDefault();
        this.deleteSelectedElement();
      }
    }
  }
}
