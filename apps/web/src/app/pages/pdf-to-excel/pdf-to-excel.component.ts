import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import {
  PdfToExcelMode,
  SheetLayout,
  MultiFileOutput,
  PdfDocumentAnalysis,
  PdfToExcelTable
} from '@paperflow/contracts';
import { ValidatedPdfFile, MergeResult } from '../../core/services/browser-pdf.service';
import {
  PdfToExcelService,
  ConvertedExcelResult
} from '../../core/services/pdf-to-excel.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-pdf-to-excel',
  standalone: true,
  imports: [
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './pdf-to-excel.component.html',
  styleUrl: './pdf-to-excel.component.css'
})
export class PdfToExcelComponent implements OnInit, OnDestroy {
  private excelService = inject(PdfToExcelService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  private abortController: AbortController | null = null;
  private currentRunId = 0;

  readonly Math = Math;

  readonly currentState = signal<WorkspaceState>('upload');
  readonly selectedFiles = signal<ValidatedPdfFile[]>([]);
  readonly errorMessage = signal<string | null>(null);

  // Options
  readonly selectedMode = signal<PdfToExcelMode>('no_ocr');
  readonly selectedSheetLayout = signal<SheetLayout>('sheet_per_page');
  readonly selectedMultiFileOutput = signal<MultiFileOutput>('separate_workbooks');
  readonly pageRange = signal<string>('');
  readonly detectTypes = signal<boolean>(true);
  readonly keepFormatting = signal<boolean>(true);
  readonly includeText = signal<boolean>(true);
  readonly mergeAcrossPages = signal<boolean>(true);
  readonly dismissedWarnings = signal<boolean>(false);

  // Analysis & Processing State
  readonly fileAnalysisMap = signal<Map<string, PdfDocumentAnalysis>>(new Map());
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('Validating document...');
  readonly conversionResult = signal<ConvertedExcelResult | null>(null);
  readonly sourcePdfPreviewUrl = signal<string | null>(null);
  readonly activeTableIndex = signal<number>(0);

  /** Controls the mobile slide-in settings panel */
  readonly isSidePanelOpen = signal<boolean>(false);

  // Computed Properties
  readonly ocrAvailable = computed<boolean>(() => this.excelService.isOcrAvailable());

  readonly totalPagesCount = computed<number>(() => {
    return this.selectedFiles().reduce((acc, f) => acc + (f.pageCount || 1), 0);
  });

  readonly documentAnalysis = computed<PdfDocumentAnalysis | null>(() => {
    const files = this.selectedFiles();
    if (files.length === 0) return null;

    const map = this.fileAnalysisMap();
    const analyses: PdfDocumentAnalysis[] = [];
    for (const f of files) {
      const a = map.get(f.id);
      if (a) analyses.push(a);
    }

    if (analyses.length === 0) return null;

    const totalPages = analyses.reduce((acc, a) => acc + a.totalPages, 0);
    const digitalPages = analyses.reduce((acc, a) => acc + a.digitalPages, 0);
    const scannedPages = analyses.reduce((acc, a) => acc + a.scannedPages, 0);

    const isFullyScanned = digitalPages === 0 && scannedPages > 0;
    const isMixed = digitalPages > 0 && scannedPages > 0;

    let summary = 'Digital PDF with selectable text detected. Tables will be extracted into structured Excel spreadsheets.';
    if (isFullyScanned) {
      summary = 'Scanned or image-only document. OCR mode is recommended to extract tables.';
    } else if (isMixed) {
      summary = 'Document contains both digital text pages and scanned pages.';
    }

    return {
      totalPages,
      digitalPages,
      scannedPages,
      isFullyScanned,
      isMixed,
      detectedTextSummary: summary,
      pages: analyses.flatMap(a => a.pages)
    };
  });

  readonly mergeResult = computed<MergeResult | null>(() => {
    const res = this.conversionResult();
    if (!res) return null;
    return {
      blob: res.blob,
      url: res.url,
      filename: res.filename,
      pageCount: res.sheetCount,
      sizeBytes: res.excelSizeBytes,
      formattedSize: res.formattedSize,
      previewUrl: this.sourcePdfPreviewUrl() || undefined
    };
  });

  readonly activeWarnings = computed<string[]>(() => {
    if (this.dismissedWarnings()) return [];
    const res = this.conversionResult();
    return res?.warnings || [];
  });

  readonly activeTable = computed<PdfToExcelTable | null>(() => {
    const res = this.conversionResult();
    if (!res?.tables?.length) return null;
    const idx = Math.min(this.activeTableIndex(), res.tables.length - 1);
    return res.tables[idx] || null;
  });

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('pdf-to-excel');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  ngOnDestroy(): void {
    this.currentRunId++;
    this.revokeCurrentUrl();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.layoutService.showFooter();
  }

  private revokeCurrentUrl(): void {
    const current = this.conversionResult();
    if (current?.url) {
      URL.revokeObjectURL(current.url);
    }
    const pUrl = this.sourcePdfPreviewUrl();
    if (pUrl) {
      URL.revokeObjectURL(pUrl);
      this.sourcePdfPreviewUrl.set(null);
    }
  }

  private fileKey(f: File): string {
    return `${f.name}|${f.size}|${f.lastModified}`;
  }

  async onFilesAdded(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    this.errorMessage.set(null);

    const validated: ValidatedPdfFile[] = [];
    const existingKeys = new Set(this.selectedFiles().map(f => this.fileKey(f.file)));
    let duplicatesSkipped = 0;

    for (const f of files) {
      const key = this.fileKey(f);
      if (existingKeys.has(key)) {
        duplicatesSkipped++;
        continue;
      }
      existingKeys.add(key);

      try {
        const v = await this.excelService.validatePdf(f);
        if (v.isValid) {
          validated.push(v);
        } else {
          this.errorMessage.set(v.error || `Invalid PDF document: ${f.name}`);
        }
      } catch {
        this.errorMessage.set(`Failed to validate file: ${f.name}`);
      }
    }

    if (duplicatesSkipped > 0 && validated.length === 0) {
      this.errorMessage.set('Duplicate file(s) skipped: already added to workspace.');
      return;
    }

    if (validated.length > 0) {
      this.selectedFiles.set(validated);
      this.currentState.set('organize');
      this.layoutService.hideFooter();

      // Analyze documents and update analysis map
      const analysisMap = new Map<string, PdfDocumentAnalysis>();
      for (const item of validated) {
        try {
          const analysis = await this.excelService.analyzePdf(item.file);
          analysisMap.set(item.id, analysis);
        } catch {
          analysisMap.set(item.id, {
            totalPages: item.pageCount || 1,
            digitalPages: 1,
            scannedPages: 0,
            isFullyScanned: false,
            isMixed: false,
            detectedTextSummary: 'Standard digital document detected.',
            pages: []
          });
        }
      }
      this.fileAnalysisMap.set(analysisMap);

      // Preselect OCR ONLY when ALL files are fully scanned and OCR is available
      const allFullyScanned = validated.every(item => {
        const a = analysisMap.get(item.id);
        return a && a.isFullyScanned;
      });
      if (allFullyScanned && this.ocrAvailable()) {
        this.selectedMode.set('ocr');
      }
    }
  }

  async onMoreFilesAdded(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const current = [...this.selectedFiles()];
    const currentMap = new Map(this.fileAnalysisMap());
    const existingKeys = new Set(current.map(f => this.fileKey(f.file)));
    let hasInvalid = false;
    let duplicatesSkipped = 0;

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const key = this.fileKey(file);
      if (existingKeys.has(key)) {
        duplicatesSkipped++;
        continue;
      }
      existingKeys.add(key);

      try {
        const v = await this.excelService.validatePdf(file);
        if (v.isValid) {
          current.push(v);
          try {
            const analysis = await this.excelService.analyzePdf(file);
            currentMap.set(v.id, analysis);
          } catch {
            currentMap.set(v.id, {
              totalPages: v.pageCount || 1,
              digitalPages: 1,
              scannedPages: 0,
              isFullyScanned: false,
              isMixed: false,
              detectedTextSummary: 'Standard digital document detected.',
              pages: []
            });
          }
        } else {
          hasInvalid = true;
          this.errorMessage.set(v.error || `Invalid PDF document: ${file.name}`);
        }
      } catch {
        hasInvalid = true;
        this.errorMessage.set(`Failed to validate file: ${file.name}`);
      }
    }

    if (duplicatesSkipped > 0 && !hasInvalid) {
      this.errorMessage.set(`${duplicatesSkipped} duplicate file(s) ignored.`);
    } else if (!hasInvalid) {
      this.errorMessage.set(null);
    }

    this.selectedFiles.set(current);
    this.fileAnalysisMap.set(currentMap);
    input.value = '';
  }

