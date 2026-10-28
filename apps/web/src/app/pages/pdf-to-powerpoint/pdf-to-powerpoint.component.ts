import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import {
  PdfToPowerPointMode,
  PdfToPowerPointSlideSize,
  PdfDocumentAnalysis
} from '@paperflow/contracts';
import { ValidatedPdfFile, MergeResult } from '../../core/services/browser-pdf.service';
import {
  PdfToPowerPointService,
  ConvertedPowerPointResult
} from '../../core/services/pdf-to-powerpoint.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-pdf-to-powerpoint',
  standalone: true,
  imports: [
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './pdf-to-powerpoint.component.html',
  styleUrl: './pdf-to-powerpoint.component.css'
})
export class PdfToPowerPointComponent implements OnInit, OnDestroy {
  private pptService = inject(PdfToPowerPointService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  private abortController: AbortController | null = null;
  private currentRunId = 0;

  readonly currentState = signal<WorkspaceState>('upload');
  readonly selectedFiles = signal<ValidatedPdfFile[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedMode = signal<PdfToPowerPointMode>('no_ocr');
  readonly selectedSlideSize = signal<PdfToPowerPointSlideSize>('match_pdf');
  readonly dismissedWarnings = signal<boolean>(false);

  // Per-file document analysis map to prevent stale data
  readonly fileAnalysisMap = signal<Map<string, PdfDocumentAnalysis>>(new Map());

  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('Validating document...');
  readonly conversionResult = signal<ConvertedPowerPointResult | null>(null);
  readonly sourcePdfPreviewUrl = signal<string | null>(null);

  // Check if OCR is available in the current environment
  readonly ocrAvailable = computed<boolean>(() => this.pptService.isOcrAvailable());

  // Aggregate document analysis computed from all currently selected files
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

    let summary = 'Digital PDF with selectable text detected. Converted to real editable PowerPoint shapes and text boxes.';
    if (isFullyScanned) {
      summary = 'Scanned or image-only document. OCR mode is recommended to extract editable text layers.';
    } else if (isMixed) {
      summary = 'Document contains both digital text pages and scanned image pages.';
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

  // Result bridge for ResultViewComponent - computed to avoid allocation churn in template
  readonly mergeResult = computed<MergeResult | null>(() => {
    const res = this.conversionResult();
    if (!res) return null;
    return {
      blob: res.blob,
      url: res.url,
      filename: res.filename,
      pageCount: res.slideCount,
      sizeBytes: res.pptxSizeBytes,
      formattedSize: res.formattedSize,
      previewUrl: this.sourcePdfPreviewUrl() || undefined
    };
  });

  // Active warnings computed from result
  readonly activeWarnings = computed<string[]>(() => {
    if (this.dismissedWarnings()) return [];
    const res = this.conversionResult();
    return res?.warnings || [];
  });

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('pdf-to-powerpoint');
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
        const v = await this.pptService.validatePdf(f);
        if (v.isValid) {
          validated.push(v);
        } else {
          this.errorMessage.set(v.error || `Invalid PDF document: ${f.name}`);
        }
      } catch (err) {
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
          const analysis = await this.pptService.analyzePdf(item.file);
          analysisMap.set(item.id, analysis);
        } catch {
          // Fallback analysis
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
        const v = await this.pptService.validatePdf(file);
        if (v.isValid) {
          current.push(v);
          try {
            const analysis = await this.pptService.analyzePdf(file);
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

    // Check if remaining files are all scanned
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
      const result = await this.pptService.convertToPowerPoint(
        files,
        {
          mode: this.selectedMode(),
          slideSize: this.selectedSlideSize()
        },
        (progress, message) => {
          if (this.currentRunId === runId && !controller.signal.aborted) {
            this.processingProgress.set(progress);
            this.processingMessage.set(message);
          }
        },
        controller.signal
      );

      // Verify runId guard and controller signal before applying result
      if (this.currentRunId === runId && !controller.signal.aborted) {
        if (files[0]?.file) {
          this.sourcePdfPreviewUrl.set(URL.createObjectURL(files[0].file));
        }
        this.conversionResult.set(result);
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

  resetWorkspace(): void {
    this.currentRunId++;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.revokeCurrentUrl();
    this.selectedFiles.set([]);
    this.fileAnalysisMap.set(new Map());
    this.conversionResult.set(null);
    this.errorMessage.set(null);
    this.dismissedWarnings.set(false);
    this.selectedMode.set('no_ocr');
    this.selectedSlideSize.set('match_pdf');
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }
}
