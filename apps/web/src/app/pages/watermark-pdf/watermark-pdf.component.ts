/**
 * Watermark PDF Component
 * Production-ready in-browser PDF watermarking page component.
 * Provides Upload Hero, Organize Workspace with Canvas Preview, Segmented
 * Watermark Options Sidebar, Presets & Device Preferences, Script Font Detection,
 * Multi-File Processing with ZIP export, Processing State, and Result View.
 */

import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
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
  WatermarkPreset,
  WatermarkProcessResult,
  WatermarkTab
} from '@paperflow/contracts';
import { BrowserPdfService, MergeResult } from '../../core/services/browser-pdf.service';
import { SharedPdfjsService } from '../../core/services/shared-pdfjs.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { WatermarkExportService } from '../../core/services/watermark-pdf/watermark-export.service';
import { WatermarkProcessingService } from '../../core/services/watermark-pdf/watermark-processing.service';
import { WatermarkImageService } from '../../core/services/watermark-pdf/watermark-image.service';
import { WatermarkTextShaper } from '../../core/services/watermark-pdf/watermark-text-shaper';
import { WatermarkStorageService } from '../../core/services/watermark-pdf/watermark-storage.service';
import { WatermarkFontService, FontPackInfo } from '../../core/services/watermark-pdf/watermark-font.service';
import {
  WatermarkComplianceReport,
  WatermarkComplianceService
} from '../../core/services/watermark-pdf/watermark-compliance.service';
import { parseWatermarkPages } from '../../core/services/watermark-pdf/watermark-range-parser';
import { WatermarkPreviewComponent } from './components/watermark-preview/watermark-preview.component';

// Shared UI components
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';
import { ExploreMoreToolsComponent } from '../../shared/components/explore-more-tools/explore-more-tools.component';
import { PtAdSlotComponent } from '../../shared/components/pt-ad-slot/pt-ad-slot.component';
import { PtGuidedTourComponent } from '../../shared/components/guided-tour/pt-guided-tour.component';
import { GuidedTourService, TourStep } from '../../core/services/guided-tour/guided-tour.service';

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

