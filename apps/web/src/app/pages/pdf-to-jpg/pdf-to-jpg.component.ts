import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PdfToJpgMode,
  PdfToJpgQualityPreset,
  PdfToJpgDpiPreset,
  PdfToJpgOptions,
  PdfToJpgConversionResult,
  ConvertedPageItem,
  ExtractedImageItem
} from '@paperflow/contracts';
import { PdfToJpgService, ConversionProgress } from '../../core/services/pdf-to-jpg/pdf-to-jpg.service';
import { SharedPdfjsService, PdfPasswordError } from '../../core/services/shared-pdfjs.service';
import { parsePageRange, formatPageRange } from '../../core/services/pdf-to-jpg/range-parser';
import { calculateSafeRenderDpi } from '../../core/services/pdf-to-jpg/canvas-limits';
import { createStreamingZip } from '../../core/services/pdf-to-jpg/streaming-zip';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';

export type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

export interface SelectedPdfFile {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  formattedSize: string;
  pageCount?: number;
  docProxy?: any;
  firstPageWidthPt?: number;
  firstPageHeightPt?: number;
  thumbnails?: Map<number, string>;
}

@Component({
  selector: 'app-pdf-to-jpg',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DropzoneComponent,
    ProcessingStateComponent
  ],
  templateUrl: './pdf-to-jpg.component.html',
  styleUrl: './pdf-to-jpg.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PdfToJpgComponent implements OnInit, OnDestroy {
  private pdfToJpgService = inject(PdfToJpgService);
  private pdfjsService = inject(SharedPdfjsService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  private abortController: AbortController | null = null;
  private currentRunId = 0;
  private lastClickedPageIndex = -1;

  // Workspace lifecycle
  readonly currentState = signal<WorkspaceState>('upload');
  readonly selectedFiles = signal<SelectedPdfFile[]>([]);
  readonly errorMessage = signal<string | null>(null);

  // Conversion mode: 'convert_pages' (Mode A) or 'extract_images' (Mode B)
  readonly mode = signal<PdfToJpgMode>('convert_pages');

  // MODE A: Convert Pages Options
  readonly pagesMode = signal<'all' | 'range'>('all');
  readonly pageRangeInput = signal<string>('');
  readonly selectedPageNumbers = signal<number[]>([]);
  readonly qualityPreset = signal<PdfToJpgQualityPreset>('high');
  readonly customQuality = signal<number>(90);
  readonly dpiPreset = signal<PdfToJpgDpiPreset>(150);
  readonly customDpi = signal<number>(150);
  readonly backgroundColor = signal<string>('#FFFFFF');
  readonly arrangement = signal<'separate' | 'combined'>('separate');
  readonly includeAnnotations = signal<boolean>(true);
  readonly embedDpi = signal<boolean>(true);
  readonly grayscale = signal<boolean>(false);

  // MODE B: Extract Images Options
  readonly minSize = signal<number>(100);
  readonly keepOriginalJpegs = signal<boolean>(true);
  readonly skipDuplicates = signal<boolean>(true);
  readonly includeMasks = signal<boolean>(false);
  readonly extractQuality = signal<number>(90);
  readonly extractBgColor = signal<string>('#FFFFFF');

  // Processing state
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingStatus = signal<string>('Preparing document...');
  readonly conversionResult = signal<PdfToJpgConversionResult | null>(null);

  // Mobile / UI drawers
  readonly isSidePanelOpen = signal<boolean>(false);
  readonly showAdvanced = signal<boolean>(false);

  // Result screen selection & pagination
  readonly selectedResultItemIds = signal<Set<string>>(new Set());
  readonly resultPreviewLimit = signal<number>(60);
  readonly isDownloadingZip = signal<boolean>(false);

  // Password prompt modal
  readonly isPasswordModalOpen = signal<boolean>(false);
  readonly passwordInput = signal<string>('');
  readonly passwordError = signal<string | null>(null);
  private pendingPasswordFile: File | null = null;

  // Sample estimation cache
  readonly estimatedSizeText = signal<string>('Calculating...');
  readonly firstPageDimensionsText = signal<string>('');

  // Computed: Primary PDF file (first uploaded)
  readonly primaryFile = computed<SelectedPdfFile | null>(() => {
    const files = this.selectedFiles();
    return files.length > 0 ? files[0] : null;
  });

  // Computed: Effective Quality (0.40 - 1.00)
  readonly effectiveQuality = computed<number>(() => {
    const preset = this.qualityPreset();
    if (preset === 'low') return 0.60;
    if (preset === 'medium') return 0.80;
    if (preset === 'high') return 0.90;
    if (preset === 'maximum') return 0.97;
    return Math.max(0.40, Math.min(1.00, this.customQuality() / 100));
  });

  // Computed: Effective DPI (36 - 1200)
  readonly effectiveDpi = computed<number>(() => {
    const preset = this.dpiPreset();
    if (preset === 'custom') {
      return Math.max(36, Math.min(1200, this.customDpi() || 150));
    }
    return Number(preset) || 150;
  });

  // Computed: Page range error validation
  readonly pageRangeError = computed<string | null>(() => {
    if (this.pagesMode() !== 'range') return null;
    const input = this.pageRangeInput().trim();
    if (!input) return 'Please specify page numbers or a range (e.g. 1-3, 5).';
    const total = this.primaryFile()?.pageCount;
    const parsed = parsePageRange(input, total);
    return parsed.valid ? null : (parsed.error || 'Invalid range format.');
  });

  // Computed: Total pages count of primary document
  readonly totalPagesCount = computed<number>(() => {
    return this.primaryFile()?.pageCount || 0;
  });

  // Computed: Count of selected pages for conversion
  readonly activePagesCount = computed<number>(() => {
    if (this.pagesMode() === 'all') {
      return this.totalPagesCount();
    }
    return this.selectedPageNumbers().length;
  });

  // Computed: Display list of items on the result screen
  readonly resultDisplayItems = computed<Array<ConvertedPageItem | ExtractedImageItem>>(() => {
    const res = this.conversionResult();
    if (!res) return [];
    if (res.mode === 'convert_pages') {
      return res.pages.slice(0, this.resultPreviewLimit());
    }
    return res.images.slice(0, this.resultPreviewLimit());
  });

  readonly hasMoreResultItems = computed<boolean>(() => {
    const res = this.conversionResult();
    if (!res) return false;
    const total = res.mode === 'convert_pages' ? res.pages.length : res.images.length;
    return total > this.resultPreviewLimit();
  });

  readonly areAllItemsSelected = computed<boolean>(() => {
    const res = this.conversionResult();
    if (!res) return false;
    const total = res.mode === 'convert_pages' ? res.pages.length : res.images.length;
    if (total === 0) return false;
    return this.selectedResultItemIds().size === total;
  });

  ngOnInit(): void {
    const def = this.toolRegistry.getToolById('pdf-to-jpg');
    if (def?.seo) {
      this.seo.setSeoData(def.seo);
    }
  }

  ngOnDestroy(): void {
    this.cancelConversion();
    this.cleanupThumbnails();
    this.cleanupResultUrls();
  }

  // ──────────────────────────────────────────────────────────────
  // FILE UPLOAD & INITIALIZATION
  // ──────────────────────────────────────────────────────────────
  onFilesSelected(files: File[]): void {
    if (!files || files.length === 0) return;
    this.errorMessage.set(null);

    // Reject duplicate files by name + size + lastModified
    const currentFiles = this.selectedFiles();
    const newFiles: SelectedPdfFile[] = [];

    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
        this.errorMessage.set(`"${f.name}" is not a PDF file. Please upload standard PDF documents.`);
        return;
      }
      if (f.size > 200 * 1024 * 1024) {
        this.errorMessage.set(`"${f.name}" exceeds the maximum allowed file size of 200 MB.`);
        return;
      }
      const isDuplicate = currentFiles.some(
        (cf) => cf.name === f.name && cf.sizeBytes === f.size && cf.file.lastModified === f.lastModified
      );
      if (isDuplicate) {
        this.errorMessage.set(`"${f.name}" has already been added.`);
        continue;
      }

      newFiles.push({
        id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        name: f.name,
        sizeBytes: f.size,
        formattedSize: this.formatBytes(f.size)
      });
    }

    if (newFiles.length === 0) return;

    this.selectedFiles.update((curr) => [...curr, ...newFiles]);
    this.currentState.set('organize');

    // Load PDF details for primary file
    this.loadPrimaryPdfDetails(newFiles[0].file);
  }

  private async loadPrimaryPdfDetails(file: File, password?: string): Promise<void> {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await this.pdfjsService.loadDocument(bytes, { password });

      const pageCount = doc.numPages;
      const firstPage = await doc.getPage(1);
      const vp = firstPage.getViewport({ scale: 1.0 });

      // Initialize selected pages to all
      const allPages = Array.from({ length: pageCount }, (_, i) => i + 1);
      this.selectedPageNumbers.set(allPages);
      this.pageRangeInput.set(`1-${pageCount}`);

      // Update file entry in selectedFiles
      this.selectedFiles.update((files) => {
        if (files.length === 0) return files;
        const updated = [...files];
        updated[0] = {
          ...updated[0],
          pageCount,
          docProxy: doc,
          firstPageWidthPt: Math.round(vp.width),
          firstPageHeightPt: Math.round(vp.height)
        };
        return updated;
      });

      this.updateResolutionEstimate(Math.round(vp.width), Math.round(vp.height));
      this.loadThumbnails(doc, pageCount);
      firstPage.cleanup();
    } catch (err: any) {
      if (err instanceof PdfPasswordError) {
        this.pendingPasswordFile = file;
        this.passwordError.set(err.code === 'PASSWORD_INCORRECT' ? 'Incorrect password. Try again.' : null);
        this.isPasswordModalOpen.set(true);
      } else {
        this.errorMessage.set('Could not load PDF document. It may be corrupt or corrupted.');
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // PASSWORD PROMPT MODAL
  // ──────────────────────────────────────────────────────────────
  submitPassword(): void {
    const pwd = this.passwordInput().trim();
    if (!pwd) {
      this.passwordError.set('Please enter the password.');
      return;
    }
    if (!this.pendingPasswordFile) return;

    this.passwordError.set(null);
    this.isPasswordModalOpen.set(false);
    this.loadPrimaryPdfDetails(this.pendingPasswordFile, pwd);
  }

  cancelPasswordModal(): void {
    this.isPasswordModalOpen.set(false);
    this.passwordInput.set('');
    this.passwordError.set(null);
    this.pendingPasswordFile = null;
    if (this.selectedFiles().length === 0) {
      this.currentState.set('upload');
    }
  }

  // ──────────────────────────────────────────────────────────────
  // THUMBNAIL RENDERING
  // ──────────────────────────────────────────────────────────────
  private async loadThumbnails(doc: any, totalPages: number): Promise<void> {
    const thumbMap = new Map<number, string>();
    const renderLimit = Math.min(totalPages, 150); // limit preview thumbnails for performance

    for (let i = 1; i <= renderLimit; i++) {
      try {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 0.18 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          thumbMap.set(i, canvas.toDataURL('image/jpeg', 0.75));
        }
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      } catch {
        // Skip thumbnail error
      }
    }

    this.selectedFiles.update((files) => {
      if (files.length === 0) return files;
      const updated = [...files];
      updated[0] = { ...updated[0], thumbnails: thumbMap };
      return updated;
    });
  }

  // ──────────────────────────────────────────────────────────────
  // RESOLUTION & SAMPLE ESTIMATE
  // ──────────────────────────────────────────────────────────────
  private updateResolutionEstimate(widthPt?: number, heightPt?: number): void {
    const f = this.primaryFile();
    const w = widthPt || f?.firstPageWidthPt || 595;
    const h = heightPt || f?.firstPageHeightPt || 842;
    const dpi = this.effectiveDpi();

    const safe = calculateSafeRenderDpi(w, h, dpi);
    this.firstPageDimensionsText.set(`${safe.widthPx} × ${safe.heightPx} px`);

    // Estimate file size: base uncompressed ~ (w*h*3) / compressionRatio (approx 15-20x for jpeg)
    const activePages = this.activePagesCount();
    const rawPixels = safe.widthPx * safe.heightPx;
    const estimatedBytesPerPage = Math.round((rawPixels * 3) / (25 * (1.1 - this.effectiveQuality() * 0.5)));
    const totalEst = estimatedBytesPerPage * activePages;
    this.estimatedSizeText.set(`≈ ${this.formatBytes(totalEst)} (${activePages} page${activePages === 1 ? '' : 's'})`);
  }

  onDpiChange(dpi: PdfToJpgDpiPreset): void {
    this.dpiPreset.set(dpi);
    this.updateResolutionEstimate();
  }

  onQualityChange(preset: PdfToJpgQualityPreset): void {
    this.qualityPreset.set(preset);
    this.updateResolutionEstimate();
  }

  // ──────────────────────────────────────────────────────────────
  // INTERACTIVE THUMBNAIL GRID & RANGE SELECTION
  // ──────────────────────────────────────────────────────────────
  togglePageSelection(pageNum: number, event?: MouseEvent): void {
    const total = this.totalPagesCount();
    const current = new Set(this.selectedPageNumbers());

    // Shift-click range selection
    if (event?.shiftKey && this.lastClickedPageIndex !== -1) {
      const start = Math.min(this.lastClickedPageIndex, pageNum);
      const end = Math.max(this.lastClickedPageIndex, pageNum);
      for (let p = start; p <= end; p++) {
        current.add(p);
      }
    } else {
      if (current.has(pageNum)) {
        current.delete(pageNum);
      } else {
        current.add(pageNum);
      }
    }

    this.lastClickedPageIndex = pageNum;
    const updated = Array.from(current).sort((a, b) => a - b);
    this.selectedPageNumbers.set(updated);
    this.pageRangeInput.set(formatPageRange(updated));

    if (updated.length === total) {
      this.pagesMode.set('all');
    } else {
      this.pagesMode.set('range');
    }
    this.updateResolutionEstimate();
  }

  onPageRangeInputBlur(): void {
    const total = this.totalPagesCount();
    const parsed = parsePageRange(this.pageRangeInput(), total);
    if (parsed.valid && parsed.pages.length > 0) {
      this.selectedPageNumbers.set(parsed.pages);
      this.pagesMode.set('range');
      this.updateResolutionEstimate();
    }
  }

  selectAllPages(): void {
    const total = this.totalPagesCount();
    const all = Array.from({ length: total }, (_, i) => i + 1);
    this.selectedPageNumbers.set(all);
    this.pageRangeInput.set(`1-${total}`);
    this.pagesMode.set('all');
    this.updateResolutionEstimate();
  }

  clearAllPages(): void {
    this.selectedPageNumbers.set([]);
    this.pageRangeInput.set('');
    this.pagesMode.set('range');
    this.updateResolutionEstimate();
  }

  invertPageSelection(): void {
    const total = this.totalPagesCount();
    const current = new Set(this.selectedPageNumbers());
    const inverted: number[] = [];
    for (let p = 1; p <= total; p++) {
      if (!current.has(p)) inverted.push(p);
    }
    this.selectedPageNumbers.set(inverted);
    this.pageRangeInput.set(formatPageRange(inverted));
    this.pagesMode.set('range');
    this.updateResolutionEstimate();
  }

  // ──────────────────────────────────────────────────────────────
  // CONVERSION EXECUTION
  // ──────────────────────────────────────────────────────────────
  async executeConversion(): Promise<void> {
    const files = this.selectedFiles();
    if (files.length === 0) return;

    if (this.mode() === 'convert_pages' && this.pagesMode() === 'range') {
      if (this.pageRangeError()) return;
      if (this.selectedPageNumbers().length === 0) {
        this.errorMessage.set('Please select at least one page to convert.');
        return;
      }
    }

    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.currentState.set('processing');
    this.processingProgress.set(0);
    this.processingStatus.set('Starting PDF processing...');
    this.isSidePanelOpen.set(false);

    this.abortController = new AbortController();
    const runId = ++this.currentRunId;

    const options: PdfToJpgOptions = {
      mode: this.mode(),
      convertPages: {
        pagesMode: this.pagesMode(),
        pageRange: this.pageRangeInput() || `1-${this.totalPagesCount()}`,
        dpi: this.effectiveDpi(),
        quality: this.effectiveQuality(),
        backgroundColor: this.backgroundColor(),
        arrangement: this.arrangement(),
        includeAnnotations: this.includeAnnotations(),
        embedDpi: this.embedDpi(),
        grayscale: this.grayscale()
      },
      extractImages: {
        minWidth: this.minSize(),
        minHeight: this.minSize(),
        keepOriginalJpegs: this.keepOriginalJpegs(),
        skipDuplicates: this.skipDuplicates(),
        includeMasks: this.includeMasks(),
        quality: Math.max(0.40, Math.min(1.00, this.extractQuality() / 100)),
        backgroundColor: this.extractBgColor()
      }
    };

    try {
      const primary = files[0];
      const result = await this.pdfToJpgService.convert(
        primary.file,
        primary.name,
        options,
        (progress: ConversionProgress) => {
          if (runId !== this.currentRunId) return;
          this.processingProgress.set(progress.percent);
          this.processingStatus.set(progress.statusText);
        },
        this.abortController.signal
      );

      if (runId !== this.currentRunId) return;

      this.conversionResult.set(result);
      // Select all result items by default
      const allIds = new Set<string>();
      if (result.mode === 'convert_pages') {
        result.pages.forEach((p) => allIds.add(p.filename));
      } else {
        result.images.forEach((i) => allIds.add(i.id));
      }
      this.selectedResultItemIds.set(allIds);

      this.isProcessing.set(false);
      this.currentState.set('completed');
    } catch (err: any) {
      if (runId !== this.currentRunId) return;
      this.isProcessing.set(false);
      if (err?.name === 'AbortError') {
        this.currentState.set('organize');
        this.processingStatus.set('Cancelled');
      } else {
        this.currentState.set('organize');
        this.errorMessage.set(err?.message || 'Conversion failed. Please try again with a valid PDF.');
      }
    }
  }

  cancelConversion(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing.set(false);
    if (this.currentState() === 'processing') {
      this.currentState.set('organize');
    }
  }

  // ──────────────────────────────────────────────────────────────
  // RESULT SCREEN ACTIONS
  // ──────────────────────────────────────────────────────────────
  toggleResultItemSelection(id: string): void {
    const current = new Set(this.selectedResultItemIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedResultItemIds.set(current);
  }

  toggleSelectAllResultItems(): void {
    const res = this.conversionResult();
    if (!res) return;
    if (this.areAllItemsSelected()) {
      this.selectedResultItemIds.set(new Set());
    } else {
      const allIds = new Set<string>();
      if (res.mode === 'convert_pages') {
        res.pages.forEach((p) => allIds.add(p.filename));
      } else {
        res.images.forEach((i) => allIds.add(i.id));
      }
      this.selectedResultItemIds.set(allIds);
    }
  }

  downloadSingleItem(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async downloadSelectedAsZip(): Promise<void> {
    const res = this.conversionResult();
    if (!res) return;

    const selectedIds = this.selectedResultItemIds();
    if (selectedIds.size === 0) return;

    this.isDownloadingZip.set(true);

    try {
      const entries: Array<{ name: string; blob: Blob }> = [];
      if (res.mode === 'convert_pages') {
        res.pages
          .filter((p) => selectedIds.has(p.filename))
          .forEach((p) => entries.push({ name: p.filename, blob: p.blob }));
      } else {
        res.images
          .filter((i) => selectedIds.has(i.id))
          .forEach((i) => entries.push({ name: i.filename, blob: i.blob }));
      }

      if (entries.length === 1) {
        this.downloadSingleItem(entries[0].blob, entries[0].name);
      } else {
        const totalCount = res.mode === 'convert_pages' ? res.pages.length : res.images.length;
        const zipBlob = (selectedIds.size === totalCount && res.zipBlob && res.zipBlob.size > 0)
          ? res.zipBlob
          : await createStreamingZip(entries);
        const zipName = res.zipFilename || 'download-selected.zip';
        this.downloadSingleItem(zipBlob, zipName);
      }
    } finally {
      this.isDownloadingZip.set(false);
    }
  }

  showMoreResultItems(): void {
    this.resultPreviewLimit.update((curr) => curr + 60);
  }

  resetWorkspace(): void {
    this.cancelConversion();
    this.cleanupThumbnails();
    this.cleanupResultUrls();
    this.selectedFiles.set([]);
    this.conversionResult.set(null);
    this.selectedResultItemIds.set(new Set());
    this.errorMessage.set(null);
    this.currentState.set('upload');
    this.mode.set('convert_pages');
    this.pagesMode.set('all');
    this.pageRangeInput.set('');
    this.selectedPageNumbers.set([]);
    this.showAdvanced.set(false);
    this.isSidePanelOpen.set(false);
  }

  private cleanupThumbnails(): void {
    const files = this.selectedFiles();
    for (const f of files) {
      if (f.docProxy) {
        if (typeof this.pdfjsService?.destroyDocument === 'function') {
          this.pdfjsService.destroyDocument(f.docProxy);
        }
      }
    }
  }

  private cleanupResultUrls(): void {
    const res = this.conversionResult();
    if (res) {
      res.pages.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      res.images.forEach((i) => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      });
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
