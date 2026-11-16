/**
 * Watermark PDF Component
 * Production-ready in-browser PDF watermarking page component.
 * Provides Upload Hero, Organize Workspace with Canvas Preview, Segmented
 * Watermark Options Sidebar, Processing State, and Result View.
 */

import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WATERMARK_DEFAULT_SETTINGS,
  WATERMARK_LIMITS,
  ImageWatermarkConfig,
  TextWatermarkConfig,
  WatermarkExportWarning,
  WatermarkFileSettings,
  WatermarkGridPosition,
  WatermarkLayer,
  WatermarkPageFilterPreset,
  WatermarkPageMode,
  WatermarkProcessResult,
  WatermarkTab
} from '@paperflow/contracts';
import { BrowserPdfService, MergeResult, ValidatedPdfFile } from '../../core/services/browser-pdf.service';
import { SharedPdfjsService } from '../../core/services/shared-pdfjs.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { WatermarkExportService } from '../../core/services/watermark-pdf/watermark-export.service';
import { WatermarkProcessingService } from '../../core/services/watermark-pdf/watermark-processing.service';
import { WatermarkImageService } from '../../core/services/watermark-pdf/watermark-image.service';
import { WatermarkTextShaper } from '../../core/services/watermark-pdf/watermark-text-shaper';
import { parseWatermarkPages } from '../../core/services/watermark-pdf/watermark-range-parser';
import { WatermarkPreviewComponent } from './components/watermark-preview/watermark-preview.component';

// Shared UI components
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';
import { ExploreMoreToolsComponent } from '../../shared/components/explore-more-tools/explore-more-tools.component';
import { PtAdSlotComponent } from '../../shared/components/pt-ad-slot/pt-ad-slot.component';

export type WatermarkWorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

export interface QuickTextChip {
  label: string;
  value: string;
}

export interface FontOption {
  id: string;
  name: string;
  family: string;
}

export const QUICK_TEXT_CHIPS: QuickTextChip[] = [
  { label: 'Confidential', value: 'CONFIDENTIAL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Do Not Copy', value: 'DO NOT COPY' },
  { label: 'Sample', value: 'SAMPLE' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Copy', value: 'COPY' }
];

export const COLOR_SWATCHES: string[] = [
  '#4B5563', // Neutral slate grey (default)
  '#14213D', // PDFTailor Navy
  '#DC2626', // Urgent red
  '#0F766E', // Accent teal
  '#D97706', // Warning amber
  '#2563EB', // Blue focus
  '#059669', // Emerald green
  '#000000'  // Pure black
];

export const AVAILABLE_FONTS: FontOption[] = [
  { id: 'noto-sans', name: 'Noto Sans (Default)', family: 'Noto Sans' },
  { id: 'liberation-sans', name: 'Liberation Sans', family: 'Liberation Sans' },
  { id: 'roboto', name: 'Roboto', family: 'Roboto' },
  { id: 'source-sans', name: 'Source Sans 3', family: 'Source Sans 3' }
];

@Component({
  selector: 'app-watermark-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WatermarkPreviewComponent,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent,
    ExploreMoreToolsComponent,
    PtAdSlotComponent
  ],
  templateUrl: './watermark-pdf.component.html',
  styleUrl: './watermark-pdf.component.css'
})
export class WatermarkPdfComponent implements OnInit, OnDestroy {
  private pdfService = inject(BrowserPdfService);
  private sharedPdfjs = inject(SharedPdfjsService);
  private seo = inject(SeoService);
  private layoutService = inject(LayoutService);
  private toolRegistry = inject(ToolRegistryService);
  private exportService = inject(WatermarkExportService);
  private processingService = inject(WatermarkProcessingService);
  private imageService = inject(WatermarkImageService);

  @ViewChild('imageFileInput') imageFileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('docFileInput') docFileInputRef?: ElementRef<HTMLInputElement>;

