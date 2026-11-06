import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PowerPointToPdfOptions,
  PowerPointToPdfOutput,
  PptLayout,
  HandoutPerPage,
  PageOrientation,
  SlidePageSize,
  ImageQuality
} from '@paperflow/contracts';
import { MergeResult } from '../../core/services/browser-pdf.service';
import {
  PowerPointToPdfService,
  ValidatedPowerPointFile,
  ConvertedPowerPointToPdfResult
} from '../../core/services/powerpoint-to-pdf.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-powerpoint-to-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './powerpoint-to-pdf.component.html',
  styleUrl: './powerpoint-to-pdf.component.css'
})
export class PowerPointToPdfComponent implements OnInit, OnDestroy {
  private pptService = inject(PowerPointToPdfService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  private abortController: AbortController | null = null;
  private currentRunId = 0;

  // Workspace state
  readonly currentState = signal<WorkspaceState>('upload');
  readonly selectedFiles = signal<ValidatedPowerPointFile[]>([]);
  readonly errorMessage = signal<string | null>(null);

  // Conversion options
  readonly outputFormat = signal<PowerPointToPdfOutput>('pdf');
  readonly layout = signal<PptLayout>('slides');

  // Handout options
  readonly handoutPerPage = signal<HandoutPerPage>(3);
  readonly handoutOrientation = signal<PageOrientation>('portrait');
  readonly handoutFrames = signal<boolean>(false);

  // Slide selection options
  readonly slideMode = signal<'all' | 'range'>('all');
  readonly slideRange = signal<string>('');
  readonly includeHiddenSlides = signal<boolean>(false);

  // Slide page size (Slides layout only)
  readonly pageSize = signal<SlidePageSize>('as_slide');

  // Checkboxes
  readonly comments = signal<boolean>(false);
  readonly bookmarks = signal<boolean>(true);
  readonly tagged = signal<boolean>(true);
  readonly hyperlinks = signal<boolean>(true);
  readonly imageQuality = signal<ImageQuality>('standard');
  readonly mergeFiles = signal<boolean>(false);

  // Processing state
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('Preparing presentation conversion...');
  readonly conversionResult = signal<ConvertedPowerPointToPdfResult | null>(null);
  readonly isWarningsDismissed = signal<boolean>(false);

  /** Controls mobile slide-in settings panel */
  readonly isSidePanelOpen = signal<boolean>(false);

  /** Controls collapsible advanced settings accordion */
  readonly showAdvanced = signal<boolean>(false);

  toggleAdvanced(): void {
    this.showAdvanced.set(!this.showAdvanced());
  }

  // Known total slides from the primary file
  readonly knownSlideCount = computed<number | undefined>(() => {
    const files = this.selectedFiles();
    if (files.length === 0) return undefined;
    return files[0].deckInfo?.slideCount;
  });

  // Range validation computed
  readonly slideRangeError = computed<string | null>(() => {
    if (this.slideMode() !== 'range') return null;
    const r = this.slideRange().trim();
    if (!r) return 'Please specify slide numbers or range (e.g. 1-3, 5).';

    const rangeRegex = /^(\s*\d+(\s*-\s*\d+)?\s*,)*\s*\d+(\s*-\s*\d+)?\s*$/;
    if (!rangeRegex.test(r)) {
      return 'Invalid range format. Use format like 1-3, 5, 8-10.';
    }

    const total = this.knownSlideCount();
    if (total !== undefined && total > 0) {
      const parts = r.split(',').map((p) => p.trim());
      for (const p of parts) {
        if (p.includes('-')) {
          const [startStr, endStr] = p.split('-').map((s) => s.trim());
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (start > total || end > total) {
            return `Range exceeds slide count (${total} slides in deck).`;
          }
          if (start > end) {
            return `Start slide (${start}) cannot be greater than end slide (${end}).`;
          }
        } else {
          const num = parseInt(p, 10);
          if (num > total) {
            return `Slide ${num} exceeds total slides (${total} slides in deck).`;
          }
        }
      }
    }
    return null;
  });

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
    const tool = this.toolRegistry.getToolById('powerpoint-to-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  ngOnDestroy(): void {
    this.revokeCurrentUrl();
    this.pptService.cleanupThumbnails(this.selectedFiles());
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.layoutService.showFooter();
  }

  // ────────────────────────────────────────────────────────────
  // File Upload & Selection
  // ────────────────────────────────────────────────────────────

  async onFilesAdded(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    this.errorMessage.set(null);

    const current = [...this.selectedFiles()];
    let addedCount = 0;

    for (const file of files) {
      // Duplicate check (name + size + lastModified)
      const isDuplicate = current.some(
        (f) =>
          f.name === file.name &&
          f.sizeBytes === file.size &&
          f.file.lastModified === file.lastModified
      );
      if (isDuplicate) continue;

      const validated = await this.pptService.validateFile(file);
      if (!validated.isValid) {
        this.errorMessage.set(validated.error || `File '${file.name}' could not be accepted.`);
        continue;
      }

      current.push(validated);
      addedCount++;
      if (current.length >= 10) break;
    }

    if (current.length > 10) {
      this.errorMessage.set('Maximum 10 presentations allowed per batch.');
      current.splice(10);
    }

    this.selectedFiles.set(current);

    if (current.length > 0 && this.currentState() === 'upload') {
      this.currentState.set('organize');
      this.layoutService.hideFooter();
    }
  }

  removeFile(index: number): void {
    const files = [...this.selectedFiles()];
    if (index >= 0 && index < files.length) {
      const removed = files.splice(index, 1);
      this.pptService.cleanupThumbnails(removed);
      this.selectedFiles.set(files);

      if (files.length === 0) {
        this.resetWorkspace();
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // External Cloud Drives
  // ────────────────────────────────────────────────────────────

  openGoogleDrive(event?: Event): void {
    event?.preventDefault();
    window.open('https://drive.google.com/', '_blank', 'noopener,noreferrer');
  }

  openDropbox(event?: Event): void {
    event?.preventDefault();
    window.open('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');
  }

  // ────────────────────────────────────────────────────────────
  // Conversion Execution
  // ────────────────────────────────────────────────────────────

  async executeConversion(): Promise<void> {
    const files = this.selectedFiles().filter((f) => f.isValid);
    if (files.length === 0) {
      this.errorMessage.set('Please add at least one presentation file to convert.');
      return;
    }

    if (this.slideRangeError()) {
      this.errorMessage.set(this.slideRangeError());
      return;
    }

    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.currentState.set('processing');
    this.processingProgress.set(10);
    this.processingMessage.set('Preparing conversion request...');

    const runId = ++this.currentRunId;
    this.abortController = new AbortController();

    const options: PowerPointToPdfOptions = {
      output: this.outputFormat(),
      layout: this.layout(),
      handout:
        this.layout() === 'handout'
          ? {
              perPage: this.handoutPerPage(),
              orientation: this.handoutOrientation(),
              frames: this.handoutFrames()
            }
          : undefined,
      slides: {
        mode: this.slideMode(),
        range: this.slideMode() === 'range' ? this.slideRange().trim() : undefined,
        includeHidden: this.includeHiddenSlides()
      },
      pageSize: this.layout() === 'slides' ? this.pageSize() : 'as_slide',
      comments: this.comments(),
      bookmarks: this.bookmarks(),
      tagged: this.tagged(),
      hyperlinks: this.hyperlinks(),
      imageQuality: this.imageQuality(),
      merge: this.mergeFiles() && files.length > 1
    };

    try {
      const result = await this.pptService.convertToPdf(
        files,
        options,
        (percent, message) => {
          if (this.currentRunId === runId) {
            this.processingProgress.set(percent);
            this.processingMessage.set(message);
          }
        },
        this.abortController.signal
      );

      if (this.currentRunId !== runId) return;

      this.revokeCurrentUrl();
      this.conversionResult.set(result);
      this.isProcessing.set(false);
      this.currentState.set('completed');
      this.layoutService.showFooter();
    } catch (err: any) {
      if (this.currentRunId !== runId) return;

      this.isProcessing.set(false);
      this.currentState.set('organize');
      this.layoutService.hideFooter();
      const msg = err.message || 'PowerPoint conversion failed. Please try again.';
      this.errorMessage.set(msg);
    } finally {
      this.abortController = null;
    }
  }

  cancelConversion(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.currentRunId++;
    this.isProcessing.set(false);
    this.currentState.set('organize');
    this.layoutService.hideFooter();
    this.errorMessage.set('Conversion was cancelled.');
  }

  resetWorkspace(): void {
    this.revokeCurrentUrl();
    this.pptService.cleanupThumbnails(this.selectedFiles());
    this.selectedFiles.set([]);
    this.conversionResult.set(null);
    this.errorMessage.set(null);
    this.isProcessing.set(false);
    this.isSidePanelOpen.set(false);
    this.showAdvanced.set(false);
    this.isWarningsDismissed.set(false);
    this.outputFormat.set('pdf');
    this.slideRange.set('');
    this.slideMode.set('all');
    this.layout.set('slides');
    this.pageSize.set('as_slide');
    this.handoutPerPage.set(3);
    this.handoutOrientation.set('portrait');
    this.handoutFrames.set(false);
    this.imageQuality.set('standard');
    this.mergeFiles.set(false);
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }

  private revokeCurrentUrl(): void {
    const res = this.conversionResult();
    if (res?.url) {
      try {
        URL.revokeObjectURL(res.url);
      } catch {
        // ignore
      }
    }
  }
}