export interface WatermarkFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  bytes: Uint8Array;
  totalPages: number;
  pdfProxy: any;
  settings: WatermarkFileSettings;
  complianceReport: WatermarkComplianceReport;
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
  { id: 'source-sans', name: 'Source Sans 3', family: 'Source Sans 3' },
  { id: 'kalam', name: 'Kalam (Marker / Stamp)', family: 'Kalam' },
  { id: 'caveat', name: 'Caveat (Handwritten)', family: 'Caveat' },
  { id: 'dancing-script', name: 'Dancing Script (Cursive)', family: 'Dancing Script' },
  { id: 'great-vibes', name: 'Great Vibes (Calligraphy)', family: 'Great Vibes' }
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
    PtAdSlotComponent,
    PtGuidedTourComponent
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
  readonly storageService = inject(WatermarkStorageService);
  readonly fontService = inject(WatermarkFontService);
  readonly complianceService = inject(WatermarkComplianceService);
  readonly guidedTourService = inject(GuidedTourService);

  @ViewChild('imageFileInput') imageFileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('docFileInput') docFileInputRef?: ElementRef<HTMLInputElement>;

  // Component state
  readonly currentState = signal<WatermarkWorkspaceState>('upload');
  readonly errorMessage = signal<string | null>(null);
  readonly isSidePanelOpen = signal<boolean>(false);
  readonly fontkitFont = signal<any>(null);
  readonly currentFontBytes = signal<Uint8Array | null>(null);

  // Multi-file state (R-037)
  readonly files = signal<WatermarkFileItem[]>([]);
  readonly selectedFileIndex = signal<number>(0);
  readonly sameSettingsForAll = signal<boolean>(true);

  // Settings state (deep copy of defaults)
  readonly settings = signal<WatermarkFileSettings>(JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS)));

  // Navigation & preview viewport state
  readonly currentPage = signal<number>(1);
  readonly totalPages = signal<number>(1);
  readonly zoom = signal<number>(1.0);

  private defaultFontBytes?: Uint8Array;

  // Processing state
  readonly isProcessing = signal<boolean>(false);
  readonly processingProgress = signal<number>(0);
  readonly processingMessage = signal<string>('Applying watermark...');

  // Single & Multi result state (R-038)
  readonly resultData = signal<MergeResult | null>(null);
  readonly resultWarnings = signal<WatermarkExportWarning[]>([]);
  readonly multiFileResults = signal<WatermarkProcessResult[]>([]);
  readonly zipBlobUrl = signal<string | null>(null);
  readonly zipFilename = signal<string>('watermarked-pdfs.zip');

  // Presets & Preferences state (R-039)
  readonly presets = signal<WatermarkPreset[]>([]);
  readonly newPresetName = signal<string>('');
  readonly isRememberSettings = signal<boolean>(false);

  // Modals state (R-044, R-045)
  readonly showSignatureModal = signal<boolean>(false);
  readonly showPasswordModal = signal<boolean>(false);
  readonly passwordInput = signal<string>('');
  readonly passwordError = signal<string | null>(null);
  private pendingEncryptedBytes: Uint8Array | null = null;
  private pendingEncryptedFile: File | null = null;

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

  // Interactive Guided Tour Steps Covering Every Key Control
  readonly WATERMARK_TOUR_STEPS: TourStep[] = [
    {
      id: 'step-files-dock',
      title: 'Upload & Add Files',
      content: 'Add multiple PDF documents from your computer, Google Drive, or Dropbox. When multiple files are loaded, switch between them in the top bar.',
      targetSelector: '.floating-tools-dock',
      placement: 'left',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(false);
        }
      }
    },
    {
      id: 'step-workspace-preview',
      title: 'Live Canvas & Handles',
      content: 'Preview your document in real time. Drag the watermark to position it anywhere, rotate with the top circle handle, or resize with the 4 corner handles.',
      targetSelector: 'app-watermark-preview',
      placement: 'bottom',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(false);
        }
      }
    },
    {
      id: 'step-topbar-controls',
      title: 'Page Navigation & Compare',
      content: 'Flip between pages, zoom in or out, fit to screen, and click or hold "Hold to compare" (or press C) to preview the original PDF without watermarks.',
      targetSelector: '.tour-topbar-controls',
      placement: 'bottom',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(false);
        }
      }
    },
    {
      id: 'step-watermark-mode',
      title: 'Text or Image Watermark',
      content: 'Choose "Place text" to stamp typography and dynamic tokens, or "Place image" to stamp your company logo, transparent PNG, or graphic mark.',
      targetSelector: '.segmented-tabs-wrapper',
      placement: 'left',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-text-tokens',
      title: 'Watermark Text & Tokens',
      content: 'Type your message, click quick chips (Confidential, Draft, Sample), or insert dynamic tokens such as {page}, {pages}, {date}, and {filename}.',
      targetSelector: '.tour-text-control',
      placement: 'left',
      actionBeforeStep: () => {
        this.setActiveTab('text');
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-typography-styling',
      title: 'Typography, Size & Color',
      content: 'Choose from 8 bundled fonts, format with Bold or Italic, adjust the font size slider with quick preset buttons (18–72 pt) or Auto-fit, and pick your color.',
      targetSelector: '.tour-typography-control',
      placement: 'left',
      actionBeforeStep: () => {
        this.setActiveTab('text');
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-position-grid',
      title: '9-Point Position Grid & Margin',
      content: 'Snap your watermark to any of the 9 anchor points (corners, edges, or center) and fine-tune page edge margins in millimeters.',
      targetSelector: '.tour-position-control',
      placement: 'left',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-opacity-control',
      title: 'Opacity & Transparency',
      content: 'Adjust transparency from a faint background watermark (25%) to an opaque stamp (100%), with convenient quick-select chips.',
      targetSelector: '.tour-opacity-control',
      placement: 'left',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-rotation-control',
      title: 'Rotation Angle',
      content: 'Rotate at custom angles or select one-click presets like 45° diagonal, 90° vertical, or 180° upside-down.',
      targetSelector: '.tour-rotation-control',
      placement: 'left',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-mosaic-control',
      title: 'Repeat as Mosaic Pattern',
      content: 'Tile your watermark repeatedly across the entire document page in a diagonal grid with customizable horizontal and vertical spacing.',
      targetSelector: '.tour-mosaic-control',
      placement: 'left',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-pages-layer',
      title: 'Page Range & Layer Order',
      content: 'Choose which pages to watermark (All, Odd, Even, First, Last, or custom ranges) and stamp Over or Below the PDF content.',
      targetSelector: '.tour-pages-control',
      placement: 'left',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    },
    {
      id: 'step-process-download',
      title: 'Process and Download',
      content: 'When ready, click "Add watermark" to stamp your PDF privately in your browser with zero server uploads, and download your finished PDF or ZIP.',
      targetSelector: '.giant-action-submit-btn',
      placement: 'top',
      actionBeforeStep: () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          this.isSidePanelOpen.set(true);
        }
      }
    }
  ];

  // Derived current file computed signals
  readonly currentFileItem = computed<WatermarkFileItem | null>(() => {
    const list = this.files();
    const idx = this.selectedFileIndex();
    return list[idx] || null;
  });

  readonly selectedFile = computed<File | null>(() => this.currentFileItem()?.file || null);
  readonly fileBytes = computed<Uint8Array | null>(() => this.currentFileItem()?.bytes || null);
  readonly pdfDocProxy = computed<any>(() => this.currentFileItem()?.pdfProxy || null);
  readonly complianceReport = computed<WatermarkComplianceReport | null>(
    () => this.currentFileItem()?.complianceReport || null
  );
  readonly complianceWarning = computed<string | null>(() => this.complianceReport()?.warningMessage || null);

  // Font script & emoji detection (R-040)
  readonly hasEmoji = computed<boolean>(() => this.fontService.hasEmoji(this.settings().textConfig.text));
  readonly detectedScript = computed(() => this.fontService.detectScript(this.settings().textConfig.text));
  readonly scriptInfo = computed<FontPackInfo>(() => this.fontService.getScriptInfo(this.detectedScript()));

  readonly currentNumericFontSize = computed<number>(() => {
    const fs = this.settings().textConfig.fontSize;
    return typeof fs === 'number' ? fs : 36;
  });

  readonly isCompareActive = signal<boolean>(false);

  // Active tab & page selections
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

  constructor() {
    // Reactively load and apply typography whenever font family, bold, italic, or text changes
    effect(async () => {
      const textCfg = this.settings().textConfig;
      await this.syncTypographyFont(textCfg.fontFamily, textCfg.bold, textCfg.italic, textCfg.text);
    });
  }

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('watermark-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
    this.syncTypographyFont();

    // Check device preferences (R-039)
    this.isRememberSettings.set(this.storageService.isRememberSettingsEnabled());
    const last = this.storageService.getLastSettings();
    if (last) {
      this.settings.set(last);
    }
    this.loadPresets();
  }

  ngOnDestroy(): void {
    this.layoutService.showFooter();
    this.cleanupResultUrl();
  }

  /**
   * Dynamically loads and switches the active font based on typography settings & script
   */
  async syncTypographyFont(
    family?: string,
    bold?: boolean,
    italic?: boolean,
    text?: string
  ): Promise<void> {
    const textCfg = this.settings().textConfig;
    const resolvedFamily = family ?? textCfg.fontFamily;
    const resolvedBold = bold ?? textCfg.bold;
    const resolvedItalic = italic ?? textCfg.italic;
    const resolvedText = text ?? textCfg.text;

    const url = this.fontService.resolveFontUrl(
      resolvedFamily,
      resolvedBold,
      resolvedItalic,
      resolvedText
    );

    try {
      const bytes = await this.fontService.loadFontBuffer(url);
      if (bytes && bytes.length > 0) {
        this.currentFontBytes.set(bytes);
        this.defaultFontBytes = bytes;
        const font = await this.fontService.loadFontkitInstance(url);
        if (font) {
          this.fontkitFont.set(font);
        }
      }
    } catch {
      // Font will fall back gracefully to standard rendering
    }
  }

  // File Upload Handlers (Supports Multi-File R-037)
  async onFilesAdded(newFiles: File[]): Promise<void> {
    this.errorMessage.set(null);
    if (!newFiles || newFiles.length === 0) return;

    const validPdfs = newFiles.filter(
      f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    if (validPdfs.length === 0) {
      this.errorMessage.set('Please select a valid PDF document.');
      return;
    }

    const currentList = [...this.files()];
    if (currentList.length + validPdfs.length > WATERMARK_LIMITS.maxFiles) {
      this.errorMessage.set(`You can add up to ${WATERMARK_LIMITS.maxFiles} files at once.`);
      return;
    }

    const addedItems: WatermarkFileItem[] = [];
    for (const file of validPdfs) {
      if (file.size > WATERMARK_LIMITS.desktopMaxFileSizeBytes) {
        this.errorMessage.set(`File "${file.name}" exceeds maximum limit of 100 MB.`);
        return;
      }

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let pdfProxy: any;
        try {
          pdfProxy = await this.sharedPdfjs.loadDocument(bytes);
        } catch (loadErr: any) {
          const errStr = String(loadErr?.message || loadErr?.name || '').toLowerCase();
          if (errStr.includes('password') || loadErr?.code === 'PASSWORD_REQUIRED') {
            this.pendingEncryptedBytes = bytes;
            this.pendingEncryptedFile = file;
            this.passwordInput.set('');
            this.passwordError.set(null);
            this.showPasswordModal.set(true);
            return;
          }
          throw loadErr;
        }

        if (pdfProxy.numPages > WATERMARK_LIMITS.desktopMaxPages) {
          this.errorMessage.set(
            `Document "${file.name}" has ${pdfProxy.numPages} pages, exceeding the 500-page limit.`
          );
          return;
        }

        const compliance = this.complianceService.checkCompliance(bytes);
        const fileSettings: WatermarkFileSettings = JSON.parse(JSON.stringify(this.settings()));

        addedItems.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          bytes,
          totalPages: pdfProxy.numPages,
          pdfProxy,
          settings: fileSettings,
          complianceReport: compliance
        });
      } catch (err: any) {
        this.errorMessage.set(`Failed to load "${file.name}": ${err?.message || 'Invalid PDF'}`);
        return;
      }
    }

    const updatedList = [...currentList, ...addedItems];
    this.files.set(updatedList);
    if (currentList.length === 0 && updatedList.length > 0) {
      this.selectedFileIndex.set(0);
      this.totalPages.set(updatedList[0].totalPages);
      this.currentPage.set(1);
    }

    this.currentState.set('organize');
    this.layoutService.hideFooter();

    // Auto-launch guided tour for first-time users
    if (!this.guidedTourService.isTourCompleted('watermark-pdf')) {
      setTimeout(() => {
        if (this.currentState() === 'organize' && !this.guidedTourService.isActive()) {
          this.startGuidedTour(false);
        }
      }, 600);
    }
  }

  /**
   * Starts or replays the interactive guided walkthrough
   */
  startGuidedTour(force = true): void {
    if (this.currentState() === 'organize') {
      this.guidedTourService.startTour({
        tourId: 'watermark-pdf',
        steps: this.WATERMARK_TOUR_STEPS,
        force
      });
    } else {
      this.guidedTourService.startTour({
        tourId: 'watermark-pdf-upload',
        steps: [
          {
            id: 'step-upload-intro',
            title: 'Upload Your File',
            content: 'Drag and drop your PDF documents here or click Select PDF files to begin customizing your watermark.',
            targetSelector: '.hero-dropzone-wrap',
            placement: 'bottom'
          }
        ],
        force
      });
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.onFilesAdded(Array.from(input.files));
      input.value = '';
    }
  }

  // Multi-File Navigation & Settings Management (R-037)
  selectFile(index: number): void {
    if (index >= 0 && index < this.files().length) {
      if (!this.sameSettingsForAll()) {
        const list = [...this.files()];
        const oldIdx = this.selectedFileIndex();
        if (list[oldIdx]) {
          list[oldIdx].settings = JSON.parse(JSON.stringify(this.settings()));
        }
        this.settings.set(JSON.parse(JSON.stringify(list[index].settings)));
        this.files.set(list);
      }
      this.selectedFileIndex.set(index);
      this.totalPages.set(this.files()[index].totalPages);
      this.currentPage.set(1);
    }
  }

  removeFile(index: number, event?: Event): void {
    event?.stopPropagation();
    const list = this.files().filter((_, i) => i !== index);
    if (list.length === 0) {
      this.resetTool();
      return;
    }
    this.files.set(list);
    const newIdx = Math.max(0, Math.min(this.selectedFileIndex(), list.length - 1));
    this.selectedFileIndex.set(newIdx);
    this.totalPages.set(list[newIdx].totalPages);
    this.currentPage.set(1);
  }

  toggleSameSettingsForAll(same: boolean): void {
    this.sameSettingsForAll.set(same);
    if (!same) {
      const current = JSON.stringify(this.settings());
      this.files.update(list => list.map(f => ({ ...f, settings: JSON.parse(current) })));
    }
  }

  applyCurrentSettingsToAll(): void {
    const current = JSON.stringify(this.settings());
    this.files.update(list => list.map(f => ({ ...f, settings: JSON.parse(current) })));
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

  applyQuickChip(text: string): void {
    this.updateTextConfig({ text });
  }

  insertToken(token: string): void {
    const current = this.settings().textConfig.text;
    const spacer = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
    this.updateTextConfig({ text: `${current}${spacer}${token}` });
  }

  onTextChange(text: string): void {
    const sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u202A-\u202E\u2066-\u2069]/g, '');
    this.updateTextConfig({ text: sanitized.slice(0, WATERMARK_LIMITS.maxTextLength) });
  }

  setFontFamily(family: string): void {
    this.updateTextConfig({ fontFamily: family });
  }

  setFontSize(size: number | 'auto'): void {
    this.updateTextConfig({ fontSize: size });
  }

  onSizeChange(size: { fontSize?: number; widthPercent?: number }): void {
    if (size.fontSize !== undefined) {
      this.setFontSize(size.fontSize);
    }
    if (size.widthPercent !== undefined) {
      this.setImageWidthPercent(size.widthPercent);
    }
  }

  onCompareHoldStart(): void {
    this.isCompareActive.set(true);
  }

  onCompareHoldEnd(): void {
    this.isCompareActive.set(false);
  }

  toggleCompare(): void {
    this.isCompareActive.set(!this.isCompareActive());
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

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(e: KeyboardEvent): void {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (e.key === 'c' || e.key === 'C') {
      this.toggleCompare();
    }
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

  setStrokeColor(strokeColor: string): void {
    this.updateTextConfig({ strokeColor });
  }

  setStrokeWidth(strokeWidth: number): void {
    this.updateTextConfig({ strokeWidth: Math.max(0.5, Math.min(10, strokeWidth)) });
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

  toggleMosaic(): void {
    this.updateCommon({ mosaic: !this.settings().common.mosaic });
  }

  setHorizontalGapMm(mm: number): void {
    this.updateCommon({ horizontalGapMm: Math.max(0, Math.min(200, mm)) });
  }

  setVerticalGapMm(mm: number): void {
    this.updateCommon({ verticalGapMm: Math.max(0, Math.min(200, mm)) });
  }

  toggleStagger(): void {
    this.updateCommon({ stagger: !this.settings().common.stagger });
  }

  setLayer(layer: WatermarkLayer): void {
    this.updateCommon({ layer });
  }

  // Presets & Preferences Actions (R-039)
  async loadPresets(): Promise<void> {
    const list = await this.storageService.listPresets();
    this.presets.set(list);
  }

  async saveCurrentAsPreset(): Promise<void> {
    const name = this.newPresetName().trim() || 'Custom Preset';
    const s = this.settings();
    const imgData = s.common.activeTab === 'image' ? s.imageConfig.imageDataUrl : null;
    await this.storageService.savePreset(name, s, imgData);
    this.newPresetName.set('');
    await this.loadPresets();
  }

  applyPreset(preset: WatermarkPreset): void {
    this.settings.set(JSON.parse(JSON.stringify(preset.settings)));
    if (this.sameSettingsForAll()) {
      this.applyCurrentSettingsToAll();
    }
  }

  async deletePreset(id: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    await this.storageService.deletePreset(id);
    await this.loadPresets();
  }

  toggleRememberSettings(enabled: boolean): void {
    this.isRememberSettings.set(enabled);
    this.storageService.setRememberSettings(enabled);
    if (enabled) {
      this.storageService.saveLastSettings(this.settings());
    } else {
      this.storageService.clearLastSettings();
    }
  }

  toggleMarkAsArtifact(): void {
    this.updateCommon({ markAsArtifact: !this.settings().common.markAsArtifact });
  }

  toggleOptionalContentLayer(): void {
    this.updateCommon({ optionalContentLayer: !this.settings().common.optionalContentLayer });
  }

  cancelPasswordPrompt(): void {
    this.showPasswordModal.set(false);
    this.pendingEncryptedBytes = null;
    this.pendingEncryptedFile = null;
    this.passwordInput.set('');
    this.passwordError.set(null);
  }

  async submitPassword(): Promise<void> {
    const pwd = this.passwordInput().trim();
    if (!pwd) {
      this.passwordError.set('Please enter a password.');
      return;
    }
    if (!this.pendingEncryptedBytes || !this.pendingEncryptedFile) {
      this.cancelPasswordPrompt();
      return;
    }

    try {
      const pdfProxy = await this.sharedPdfjs.loadDocument(this.pendingEncryptedBytes, {
        password: pwd
      });
      const file = this.pendingEncryptedFile;
      const bytes = this.pendingEncryptedBytes;
      const compliance = this.complianceService.checkCompliance(bytes);
      compliance.warningMessage =
        'This PDF was password-protected. The watermarked copy will be saved without encryption.';

      const addedItem: WatermarkFileItem = {
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        bytes,
        totalPages: pdfProxy.numPages,
        pdfProxy,
        settings: JSON.parse(JSON.stringify(this.settings())),
        complianceReport: compliance
      };

      const updated = [...this.files(), addedItem];
      this.files.set(updated);
      this.selectedFileIndex.set(updated.length - 1);
      this.totalPages.set(pdfProxy.numPages);
      this.currentPage.set(1);
      this.currentState.set('organize');
      this.layoutService.hideFooter();
      this.cancelPasswordPrompt();
    } catch {
      this.passwordError.set('Incorrect password. Please try again.');
    }
  }

  confirmSignatureAndExecute(): void {
    this.showSignatureModal.set(false);
    this.proceedWithExecution();
  }

  // Execution: Add Watermark (Single or Multiple R-037, R-038, R-044)
  async executeWatermark(): Promise<void> {
    if (!this.isSettingsValid() || this.files().length === 0) {
      return;
    }

    // Check for existing digital signatures (R-044)
    const hasAnySignature = this.files().some(f => f.complianceReport.hasSignatures);
    if (hasAnySignature) {
      this.showSignatureModal.set(true);
      return;
    }

    await this.proceedWithExecution();
  }

  async proceedWithExecution(): Promise<void> {
    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.processingProgress.set(5);
    this.processingMessage.set('Preparing documents and stamping watermark...');
    this.currentState.set('processing');

    try {
      if (this.files().length === 1) {
        // Single file processing
        const fileItem = this.files()[0];
        const settingsToUse = this.sameSettingsForAll() ? this.settings() : fileItem.settings;

        const outcome = await this.processingService.processWatermark(
          fileItem.bytes,
          fileItem.name,
          settingsToUse,
          this.currentFontBytes() || this.defaultFontBytes,
          progress => {
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
        this.multiFileResults.set([outcome]);
      } else {
        // Multi-file processing with ZIP (R-037, R-038)
        const filesToProcess = this.files().map(f => ({
          filename: f.name,
          pdfBytes: f.bytes,
          settings: this.sameSettingsForAll() ? this.settings() : f.settings
        }));

        const multiOutcome = await this.processingService.processMultipleWatermarks(
          filesToProcess,
          this.currentFontBytes() || this.defaultFontBytes,
          progress => {
            this.processingProgress.set(progress.percent);
            if (progress.message) {
              this.processingMessage.set(progress.message);
            }
          }
        );

        const zipBlob = new Blob([multiOutcome.zipBytes as any], { type: 'application/zip' });
        const zipUrl = URL.createObjectURL(zipBlob);
        this.zipBlobUrl.set(zipUrl);
        this.zipFilename.set(multiOutcome.zipFilename);
        this.multiFileResults.set(multiOutcome.results);

        const allWarnings: WatermarkExportWarning[] = [];
        for (const res of multiOutcome.results) {
          allWarnings.push(...res.warnings);
        }
        this.resultWarnings.set(allWarnings);

        this.resultData.set({
          blob: zipBlob,
          url: zipUrl,
          filename: multiOutcome.zipFilename,
          pageCount: multiOutcome.results.reduce((sum, r) => sum + r.totalPages, 0),
          sizeBytes: zipBlob.size,
          formattedSize: this.formatBytes(zipBlob.size),
          previewUrl: undefined
        });
      }

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

  downloadSingleResult(res: WatermarkProcessResult): void {
    const blob = new Blob([res.pdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadAllZip(): void {
    const url = this.zipBlobUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = this.zipFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  resetTool(): void {
    this.cleanupResultUrl();
    if (this.zipBlobUrl()) {
      URL.revokeObjectURL(this.zipBlobUrl()!);
      this.zipBlobUrl.set(null);
    }
    this.files.set([]);
    this.selectedFileIndex.set(0);
    this.currentPage.set(1);
    this.totalPages.set(1);
    this.zoom.set(1.0);
    this.resultData.set(null);
    this.resultWarnings.set([]);
    this.multiFileResults.set([]);
    this.errorMessage.set(null);
    this.settings.set(JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS)));
    this.currentState.set('upload');
    this.layoutService.showFooter();
  }

  // Helpers
  private updateCommon(patch: Partial<WatermarkFileSettings['common']>): void {
    this.settings.update(s => {
      const updated = {
        ...s,
        common: { ...s.common, ...patch }
      };
      if (this.isRememberSettings()) {
        this.storageService.saveLastSettings(updated);
      }
      return updated;
    });

    if (this.sameSettingsForAll()) {
      const currentSettings = JSON.stringify(this.settings());
      this.files.update(list => list.map(f => ({ ...f, settings: JSON.parse(currentSettings) })));
    } else {
      const idx = this.selectedFileIndex();
      this.files.update(list => {
        if (!list[idx]) return list;
        const copy = [...list];
        copy[idx] = { ...copy[idx], settings: JSON.parse(JSON.stringify(this.settings())) };
        return copy;
      });
    }
  }

  private updateTextConfig(patch: Partial<TextWatermarkConfig>): void {
    this.settings.update(s => {
      const updated = {
        ...s,
        textConfig: { ...s.textConfig, ...patch }
      };
      if (this.isRememberSettings()) {
        this.storageService.saveLastSettings(updated);
      }
      return updated;
    });

    if (this.sameSettingsForAll()) {
      const currentSettings = JSON.stringify(this.settings());
      this.files.update(list => list.map(f => ({ ...f, settings: JSON.parse(currentSettings) })));
    } else {
      const idx = this.selectedFileIndex();
      this.files.update(list => {
        if (!list[idx]) return list;
        const copy = [...list];
        copy[idx] = { ...copy[idx], settings: JSON.parse(JSON.stringify(this.settings())) };
        return copy;
      });
    }
  }

  private updateImageConfig(patch: Partial<ImageWatermarkConfig>): void {
    this.settings.update(s => {
      const updated = {
        ...s,
        imageConfig: { ...s.imageConfig, ...patch }
      };
      if (this.isRememberSettings()) {
        this.storageService.saveLastSettings(updated);
      }
      return updated;
    });

    if (this.sameSettingsForAll()) {
      const currentSettings = JSON.stringify(this.settings());
      this.files.update(list => list.map(f => ({ ...f, settings: JSON.parse(currentSettings) })));
    } else {
      const idx = this.selectedFileIndex();
      this.files.update(list => {
        if (!list[idx]) return list;
        const copy = [...list];
        copy[idx] = { ...copy[idx], settings: JSON.parse(JSON.stringify(this.settings())) };
        return copy;
      });
    }
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
