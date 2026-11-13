import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserPdfService, ValidatedPdfFile, SplitPdfResult } from '../../core/services/browser-pdf.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';
import { ExploreMoreToolsComponent } from '../../shared/components/explore-more-tools/explore-more-tools.component';
import { SplitRangeParser, PageRange } from '../../core/utils/split-range-parser';
import { TranslatePipe } from '@ngx-translate/core';

export type SplitMode = 'custom' | 'fixed' | 'extract_all';
export type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

export interface EditableRange {
  id: string;
  from: number;
  to: number;
}

const CHUNK_PALETTE = [
  'chunk-teal',
  'chunk-amber',
  'chunk-blue',
  'chunk-purple',
  'chunk-coral',
  'chunk-emerald'
];

@Component({
  selector: 'app-split-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent,
    ExploreMoreToolsComponent,
    TranslatePipe
  ],
  templateUrl: './split-pdf.component.html',
  styleUrl: './split-pdf.component.css'
})
export class SplitPdfComponent implements OnInit, OnDestroy {
  private pdfService = inject(BrowserPdfService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  currentState = signal<WorkspaceState>('upload');
  selectedFile = signal<ValidatedPdfFile | null>(null);
  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingMessage = signal<string>('');
  errorMessage = signal<string | null>(null);
  splitResult = signal<SplitPdfResult | null>(null);

  // Split Configuration State
  splitMode = signal<SplitMode>('custom');
  customRanges = signal<EditableRange[]>([
    { id: '1', from: 1, to: 1 }
  ]);
  fixedChunkSize = signal<number>(2);

  readonly totalPages = computed(() => this.selectedFile()?.pageCount || 1);

  /**
   * Generates the concrete page ranges according to the current split mode.
   */
  readonly activeChunks = computed<PageRange[]>(() => {
    const total = this.totalPages();
    const mode = this.splitMode();

    if (mode === 'extract_all') {
      return SplitRangeParser.generateFixedRanges(total, 1);
    }

    if (mode === 'fixed') {
      const size = Math.max(1, this.fixedChunkSize());
      return SplitRangeParser.generateFixedRanges(total, size);
    }

    // Custom ranges mode
    return this.customRanges().map(r => ({
      from: Number(r.from),
      to: Number(r.to)
    }));
  });

  /**
   * Detailed validation of active ranges.
   */
  readonly validation = computed(() => {
    const total = this.totalPages();
    const mode = this.splitMode();
    const errors: Record<string, string> = {};
    let globalError: string | null = null;

    if (mode === 'fixed') {
      const size = this.fixedChunkSize();
      if (!size || size < 1) {
        globalError = 'Pages per chunk must be at least 1.';
      } else if (size > total) {
        globalError = `Pages per chunk cannot exceed total pages (${total}).`;
      }
      return { isValid: !globalError, errors, globalError };
    }

    if (mode === 'extract_all') {
      return { isValid: true, errors, globalError: null };
    }

    // Custom mode validation
    const ranges = this.customRanges();
    if (ranges.length === 0) {
      return { isValid: false, errors, globalError: 'Please add at least one page range.' };
    }

    const seenPages = new Map<number, string>(); // page -> range id

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const from = Number(r.from);
      const to = Number(r.to);

      if (isNaN(from) || isNaN(to)) {
        errors[r.id] = 'Page numbers must be integers.';
        continue;
      }
      if (from < 1) {
        errors[r.id] = 'Start page must be at least 1.';
        continue;
      }
      if (to < 1) {
        errors[r.id] = 'End page must be at least 1.';
        continue;
      }
      if (from > total) {
        errors[r.id] = `Start page ${from} exceeds total pages (${total}).`;
        continue;
      }
      if (to > total) {
        errors[r.id] = `End page ${to} exceeds total pages (${total}).`;
        continue;
      }
      if (from > to) {
        errors[r.id] = `Start page (${from}) cannot be greater than end page (${to}).`;
        continue;
      }

      // Overlap detection
      for (let p = from; p <= to; p++) {
        if (seenPages.has(p)) {
          errors[r.id] = `Page ${p} overlaps with an earlier range.`;
          break;
        }
        seenPages.set(p, r.id);
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    return {
      isValid: !hasErrors && !globalError,
      errors,
      globalError: hasErrors ? 'Please fix the range errors above before splitting.' : null
    };
  });

  /**
   * Maps each document page (1..N) to its chunk index and styling palette.
   */
  readonly pageAssignments = computed(() => {
    const total = this.totalPages();
    const chunks = this.activeChunks();
    const map = new Map<number, { chunkIndex: number; colorClass: string; label: string }>();

    chunks.forEach((chunk, idx) => {
      const colorClass = CHUNK_PALETTE[idx % CHUNK_PALETTE.length];
      const label = `Part ${idx + 1}`;
      const from = Math.max(1, Math.min(chunk.from, total));
      const to = Math.max(from, Math.min(chunk.to, total));
      for (let p = from; p <= to; p++) {
        if (!map.has(p)) {
          map.set(p, { chunkIndex: idx + 1, colorClass, label });
        }
      }
    });

    const pages: Array<{ pageNum: number; assigned: boolean; chunkIndex?: number; colorClass?: string; label?: string }> = [];
    for (let p = 1; p <= total; p++) {
      const assignment = map.get(p);
      if (assignment) {
        pages.push({ pageNum: p, assigned: true, ...assignment });
      } else {
        pages.push({ pageNum: p, assigned: false, label: 'Excluded' });
      }
    }

    return pages;
  });

  readonly outputFilesCount = computed(() => this.activeChunks().length);
  readonly isZipOutput = computed(() => this.outputFilesCount() > 1);

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('split-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  ngOnDestroy(): void {
    this.layoutService.showFooter();
  }

  async onFilesAdded(files: File[]): Promise<void> {
    this.errorMessage.set(null);
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      this.errorMessage.set('Split PDF accepts one PDF at a time. The first file was selected.');
    }

    const targetFile = files[0];
    try {
      const validated = await this.pdfService.validatePdf(targetFile);
      if (!validated.isValid) {
        this.errorMessage.set(validated.error || 'Invalid or encrypted PDF file.');
        return;
      }

      this.selectedFile.set(validated);
      // Initialize default custom range to full document or first 2 pages
      const pages = validated.pageCount;
      this.customRanges.set([
        { id: '1', from: 1, to: Math.min(2, pages) }
      ]);
      this.fixedChunkSize.set(Math.min(2, pages));

      this.currentState.set('organize');
      this.layoutService.hideFooter();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to read PDF document.');
    }
  }

  setSplitMode(mode: SplitMode): void {
    this.splitMode.set(mode);
  }

  addCustomRange(): void {
    const current = this.customRanges();
    const total = this.totalPages();
    const lastRange = current[current.length - 1];
    const nextFrom = lastRange ? Math.min(Number(lastRange.to) + 1, total) : 1;
    const nextTo = Math.min(nextFrom + 1, total);

    const newId = (Date.now() + Math.random()).toString();
    this.customRanges.set([...current, { id: newId, from: nextFrom, to: nextTo }]);
  }

  removeCustomRange(id: string): void {
    const current = this.customRanges();
    if (current.length <= 1) return;
    this.customRanges.set(current.filter(r => r.id !== id));
  }

  updateCustomRange(id: string, field: 'from' | 'to', value: string): void {
    const numeric = parseInt(value, 10);
    const current = this.customRanges();
    this.customRanges.set(
      current.map(r => (r.id === id ? { ...r, [field]: isNaN(numeric) ? 0 : numeric } : r))
    );
  }

  changeFixedChunkSize(delta: number): void {
    const current = this.fixedChunkSize();
    const total = this.totalPages();
    const next = Math.max(1, Math.min(current + delta, total));
    this.fixedChunkSize.set(next);
  }

  changeFile(): void {
    this.selectedFile.set(null);
    this.splitResult.set(null);
    this.errorMessage.set(null);
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }

  async executeSplit(): Promise<void> {
    const file = this.selectedFile();
    if (!file || !this.validation().isValid) return;

    this.isProcessing.set(true);
    this.processingProgress.set(10);
    this.processingMessage.set('Preparing document for splitting...');
    this.currentState.set('processing');

    try {
      const mode = this.splitMode();
      let options: any = {};

      if (mode === 'extract_all') {
        options.mode = 'extract_all';
      } else if (mode === 'fixed') {
        options.mode = 'fixed_ranges';
        options.fixedPageCount = this.fixedChunkSize();
      } else {
        options.mode = 'custom_ranges';
        options.ranges = this.activeChunks();
      }

      const result = await this.pdfService.splitPdf(
        file.file,
        options,
        (progress, message) => {
          this.processingProgress.set(progress);
          this.processingMessage.set(message);
        }
      );

      this.splitResult.set(result);
      this.currentState.set('completed');
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'An error occurred while splitting the PDF.');
      this.currentState.set('organize');
    } finally {
      this.isProcessing.set(false);
    }
  }

  resetWorkspace(): void {
    this.changeFile();
  }
}
