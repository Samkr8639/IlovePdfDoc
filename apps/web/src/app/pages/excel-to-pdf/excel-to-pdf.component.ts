import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ExcelToPdfOptions,
  ExcelToPdfOutput,
  PageSize,
  Orientation,
  ScalingMode,
  Margins
} from '@paperflow/contracts';
import { MergeResult } from '../../core/services/browser-pdf.service';
import {
  ExcelToPdfService,
  ValidatedExcelFile,
  ConvertedExcelToPdfResult
} from '../../core/services/excel-to-pdf.service';
import { SheetInfo } from '../../core/services/sheet-names';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-excel-to-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './excel-to-pdf.component.html',
  styleUrl: './excel-to-pdf.component.css'
})
export class ExcelToPdfComponent implements OnInit, OnDestroy {
  private excelToPdfService = inject(ExcelToPdfService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  private abortController: AbortController | null = null;
  private currentRunId = 0;

  // Workspace state
  readonly currentState = signal<WorkspaceState>('upload');
  readonly selectedFiles = signal<ValidatedExcelFile[]>([]);
  readonly errorMessage = signal<string | null>(null);

  // Conversion options
  readonly outputFormat = signal<ExcelToPdfOutput>('pdf');
  readonly sheetMode = signal<'all' | 'first' | 'selected'>('all');
  readonly selectedSheetNames = signal<string[]>([]);
  readonly includeHiddenSheets = signal<boolean>(false);

  readonly pageSize = signal<PageSize>('as_file');
  readonly orientation = signal<Orientation>('as_file');
  readonly scaling = signal<ScalingMode>('as_file');
  readonly customScale = signal<number>(100);
  readonly margins = signal<Margins>('as_file');

  readonly gridlines = signal<boolean>(false);
  readonly headings = signal<boolean>(false);
  readonly repeatHeader = signal<boolean>(true);
  readonly pageNumbers = signal<boolean>(false);
  readonly bookmarks = signal<boolean>(true);
  readonly trimEmpty = signal<boolean>(true);
  readonly mergeFiles = signal<boolean>(false);

  // Processing state
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('Preparing spreadsheet conversion...');
  readonly conversionResult = signal<ConvertedExcelToPdfResult | null>(null);

  /** Controls mobile slide-in settings panel */
  readonly isSidePanelOpen = signal<boolean>(false);

  // Computed all available sheets across uploaded files
  readonly availableSheets = computed<SheetInfo[]>(() => {
    const files = this.selectedFiles();
    if (files.length === 0) return [];
    // Primary sheets from the first selected file, or union of sheets
    return files[0].sheets || [];
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
    const tool = this.toolRegistry.getToolById('excel-to-pdf');
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

    const validated: ValidatedExcelFile[] = [];
    const existing = this.selectedFiles();

    for (const f of files) {
      const isDuplicate = existing.some(
        e => e.name === f.name && e.sizeBytes === f.size && e.file.lastModified === f.lastModified
      );
      if (isDuplicate) continue;

      try {
        const v = await this.excelToPdfService.validateFile(f);
        if (v.isValid) {
          validated.push(v);
        } else {
          this.errorMessage.set(v.error || `Invalid spreadsheet: ${f.name}`);
        }
      } catch {
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

      // Initialize selectedSheetNames with visible sheets
      if (this.selectedSheetNames().length === 0 && combined[0]?.sheets) {
        this.selectedSheetNames.set(combined[0].sheets.filter(s => !s.hidden).map(s => s.name));
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

  toggleSheetSelection(sheetName: string): void {
    const current = this.selectedSheetNames();
    if (current.includes(sheetName)) {
      if (current.length === 1) return; // Keep at least one selected
      this.selectedSheetNames.set(current.filter(n => n !== sheetName));
    } else {
      this.selectedSheetNames.set([...current, sheetName]);
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

    const options: ExcelToPdfOptions = {
      output: this.outputFormat(),
      sheets: {
        mode: this.sheetMode(),
        names: this.sheetMode() === 'selected' ? this.selectedSheetNames() : undefined,
        includeHidden: this.includeHiddenSheets()
      },
      pageSize: this.pageSize(),
      orientation: this.orientation(),
      scaling: this.scaling(),
      customScale: this.scaling() === 'custom' ? this.customScale() : undefined,
      margins: this.margins(),
      gridlines: this.gridlines(),
      headings: this.headings(),
      repeatHeader: this.repeatHeader(),
      pageNumbers: this.pageNumbers(),
      bookmarks: this.bookmarks(),
      trimEmpty: this.trimEmpty(),
      merge: this.mergeFiles() && files.length > 1
    };

    try {
      const result = await this.excelToPdfService.convertToPdf(
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

  cancelConversion(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing.set(false);
    this.currentState.set('organize');
    this.layoutService.hideFooter();
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

  toggleSidePanel(): void {
    this.isSidePanelOpen.update(v => !v);
  }

  closeSidePanel(): void {
    this.isSidePanelOpen.set(false);
  }

  resetWorkspace(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isSidePanelOpen.set(false);
    this.currentRunId++;
    this.revokeCurrentUrl();
    this.selectedFiles.set([]);
    this.conversionResult.set(null);
    this.errorMessage.set(null);
    this.outputFormat.set('pdf');
    this.sheetMode.set('all');
    this.selectedSheetNames.set([]);
    this.includeHiddenSheets.set(false);
    this.pageSize.set('as_file');
    this.orientation.set('as_file');
    this.scaling.set('as_file');
    this.customScale.set(100);
    this.margins.set('as_file');
    this.gridlines.set(false);
    this.headings.set(false);
    this.repeatHeader.set(true);
    this.pageNumbers.set(false);
    this.bookmarks.set(true);
    this.trimEmpty.set(true);
    this.mergeFiles.set(false);
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }
}