  removeFile(id: string): void {
    const updated = this.selectedFiles().filter(f => f.id !== id);
    const updatedMap = new Map(this.fileAnalysisMap());
    updatedMap.delete(id);

    this.selectedFiles.set(updated);
    this.fileAnalysisMap.set(updatedMap);

    if (updated.length === 0) {
      this.resetWorkspace();
      return;
    }

    const allScanned = updated.every(item => {
      const a = updatedMap.get(item.id);
      return a && a.isFullyScanned;
    });
    if (allScanned && this.ocrAvailable()) {
      this.selectedMode.set('ocr');
    } else if (!allScanned && this.selectedMode() === 'ocr') {
      this.selectedMode.set('no_ocr');
    }
  }

  cancelConversion(): void {
    this.currentRunId++;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing.set(false);
    this.currentState.set('organize');
    this.layoutService.hideFooter();
    this.errorMessage.set('Conversion was cancelled.');
  }

  async startConversion(): Promise<void> {
    const files = this.selectedFiles();
    if (files.length === 0 || this.isProcessing()) return;

    // Validate page range format if provided
    const range = this.pageRange().trim();
    if (range && !/^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/.test(range) && !range.toLowerCase().includes('all')) {
      this.errorMessage.set("Invalid page range format. Please use '1-3,5' or 'All pages'.");
      return;
    }

    this.revokeCurrentUrl();
    if (this.abortController) {
      this.abortController.abort();
    }
    const controller = new AbortController();
    this.abortController = controller;
    const runId = ++this.currentRunId;

    this.isProcessing.set(true);
    this.processingProgress.set(10);
    this.processingMessage.set('Preparing conversion...');
    this.currentState.set('processing');
    this.errorMessage.set(null);
    this.dismissedWarnings.set(false);

    try {
      const result = await this.excelService.convertToExcel(
        files,
        {
          mode: this.selectedMode(),
          sheetLayout: this.selectedSheetLayout(),
          multiFileOutput: this.selectedMultiFileOutput(),
          pages: range || undefined,
          detectTypes: this.detectTypes(),
          keepFormatting: this.keepFormatting(),
          includeText: this.includeText(),
          mergeAcrossPages: this.mergeAcrossPages()
        },
        (progress, message) => {
          if (this.currentRunId === runId && !controller.signal.aborted) {
            this.processingProgress.set(progress);
            this.processingMessage.set(message);
          }
        },
        controller.signal
      );

      if (this.currentRunId === runId && !controller.signal.aborted) {
        if (files[0]?.file) {
          this.sourcePdfPreviewUrl.set(URL.createObjectURL(files[0].file));
        }
        this.conversionResult.set(result);
        this.activeTableIndex.set(0);
        this.currentState.set('completed');
        this.layoutService.showFooter();
      }
    } catch (err: unknown) {
      if (this.currentRunId === runId && !controller.signal.aborted) {
        this.errorMessage.set(err instanceof Error ? err.message : 'Conversion failed. Please try again.');
        this.currentState.set('organize');
        this.layoutService.hideFooter();
      }
    } finally {
      if (this.currentRunId === runId) {
        this.isProcessing.set(false);
      }
    }
  }

  selectPreviewTable(index: number): void {
    this.activeTableIndex.set(index);
  }

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

  dismissWarningBanner(): void {
    this.dismissedWarnings.set(true);
  }

  toggleSidePanel(): void {
    this.isSidePanelOpen.update(v => !v);
  }

  closeSidePanel(): void {
    this.isSidePanelOpen.set(false);
  }

  resetWorkspace(): void {
    this.currentRunId++;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isSidePanelOpen.set(false);
    this.revokeCurrentUrl();
    this.selectedFiles.set([]);
    this.fileAnalysisMap.set(new Map());
    this.conversionResult.set(null);
    this.errorMessage.set(null);
    this.dismissedWarnings.set(false);
    this.selectedMode.set('no_ocr');
    this.selectedSheetLayout.set('sheet_per_table');
    this.selectedMultiFileOutput.set('separate_workbooks');
    this.pageRange.set('');
    this.detectTypes.set(true);
    this.keepFormatting.set(true);
    this.includeText.set(false);
    this.mergeAcrossPages.set(true);
    this.activeTableIndex.set(0);
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }
}
