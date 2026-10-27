import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PdfToWordMode, PdfDocumentAnalysis } from '@paperflow/contracts';
import { ValidatedPdfFile, MergeResult } from '../../core/services/browser-pdf.service';
import { PdfToWordService, ConvertedWordResult } from '../../core/services/pdf-to-word.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-pdf-to-word',
  standalone: true,
  imports: [
    RouterLink,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './pdf-to-word.component.html',
  styleUrl: './pdf-to-word.component.css'
})
export class PdfToWordComponent implements OnInit, OnDestroy {
  private pdfToWordService = inject(PdfToWordService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private abortController: AbortController | null = null;

  currentState = signal<WorkspaceState>('upload');
  selectedFiles = signal<ValidatedPdfFile[]>([]);
  errorMessage = signal<string | null>(null);
  selectedMode = signal<PdfToWordMode>('no_ocr');
  documentAnalysis = signal<PdfDocumentAnalysis | null>(null);

  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingMessage = signal<string>('Validating document...');
  conversionResult = signal<ConvertedWordResult | null>(null);

  readonly mergeResult = computed<MergeResult | null>(() => {
    const res = this.conversionResult();
    if (!res) return null;
    return {
      blob: res.blob,
      url: res.url,
      filename: res.filename,
      pageCount: res.pageCount,
      sizeBytes: res.wordSizeBytes,
      formattedSize: res.formattedWordSize
    };
  });

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('pdf-to-word');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  ngOnDestroy(): void {
    this.revokeCurrentUrl();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private revokeCurrentUrl(): void {
    const current = this.conversionResult();
    if (current?.url) {
      URL.revokeObjectURL(current.url);
    }
  }

  async onFilesAdded(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    this.errorMessage.set(null);

    const validated: ValidatedPdfFile[] = [];
    for (const f of files) {
      const v = await this.pdfToWordService.validatePdf(f);
      if (v.isValid) {
        validated.push(v);
      } else {
        this.errorMessage.set(v.error || `Invalid PDF document: ${f.name}`);
      }
    }

    if (validated.length > 0) {
      this.selectedFiles.set(validated);
      this.currentState.set('organize');

      // Analyze the first document to determine if it has selectable text or is scanned
      try {
        const analysis = await this.pdfToWordService.analyzePdf(validated[0].file);
        this.documentAnalysis.set(analysis);
        if (analysis.isFullyScanned) {
          this.selectedMode.set('ocr');
        }
      } catch {
        this.documentAnalysis.set(null);
      }
    }
  }

  async onMoreFilesAdded(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const current = [...this.selectedFiles()];
    let hasInvalid = false;
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const v = await this.pdfToWordService.validatePdf(file);
      if (v.isValid) {
        current.push(v);
      } else {
        hasInvalid = true;
        this.errorMessage.set(v.error || `Invalid PDF document: ${file.name}`);
      }
    }
    if (!hasInvalid) {
      this.errorMessage.set(null);
    }
    this.selectedFiles.set(current);
    input.value = '';
  }

  async removeFile(id: string): Promise<void> {
    const updated = this.selectedFiles().filter(f => f.id !== id);
    this.selectedFiles.set(updated);
    if (updated.length === 0) {
      this.resetWorkspace();
      return;
    }

    // Re-evaluate document analysis for the new head file if needed
    try {
      const analysis = await this.pdfToWordService.analyzePdf(updated[0].file);
      this.documentAnalysis.set(analysis);
      if (analysis.isFullyScanned) {
        this.selectedMode.set('ocr');
      }
    } catch {
      this.documentAnalysis.set(null);
    }
  }

  async startConversion(): Promise<void> {
    const files = this.selectedFiles();
    if (files.length === 0 || this.isProcessing()) return;

    this.revokeCurrentUrl();
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.isProcessing.set(true);
    this.processingProgress.set(10);
    this.processingMessage.set('Preparing conversion...');
    this.currentState.set('processing');
    this.errorMessage.set(null);

    try {
      const result = await this.pdfToWordService.convertToWord(
        files,
        { mode: this.selectedMode() },
        (progress, message) => {
          this.processingProgress.set(progress);
          this.processingMessage.set(message);
        }
      );

      // Only update if not aborted/reset
      if (!this.abortController?.signal.aborted) {
        this.conversionResult.set(result);
        this.currentState.set('completed');
      }
    } catch (err) {
      if (!this.abortController?.signal.aborted) {
        this.errorMessage.set(err instanceof Error ? err.message : 'Conversion failed. Please try again.');
        this.currentState.set('organize');
      }
    } finally {
      this.isProcessing.set(false);
    }
  }

  resetWorkspace(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.revokeCurrentUrl();
    this.selectedFiles.set([]);
    this.conversionResult.set(null);
    this.errorMessage.set(null);
    this.documentAnalysis.set(null);
    this.selectedMode.set('no_ocr');
    this.currentState.set('upload');
  }
}
