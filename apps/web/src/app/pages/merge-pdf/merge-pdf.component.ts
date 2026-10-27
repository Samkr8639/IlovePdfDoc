import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrowserPdfService, ValidatedPdfFile, MergeResult } from '../../core/services/browser-pdf.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-merge-pdf',
  imports: [
    RouterLink,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './merge-pdf.component.html',
  styleUrl: './merge-pdf.component.css'
})
export class MergePdfComponent implements OnInit, OnDestroy {
  private pdfService = inject(BrowserPdfService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);

  currentState = signal<WorkspaceState>('upload');
  selectedFiles = signal<ValidatedPdfFile[]>([]);
  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingMessage = signal<string>('');
  errorMessage = signal<string | null>(null);
  mergeResult = signal<MergeResult | null>(null);
  draggedIdx: number | null = null;

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('merge-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  async onFilesAdded(files: File[]): Promise<void> {
    this.errorMessage.set(null);
    const validatedList: ValidatedPdfFile[] = [];

    for (const file of files) {
      const validated = await this.pdfService.validatePdf(file);
      validatedList.push(validated);
    }

    const current = this.selectedFiles();
    this.selectedFiles.set([...current, ...validatedList]);

    if (this.selectedFiles().length > 0) {
      this.currentState.set('organize');
      this.layoutService.hideFooter();
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.onFilesAdded(files);
      input.value = '';
    }
  }

  onMoveUp(index: number): void {
    if (index <= 0) return;
    const list = [...this.selectedFiles()];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    this.selectedFiles.set(list);
  }

  onMoveDown(index: number): void {
    const list = [...this.selectedFiles()];
    if (index >= list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    this.selectedFiles.set(list);
  }

  onRemoveFile(index: number): void {
    const list = [...this.selectedFiles()];
    list.splice(index, 1);
    this.selectedFiles.set(list);

    if (list.length === 0) {
      this.currentState.set('upload');
    }
  }

  onDragStart(index: number): void {
    this.draggedIdx = index;
  }

  onDragOverCard(event: DragEvent, index: number): void {
    event.preventDefault();
  }

  onDropCard(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.draggedIdx === null || this.draggedIdx === index) return;
    const list = [...this.selectedFiles()];
    const item = list.splice(this.draggedIdx, 1)[0];
    list.splice(index, 0, item);
    this.selectedFiles.set(list);
    this.draggedIdx = null;
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
    const currentResult = this.mergeResult();
    if (currentResult?.url) {
      URL.revokeObjectURL(currentResult.url);
    }

    this.selectedFiles.set([]);
    this.mergeResult.set(null);
    this.errorMessage.set(null);
    this.processingProgress.set(0);
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }

  ngOnDestroy(): void {
    const currentResult = this.mergeResult();
    if (currentResult?.url) {
      URL.revokeObjectURL(currentResult.url);
    }
    this.layoutService.showFooter();
  }

  async executeMerge(): Promise<void> {
    const validFiles = this.selectedFiles().filter((f) => f.isValid);
    if (validFiles.length < 2) {
      this.errorMessage.set('Please select at least 2 valid PDF documents to merge.');
      return;
    }

    this.isProcessing.set(true);
    this.currentState.set('processing');
    this.errorMessage.set(null);

    try {
      const rawFiles = validFiles.map((f) => f.file);
      const result = await this.pdfService.mergePdfs(rawFiles, (percent, msg) => {
        this.processingProgress.set(percent);
        this.processingMessage.set(msg);
      });

      this.mergeResult.set(result);
      this.currentState.set('completed');
      this.layoutService.showFooter();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while merging your PDF files.';
      this.errorMessage.set(message);
      this.currentState.set('organize');
      this.layoutService.hideFooter();
    } finally {
      this.isProcessing.set(false);
    }
  }
}
