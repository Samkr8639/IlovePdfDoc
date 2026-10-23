import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PdfToWordMode, PdfDocumentAnalysis } from '@paperflow/contracts';
import { ValidatedPdfFile } from '../../core/services/browser-pdf.service';
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
export class PdfToWordComponent implements OnInit {
  private pdfToWordService = inject(PdfToWordService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);

  currentState = signal<WorkspaceState>('upload');
  selectedFiles = signal<ValidatedPdfFile[]>([]);
  errorMessage = signal<string | null>(null);
  selectedMode = signal<PdfToWordMode>('no_ocr');
  documentAnalysis = signal<PdfDocumentAnalysis | null>(null);

  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingMessage = signal<string>('Validating document...');
  conversionResult = signal<ConvertedWordResult | null>(null);

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('pdf-to-word');
    if (tool) {
      this.seo.setSeoData(tool.seo);
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
      const analysis = await this.pdfToWordService.analyzePdf(validated[0].file);
      this.documentAnalysis.set(analysis);
      if (analysis.isFullyScanned) {
        this.selectedMode.set('ocr');
      }
    }
  }

  async onMoreFilesAdded(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const current = [...this.selectedFiles()];
    for (let i = 0; i < input.files.length; i++) {
      const v = await this.pdfToWordService.validatePdf(input.files[i]);
      if (v.isValid) {
        current.push(v);
      }
    }
    this.selectedFiles.set(current);
    input.value = '';
  }

  removeFile(id: string): void {
    const updated = this.selectedFiles().filter(f => f.id !== id);
    this.selectedFiles.set(updated);
    if (updated.length === 0) {
      this.resetWorkspace();
    }
  }

  async startConversion(): Promise<void> {
    const files = this.selectedFiles();
    if (files.length === 0) return;

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

      this.conversionResult.set(result);
      this.currentState.set('completed');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Conversion failed. Please try again.');
      this.currentState.set('organize');
    } finally {
      this.isProcessing.set(false);
    }
  }

  resetWorkspace(): void {
    this.selectedFiles.set([]);
    this.conversionResult.set(null);
    this.errorMessage.set(null);
    this.documentAnalysis.set(null);
    this.selectedMode.set('no_ocr');
    this.currentState.set('upload');
  }

  asMergeResult(res: ConvertedWordResult) {
    return {
      blob: res.blob,
      url: res.url,
      filename: res.filename,
      pageCount: res.pageCount,
      sizeBytes: res.wordSizeBytes,
      formattedSize: res.formattedWordSize
    };
  }
}
