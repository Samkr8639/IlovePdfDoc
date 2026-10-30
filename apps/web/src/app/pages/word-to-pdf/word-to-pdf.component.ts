import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { WordToPdfOptions, WordToPdfOutput, WordToPdfImageQuality } from '@paperflow/contracts';
import { MergeResult } from '../../core/services/browser-pdf.service';
import {
  WordToPdfService,
  ValidatedWordFile,
  ConvertedWordToPdfResult
} from '../../core/services/word-to-pdf.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-word-to-pdf',
  standalone: true,
  imports: [
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './word-to-pdf.component.html',
  styleUrl: './word-to-pdf.component.css'
})
export class WordToPdfComponent implements OnInit, OnDestroy {
  private wordToPdfService = inject(WordToPdfService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  private abortController: AbortController | null = null;
  private currentRunId = 0;

  // Workspace state
  readonly currentState = signal<WorkspaceState>('upload');
  readonly selectedFiles = signal<ValidatedWordFile[]>([]);
  readonly errorMessage = signal<string | null>(null);

  // Conversion options
  readonly outputFormat = signal<WordToPdfOutput>('pdf');
  readonly imageQuality = signal<WordToPdfImageQuality>('standard');
  readonly embedBookmarks = signal<boolean>(true);
  readonly useTaggedPdf = signal<boolean>(false);
  readonly exportHyperlinks = signal<boolean>(true);

  // Processing state
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('Preparing conversion...');
  readonly conversionResult = signal<ConvertedWordToPdfResult | null>(null);

  // Computed result view-model for ResultViewComponent
  readonly resultViewModel = computed<MergeResult | null>(() => {
    const res = this.conversionResult();
    if (!res) return null;
    return {
      blob: res.blob,
      url: res.url,
      filename: res.filename,
      pageCount: res.pageCount,
      sizeBytes: res.pdfSizeBytes,
      formattedSize: res.formattedPdfSize
    };
  });

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('word-to-pdf');
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
    this.layoutService.showFooter();
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

    const validated: ValidatedWordFile[] = [];
    const existing = this.selectedFiles();

    for (const f of files) {
      // Duplicate detection
      const isDuplicate = existing.some(
        e => e.name === f.name && e.sizeBytes === f.size && e.file.lastModified === f.lastModified
      );
      if (isDuplicate) {
        continue;
      }

      try {
        const v = await this.wordToPdfService.validateFile(f);
        if (v.isValid) {
          validated.push(v);
        } else {
          this.errorMessage.set(v.error || `Invalid document: ${f.name}`);
        }
      } catch (err) {
        this.errorMessage.set(`Failed to validate file: ${f.name}`);
      }
    }

    if (validated.length > 0) {
      const combined = [...existing, ...validated];
      if (combined.length > 10) {
        this.errorMessage.set('Maximum 10 files allowed per conversion. Extra files were excluded.');
        this.selectedFiles.set(combined.slice(0, 10));
      } else {
        this.selectedFiles.set(combined);
      }
      this.currentState.set('organize');
      this.layoutService.hideFooter();
    }
  }

  async onMoreFilesAdded(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    await this.onFilesAdded(Array.from(input.files));
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
    if (files.length === 0 || this.isProcessing()) return;

    this.revokeCurrentUrl();
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const runId = ++this.currentRunId;

    this.isProcessing.set(true);
    this.processingProgress.set(10);
    this.processingMessage.set('Preparing conversion...');
    this.currentState.set('processing');
    this.errorMessage.set(null);

    const options: WordToPdfOptions = {
      output: this.outputFormat(),
      imageQuality: this.imageQuality(),
      embedBookmarks: this.embedBookmarks(),
      useTaggedPdf: this.useTaggedPdf(),
      exportHyperlinks: this.exportHyperlinks()
    };

    try {
      const result = await this.wordToPdfService.convertToPdf(
        files,
        options,
        (progress, message) => {
          if (this.currentRunId === runId && !this.abortController?.signal.aborted) {
            this.processingProgress.set(progress);
            this.processingMessage.set(message);
          }
        },
        this.abortController.signal
      );

      if (this.currentRunId === runId && !this.abortController.signal.aborted) {
        this.conversionResult.set(result);
        this.currentState.set('completed');
        this.layoutService.showFooter();
      }
    } catch (err: unknown) {
      if (this.currentRunId === runId && !this.abortController?.signal.aborted) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Conversion failed. Please verify your document and try again.';
        this.errorMessage.set(errorMsg);
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

  resetWorkspace(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.currentRunId++;
    this.revokeCurrentUrl();
    this.selectedFiles.set([]);
    this.conversionResult.set(null);
    this.errorMessage.set(null);
    this.outputFormat.set('pdf');
    this.imageQuality.set('standard');
    this.embedBookmarks.set(true);
    this.useTaggedPdf.set(false);
    this.exportHyperlinks.set(true);
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }
}
