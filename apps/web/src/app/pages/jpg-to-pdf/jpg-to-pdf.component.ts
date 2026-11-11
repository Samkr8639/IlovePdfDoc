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
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ImageProbeService } from '../../core/services/jpg-to-pdf/image-probe.service';
import { PageLayoutService, MiniPreviewStyle } from '../../core/services/jpg-to-pdf/page-layout.service';
import { JpgToPdfService } from '../../core/services/jpg-to-pdf/jpg-to-pdf.service';
import {
  JpgToPdfBuildResult,
  JpgToPdfImageItem,
  JpgToPdfOptions,
  MarginOption,
  MeasurementUnit,
  PageOrientationOption,
  PageSizeOption,
  ImageFitOption,
  ImageAlignmentOption,
  ImageQualityOption
} from '../../core/services/jpg-to-pdf/jpg-to-pdf.models';

export type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

const MAX_IMAGES_COUNT = 300;
const MAX_TOTAL_SIZE_BYTES = 600 * 1024 * 1024; // 600 MB

@Component({
  selector: 'app-jpg-to-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DropzoneComponent,
    ProcessingStateComponent
  ],
  templateUrl: './jpg-to-pdf.component.html',
  styleUrl: './jpg-to-pdf.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JpgToPdfComponent implements OnInit, OnDestroy {
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);
  private imageProbeService = inject(ImageProbeService);
  private pageLayoutService = inject(PageLayoutService);
  private jpgToPdfService = inject(JpgToPdfService);

  private abortController: AbortController | null = null;
  private thumbnailUrls: string[] = [];

  // Workspace lifecycle
  readonly currentState = signal<WorkspaceState>('upload');
  readonly selectedFiles = signal<JpgToPdfImageItem[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly warnings = signal<string[]>([]);

  // Processing state
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('');
  readonly buildResult = signal<JpgToPdfBuildResult | null>(null);

  // Mobile sidebar controls
  readonly isSidePanelOpen = signal<boolean>(false);
  readonly showAdvanced = signal<boolean>(false);

  // Conversion options
  readonly options = signal<JpgToPdfOptions>({
    orientation: 'auto',
    pageSize: 'same-as-image',
    customPageWidth: 210,
    customPageHeight: 297,
    customPageUnit: 'mm',
    margin: 'none',
    customMarginValue: 10,
    customMarginUnit: 'mm',
    fit: 'fit',
    alignment: 'center',
    quality: 'original',
    backgroundColor: '#ffffff',
    mergeAll: true,
    removeExif: true,
    addPageNumbers: false,
    fixExifRotation: true,
    pdfTitle: '',
    pdfAuthor: '',
    dpiFallback: 96
  });

  // Drag-and-drop state
  draggedIdx: number | null = null;

  // Computed values
  readonly totalFilesCount = computed(() => this.selectedFiles().length);

  readonly totalSizeBytes = computed(() => {
    return this.selectedFiles().reduce((acc, f) => acc + f.sizeBytes, 0);
  });

  readonly formattedTotalSize = computed(() => {
    const bytes = this.totalSizeBytes();
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  readonly estimatedSizeText = computed(() => {
    const files = this.selectedFiles();
    if (files.length === 0) return '≈ 0 KB';
    const bytes = this.pageLayoutService.estimateTotalSize(files, this.options());
    return this.pageLayoutService.formatEstimatedSize(bytes);
  });

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('jpg-to-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  ngOnDestroy(): void {
    this.cancelProcessing();
    this.cleanupThumbnails();
    this.layoutService.showFooter();
  }

  // File Upload and Validation
  async onFilesAdded(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    this.errorMessage.set(null);

    const currentList = this.selectedFiles();
    if (currentList.length + files.length > MAX_IMAGES_COUNT) {
      this.errorMessage.set(`Maximum ${MAX_IMAGES_COUNT} images can be added at once.`);
      return;
    }

    const currentTotalSize = this.totalSizeBytes();
    const newFilesTotal = files.reduce((acc, f) => acc + f.size, 0);
    if (currentTotalSize + newFilesTotal > MAX_TOTAL_SIZE_BYTES) {
      this.errorMessage.set(`Total file size cannot exceed 600 MB.`);
      return;
    }

    const processedItems: JpgToPdfImageItem[] = [];
    const localWarnings: string[] = [];

    for (const file of files) {
      // Duplicate detection
      const isDuplicate = currentList.some(
        (existing) => existing.name === file.name && existing.sizeBytes === file.size
      );
      if (isDuplicate) {
        localWarnings.push(`"${file.name}" was already added and was skipped.`);
        continue;
      }

      const probe = await this.imageProbeService.probeImage(file);
      if (!probe.isValid) {
        localWarnings.push(`"${file.name}": ${probe.error}`);
        continue;
      }

      const objectUrl = URL.createObjectURL(file);
      this.thumbnailUrls.push(objectUrl);

      processedItems.push({
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        sizeBytes: file.size,
        thumbnailUrl: objectUrl,
        probe,
        manualRotationDeg: 0
      });
    }

    if (localWarnings.length > 0) {
      this.warnings.set(localWarnings);
    }

    if (processedItems.length > 0) {
      this.selectedFiles.set([...currentList, ...processedItems]);
      this.currentState.set('organize');
      this.layoutService.hideFooter();
    } else if (currentList.length === 0 && localWarnings.length > 0) {
      this.errorMessage.set(localWarnings[0]);
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

  // Card Actions & Reordering
  onDragStart(index: number): void {
    this.draggedIdx = index;
  }

  onDragOverCard(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDropCard(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (this.draggedIdx === null || this.draggedIdx === targetIndex) return;

    const list = [...this.selectedFiles()];
    const item = list.splice(this.draggedIdx, 1)[0];
    list.splice(targetIndex, 0, item);
    this.selectedFiles.set(list);
    this.draggedIdx = null;
  }

  onMoveLeft(index: number): void {
    if (index <= 0) return;
    const list = [...this.selectedFiles()];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    this.selectedFiles.set(list);
  }

  onMoveRight(index: number): void {
    const list = [...this.selectedFiles()];
    if (index >= list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    this.selectedFiles.set(list);
  }

  onCardKeyDown(event: KeyboardEvent, index: number): void {
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
      event.preventDefault();
      this.onMoveLeft(index);
    } else if (event.altKey && (event.key === 'ArrowRight' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.onMoveRight(index);
    }
  }

  onRotateCard(index: number, deltaDeg: number): void {
    const list = [...this.selectedFiles()];
    const item = list[index];
    const newDeg = ((item.manualRotationDeg + deltaDeg) % 360 + 360) % 360;
    list[index] = { ...item, manualRotationDeg: newDeg };
    this.selectedFiles.set(list);
  }

  onRemoveCard(index: number): void {
    const list = [...this.selectedFiles()];
    const removed = list.splice(index, 1)[0];
    if (removed?.thumbnailUrl) {
      URL.revokeObjectURL(removed.thumbnailUrl);
    }
    this.selectedFiles.set(list);

    if (list.length === 0) {
      this.resetWorkspace();
    }
  }

  // Toolbar Actions
  sortByName(direction: 'asc' | 'desc'): void {
    const list = [...this.selectedFiles()];
    list.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
    this.selectedFiles.set(list);
  }

  reverseOrder(): void {
    const list = [...this.selectedFiles()].reverse();
    this.selectedFiles.set(list);
  }

  rotateAll(deltaDeg: number = 90): void {
    const list = this.selectedFiles().map((item) => ({
      ...item,
      manualRotationDeg: ((item.manualRotationDeg + deltaDeg) % 360 + 360) % 360
    }));
    this.selectedFiles.set(list);
  }

  clearAll(): void {
    this.resetWorkspace();
  }

  // Sidebar Option Updates
  setOrientation(orientation: PageOrientationOption): void {
    // Switching directly to Portrait/Landscape from "Same as image" upgrades page size to A4
    if (this.options().pageSize === 'same-as-image' && orientation !== 'auto') {
      this.updateOptions({ pageSize: 'a4', orientation });
      return;
    }
    this.updateOptions({ orientation });
  }

  setPageSize(pageSize: PageSizeOption): void {
    if (pageSize === 'same-as-image') {
      this.updateOptions({ pageSize, orientation: 'auto' });
      return;
    }
    this.updateOptions({ pageSize });
  }

  setMargin(margin: MarginOption): void {
    this.updateOptions({ margin });
  }

  setFit(fit: ImageFitOption): void {
    this.updateOptions({ fit });
  }

  setAlignment(alignment: ImageAlignmentOption): void {
    this.updateOptions({ alignment });
  }

  setQuality(quality: ImageQualityOption): void {
    this.updateOptions({ quality });
  }

  updateOptions(partial: Partial<JpgToPdfOptions>): void {
    this.options.set({ ...this.options(), ...partial });
  }

  // Mini Preview Style for Card
  getCardPreviewStyle(item: JpgToPdfImageItem): MiniPreviewStyle {
    const layout = this.pageLayoutService.computeLayout(item, this.options());
    return this.pageLayoutService.computeMiniPreviewStyle(layout, this.options());
  }

  // Execution
  async executeConvert(): Promise<void> {
    const items = this.selectedFiles();
    if (items.length === 0 || this.isProcessing()) return;

    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.currentState.set('processing');
    this.processingProgress.set(0);
    this.processingMessage.set('Preparing images for conversion...');

    this.abortController = new AbortController();

    try {
      const result = await this.jpgToPdfService.buildPdf(
        items,
        this.options(),
        (progress) => {
          this.processingProgress.set(progress.percent);
          this.processingMessage.set(progress.message);
        },
        this.abortController.signal
      );

      this.buildResult.set(result);
      this.currentState.set('completed');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        this.currentState.set('organize');
        this.errorMessage.set('Conversion cancelled by user.');
      } else {
        this.currentState.set('organize');
        this.errorMessage.set(err?.message || 'An error occurred during PDF conversion.');
      }
    } finally {
      this.isProcessing.set(false);
      this.abortController = null;
    }
  }

  cancelProcessing(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing.set(false);
  }

  downloadResult(): void {
    const res = this.buildResult();
    if (!res) return;

    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  resetWorkspace(): void {
    this.cancelProcessing();
    this.cleanupThumbnails();
    this.selectedFiles.set([]);
    this.errorMessage.set(null);
    this.warnings.set([]);
    this.buildResult.set(null);
    this.currentState.set('upload');
    this.isSidePanelOpen.set(false);
    this.layoutService.showFooter();
  }

  toggleSidePanel(): void {
    this.isSidePanelOpen.set(!this.isSidePanelOpen());
  }

  closeSidePanel(): void {
    this.isSidePanelOpen.set(false);
  }

  openGoogleDrive(event: Event): void {
    event.stopPropagation();
    alert('Google Drive integration coming soon!');
  }

  openDropbox(event: Event): void {
    event.stopPropagation();
    alert('Dropbox integration coming soon!');
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private cleanupThumbnails(): void {
    for (const url of this.thumbnailUrls) {
      URL.revokeObjectURL(url);
    }
    this.thumbnailUrls = [];
  }
}