  // Component state
  readonly currentState = signal<WatermarkWorkspaceState>('upload');
  readonly selectedFile = signal<File | null>(null);
  readonly fileBytes = signal<Uint8Array | null>(null);
  readonly pdfDocProxy = signal<any>(null);
  readonly currentPage = signal<number>(1);
  readonly totalPages = signal<number>(1);
  readonly zoom = signal<number>(1.0);
  readonly errorMessage = signal<string | null>(null);
  readonly isSidePanelOpen = signal<boolean>(false);
  readonly fontkitFont = signal<any>(null);

  // Settings state (deep copy of defaults)
  readonly settings = signal<WatermarkFileSettings>(JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS)));

  private defaultFontBytes?: Uint8Array;

  // Processing state
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('Applying watermark...');

  // Result state
  readonly resultData = signal<MergeResult | null>(null);
  readonly resultWarnings = signal<WatermarkExportWarning[]>([]);

  // Constants exposed to template
  readonly quickChips = QUICK_TEXT_CHIPS;
  readonly colorSwatches = COLOR_SWATCHES;
  readonly availableFonts = AVAILABLE_FONTS;

  readonly availableTokens = [
    { token: '{page}', label: 'Page number' },
    { token: '{pages}', label: 'Total pages' },
    { token: '{date}', label: 'Current date' },
    { token: '{filename}', label: 'Document name' }
  ];

  // Computed signals
  readonly activeTab = computed<WatermarkTab>(() => this.settings().common.activeTab);

  readonly pageSelection = computed(() => {
    const common = this.settings().common;
    return parseWatermarkPages(
      common.pageMode,
      common.customRange,
      common.filterPreset,
      this.totalPages()
    );
  });

  readonly includedPageNumbers = computed<number[]>(() => {
    return this.pageSelection().pageIndices.map(i => i + 1);
  });

  readonly isCurrentPageIncluded = computed<boolean>(() => {
    return this.includedPageNumbers().includes(this.currentPage());
  });

  readonly includedPagesCount = computed<number>(() => {
    return this.includedPageNumbers().length;
  });

  readonly effectiveWatermarkText = computed<string>(() => {
    const text = this.settings().textConfig.text.trim();
    return text.length > 0 ? text : 'CONFIDENTIAL';
  });

  readonly isTextValid = computed<boolean>(() => {
    const text = this.settings().textConfig.text.trim();
    // In text mode, empty is invalid unless placeholder is accepted or text is entered
    return text.length > 0 && text.length <= WATERMARK_LIMITS.maxTextLength;
  });

  readonly isImageValid = computed<boolean>(() => {
    const img = this.settings().imageConfig;
    return !!img.imageDataUrl && img.imageWidthPx > 0 && img.imageHeightPx > 0;
  });

  readonly isSettingsValid = computed<boolean>(() => {
    if (this.includedPagesCount() === 0) return false;
    if (this.activeTab() === 'text') {
      return this.isTextValid();
    } else {
      return this.isImageValid();
    }
  });

  readonly validationMessage = computed<string | null>(() => {
    if (this.includedPagesCount() === 0) {
      return 'Please specify at least one valid page to watermark.';
    }
    if (this.activeTab() === 'text' && !this.isTextValid()) {
      return 'Please enter watermark text (up to 500 characters).';
    }
    if (this.activeTab() === 'image' && !this.isImageValid()) {
      return 'Please select a valid image file (PNG, JPG, or WebP).';
    }
    return null;
  });

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('watermark-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
    this.loadDefaultFont();
  }

  ngOnDestroy(): void {
    this.layoutService.showFooter();
    this.cleanupResultUrl();
  }

  private async loadDefaultFont(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const resp = await fetch('/standard_fonts/LiberationSans-Regular.ttf');
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          this.defaultFontBytes = new Uint8Array(buf);
          const font = WatermarkTextShaper.loadFontkit(this.defaultFontBytes);
          this.fontkitFont.set(font);
        }
      }
    } catch {
      // Font will fall back gracefully to standard rendering
    }
  }

  // File Upload Handler
  async onFilesAdded(files: File[]): Promise<void> {
    this.errorMessage.set(null);
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.errorMessage.set('Please select a valid PDF document.');
      return;
    }

    if (file.size > WATERMARK_LIMITS.desktopMaxFileSizeBytes) {
      this.errorMessage.set(`File size exceeds maximum limit of 100 MB.`);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const pdfProxy = await this.sharedPdfjs.loadDocument(uint8);

      if (pdfProxy.numPages > WATERMARK_LIMITS.desktopMaxPages) {
        this.errorMessage.set(`Document has ${pdfProxy.numPages} pages, exceeding the 500-page limit.`);
        return;
      }

      this.selectedFile.set(file);
      this.fileBytes.set(uint8);
      this.pdfDocProxy.set(pdfProxy);
      this.totalPages.set(pdfProxy.numPages);
      this.currentPage.set(1);

      // Transition to organize workspace
      this.currentState.set('organize');
      this.layoutService.hideFooter();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to load PDF document.');
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.onFilesAdded(Array.from(input.files));
      input.value = '';
    }
  }

  // Workspace Navigation & Zoom
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onZoomChange(zoom: number): void {
    this.zoom.set(Math.min(3.0, Math.max(0.5, zoom)));
  }

  onPositionChange(pos: { customXPercent: number; customYPercent: number; rotation: number }): void {
    this.updateCommon({
      useCustomPosition: true,
      customXPercent: pos.customXPercent,
      customYPercent: pos.customYPercent,
      rotation: pos.rotation
    });
  }

  toggleMobileSidePanel(): void {
    this.isSidePanelOpen.set(!this.isSidePanelOpen());
  }

  closeMobileSidePanel(): void {
    this.isSidePanelOpen.set(false);
  }

  // Options Sidebar Mutations
  setActiveTab(tab: WatermarkTab): void {
    this.updateCommon({ activeTab: tab });
  }

  // Text Options
  onTextChange(rawText: string): void {
    const sanitized = WatermarkTextShaper.sanitizeText(rawText).text;
    this.updateTextConfig({ text: sanitized });
  }

  applyQuickChip(chipValue: string): void {
    this.updateTextConfig({ text: chipValue });
  }

  insertToken(token: string): void {
    const current = this.settings().textConfig.text;
    const separator = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
    this.updateTextConfig({ text: `${current}${separator}${token}` });
  }

  // Mosaic Controls
  toggleMosaic(): void {
    this.updateCommon({ mosaic: !this.settings().common.mosaic });
  }

  setHorizontalGapMm(val: number): void {
    this.updateCommon({ horizontalGapMm: Math.min(200, Math.max(0, val)) });
  }

  setVerticalGapMm(val: number): void {
    this.updateCommon({ verticalGapMm: Math.min(200, Math.max(0, val)) });
  }

  toggleStagger(): void {
    this.updateCommon({ stagger: !this.settings().common.stagger });
  }

  setFontFamily(family: string): void {
    this.updateTextConfig({ fontFamily: family });
  }

  setFontSize(size: number | 'auto'): void {
    this.updateTextConfig({ fontSize: size });
  }

  toggleBold(): void {
    this.updateTextConfig({ bold: !this.settings().textConfig.bold });
  }

  toggleItalic(): void {
    this.updateTextConfig({ italic: !this.settings().textConfig.italic });
  }

  toggleUnderline(): void {
    this.updateTextConfig({ underline: !this.settings().textConfig.underline });
  }

  setColor(color: string): void {
    this.updateTextConfig({ color });
  }

  // Image Options
  async onImageFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.processImageFile(input.files[0]);
      input.value = '';
    }
  }

  async processImageFile(file: File): Promise<void> {
    this.errorMessage.set(null);
    try {
      const validation = await this.imageService.validateImageHeader(file);
      if (!validation.valid || !validation.image) {
        this.errorMessage.set(validation.error || 'Invalid image file.');
        return;
      }

      const { width, height } = validation.image.header;
      const dataUrl = await this.fileToDataUrl(file);
      this.updateImageConfig({
        imageDataUrl: dataUrl,
        imageWidthPx: width,
        imageHeightPx: height
      });
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to read image file.');
    }
  }

  removeImage(): void {
    this.updateImageConfig({
      imageDataUrl: null,
      imageWidthPx: 0,
      imageHeightPx: 0
    });
  }

  setImageWidthPercent(pct: number): void {
    this.updateImageConfig({ widthPercent: Math.min(100, Math.max(5, pct)) });
  }

  toggleRemoveWhiteBg(): void {
    this.updateImageConfig({ removeWhiteBg: !this.settings().imageConfig.removeWhiteBg });
  }

  setWhiteBgTolerance(val: number): void {
    this.updateImageConfig({ tolerance: Math.min(60, Math.max(5, val)) });
  }

  // Common Options
  setPosition(pos: WatermarkGridPosition): void {
    this.updateCommon({ position: pos, useCustomPosition: false });
  }

  setMarginMm(mm: number): void {
    this.updateCommon({ marginMm: Math.min(100, Math.max(0, mm)) });
  }

  setOpacity(opacity: number): void {
    this.updateCommon({ opacity: Math.min(100, Math.max(5, opacity)) });
  }

  setRotation(deg: number): void {
    this.updateCommon({ rotation: deg });
  }

  setPageMode(mode: WatermarkPageMode): void {
    this.updateCommon({ pageMode: mode });
  }

  setCustomRange(rangeStr: string): void {
    this.updateCommon({ customRange: rangeStr });
  }

  setFilterPreset(preset: WatermarkPageFilterPreset): void {
    this.updateCommon({ filterPreset: preset });
  }

  setLayer(layer: WatermarkLayer): void {
    this.updateCommon({ layer });
  }

  // Execution: Add Watermark
  async executeWatermark(): Promise<void> {
    if (!this.isSettingsValid() || !this.selectedFile() || !this.fileBytes()) {
      return;
    }

    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.processingProgress.set(10);
    this.processingMessage.set('Preparing document and stamping watermark...');
    this.currentState.set('processing');

    try {
      const outcome = await this.processingService.processWatermark(
        this.fileBytes()!,
        this.selectedFile()!.name,
        this.settings(),
        this.defaultFontBytes,
        (progress) => {
          this.processingProgress.set(progress.percent);
          if (progress.message) {
            this.processingMessage.set(progress.message);
          }
        }
      );

      const blob = new Blob([outcome.pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const formattedSize = this.formatBytes(blob.size);

      this.resultData.set({
        blob,
        url,
        filename: outcome.filename,
        pageCount: outcome.totalPages,
        sizeBytes: blob.size,
        formattedSize,
        previewUrl: url
      });
      this.resultWarnings.set(outcome.warnings);

      this.isProcessing.set(false);
      this.currentState.set('completed');
      this.layoutService.showFooter();
    } catch (err: any) {
      this.isProcessing.set(false);
      this.currentState.set('organize');
      this.errorMessage.set(err?.message || 'An error occurred while stamping the watermark.');
    }
  }

  cancelProcessing(): void {
    this.processingService.cancel();
    this.isProcessing.set(false);
    this.currentState.set('organize');
  }

  resetTool(): void {
    this.cleanupResultUrl();
    this.selectedFile.set(null);
    this.fileBytes.set(null);
    this.pdfDocProxy.set(null);
    this.currentPage.set(1);
    this.totalPages.set(1);
    this.zoom.set(1.0);
    this.resultData.set(null);
    this.resultWarnings.set([]);
    this.errorMessage.set(null);
    this.settings.set(JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS)));
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }

  // Helpers
  private updateCommon(patch: Partial<WatermarkFileSettings['common']>): void {
    this.settings.update(s => ({
      ...s,
      common: { ...s.common, ...patch }
    }));
  }

  private updateTextConfig(patch: Partial<TextWatermarkConfig>): void {
    this.settings.update(s => ({
      ...s,
      textConfig: { ...s.textConfig, ...patch }
    }));
  }

  private updateImageConfig(patch: Partial<ImageWatermarkConfig>): void {
    this.settings.update(s => ({
      ...s,
      imageConfig: { ...s.imageConfig, ...patch }
    }));
  }

  private cleanupResultUrl(): void {
    const current = this.resultData();
    if (current?.url && current.url.startsWith('blob:')) {
      URL.revokeObjectURL(current.url);
    }
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file as Data URL'));
      reader.readAsDataURL(file);
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
