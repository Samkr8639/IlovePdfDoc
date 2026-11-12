import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreateSignRequestInput,
  deriveInitials,
  formatSigningDate,
  getDefaultDateFormatForLocale,
  parsePageRange,
  PdfPageBoxMetrics,
  SIGN_SCRIPT_FONTS,
  SignCheckboxConfig,
  SignCheckboxMark,
  SignDateFormat,
  SignFieldElement,
  SignFieldType,
  SignRequestOrder,
  SignStampSource,
  SignTextConfig,
  normalizeSignFieldElement
} from '@paperflow/contracts';
import {
  UnsupportedPkcs12CipherError,
  decodePdfTextString,
  repairMojibakeFilename
} from '@paperflow/sign-core';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';
import { PtAdSlotComponent } from '../../shared/components/pt-ad-slot/pt-ad-slot.component';
import { ExploreMoreToolsComponent } from '../../shared/components/explore-more-tools/explore-more-tools.component';
import { PdfThumbnailsPanelComponent } from '../edit-pdf/components/pdf-thumbnails-panel/pdf-thumbnails-panel.component';
import { PdfBottomBarComponent } from '../edit-pdf/components/pdf-bottom-bar/pdf-bottom-bar.component';
import { CommandHistoryService } from '../edit-pdf/services/command-history';
import { CoordinateTransformService } from '../edit-pdf/services/coordinate-transform';
import { ViewportNavigationService } from '../edit-pdf/services/viewport-navigation.service';
import { LayoutService } from '../../core/services/layout.service';
import { SeoService } from '../../core/services/seo.service';
import { SharedPdfjsService, PdfPasswordError } from '../../core/services/shared-pdfjs.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { UploadConsentService } from '../../core/services/upload-consent.service';
import { MergeResult } from '../../core/services/browser-pdf.service';
import { PdfInspectionService } from '../../core/services/sign-pdf/pdf-inspection.service';
import { SignatureImageService } from '../../core/services/sign-pdf/signature-image.service';
import { SignatureStorageService } from '../../core/services/sign-pdf/signature-storage.service';
import { SignExportService } from '../../core/services/sign-pdf/sign-export.service';
import {
  SenderRequestCreateResult,
  SenderRequestStatusView,
  SignRequestService
} from '../../core/services/sign-pdf/sign-request.service';
import {
  PdfInspectionSummary,
  SIGN_DATE_FORMAT_OPTIONS,
  SIGN_FIELD_PALETTE,
  SIGN_PDF_FEATURES,
  SIGN_PDF_LIMITS,
  SIGNER_CHIP_COLORS,
  SignExportOutcome,
  SignModeChoice,
  SignTypeChoice,
  SignWorkflowStage,
  SignatureDialogKind,
  SignerDraft
} from '../../core/services/sign-pdf/sign-pdf.models';
import {
  SignSignatureDialogComponent,
  SignatureApplyResult
} from './components/signature-dialog/signature-dialog.component';
import {
  SignStampDialogComponent,
  StampApplyResult
} from './components/stamp-dialog/stamp-dialog.component';
import {
  ResizeCorner,
  SignFieldBoxComponent
} from './components/sign-field-box/sign-field-box.component';

interface SmartGuideLine {
  orientation: 'v' | 'h';
  posPx: number;
}

@Component({
  selector: 'app-sign-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent,
    PtAdSlotComponent,
    ExploreMoreToolsComponent,
    PdfThumbnailsPanelComponent,
    PdfBottomBarComponent,
    SignSignatureDialogComponent,
    SignStampDialogComponent,
    SignFieldBoxComponent
  ],
  templateUrl: './sign-pdf.component.html',
  styleUrl: './sign-pdf.component.css'
})
export class SignPdfComponent implements OnInit, OnDestroy {
  private readonly layoutService = inject(LayoutService);
  private readonly seo = inject(SeoService);
  private readonly toolRegistry = inject(ToolRegistryService);
  private readonly pdfjs = inject(SharedPdfjsService);
  private readonly inspection = inject(PdfInspectionService);
  private readonly imageService = inject(SignatureImageService);
  private readonly storageService = inject(SignatureStorageService);
  private readonly signExport = inject(SignExportService);
  private readonly signRequestApi = inject(SignRequestService);
  private readonly uploadConsent = inject(UploadConsentService);
  private readonly transform = inject(CoordinateTransformService);
  private readonly navService = inject(ViewportNavigationService);
  readonly history = inject(CommandHistoryService);

  readonly features = SIGN_PDF_FEATURES;
  readonly paletteItems = SIGN_FIELD_PALETTE;
  readonly dateFormatOptions = SIGN_DATE_FORMAT_OPTIONS;
  readonly scriptFonts = SIGN_SCRIPT_FONTS;

  // Root state signals
  readonly stage = signal<SignWorkflowStage>('upload');
  readonly errorMessage = signal<string | null>(null);
  readonly liveAnnouncement = signal<string>('');
  readonly whoSigns = signal<SignModeChoice>('only_me');
  readonly signType = signal<SignTypeChoice>('simple');

  // Document signals
  readonly selectedFile = signal<File | null>(null);
  readonly pages = signal<PdfPageBoxMetrics[]>([]);
  readonly currentPageIndex = signal<number>(0);
  readonly zoom = signal<number>(1.0);
  readonly thumbnails = signal<Map<number, string>>(new Map());
  readonly isThumbnailsCollapsed = signal<boolean>(false);
  readonly isMobileSidebarOpen = signal<boolean>(false);
  readonly inspectionSummary = signal<PdfInspectionSummary | null>(null);
  readonly flattenFormFields = signal<boolean>(false);
  readonly addSigningDetails = signal<boolean>(false);

  // Blocking prompts (Encrypted PDF password / Existing Digital Signature confirmation)
  readonly showPasswordModal = signal<boolean>(false);
  readonly passwordInput = signal<string>('');
  readonly passwordError = signal<string | null>(null);
  readonly showExistingSigConfirmModal = signal<boolean>(false);
  readonly wasEncryptedOnLoad = signal<boolean>(false);
  readonly invalidatedExistingSigConfirmed = signal<boolean>(false);

  // Signer profile & created assets
  readonly fullName = signal<string>('');
  readonly rememberName = signal<boolean>(false);
  readonly dateFormat = signal<SignDateFormat>(getDefaultDateFormatForLocale());
  readonly customDateValue = signal<string>(formatSigningDate(new Date(), getDefaultDateFormatForLocale()));
  readonly signatureDataUrl = signal<string | null>(null);
  readonly signatureColor = signal<string>('#14213D');
  readonly initialsDataUrl = signal<string | null>(null);
  readonly stampDataUrl = signal<string | null>(null);
  readonly stampSource = signal<SignStampSource | null>(null);
  readonly editingStampField = signal<SignFieldElement | null>(null);
  readonly editingSignatureField = signal<SignFieldElement | null>(null);
  readonly isEditingDefaultStamp = signal<boolean>(false);
  readonly newlyPlacedFieldId = signal<string | null>(null);
  readonly detailsExpanded = signal<boolean>(true);
  readonly presetTextColors = ['#14213D', '#0F766E', '#E05D44', '#0284C7', '#7C3AED', '#059669'];
  private activeStampTemplateId: string = `stamp-tmpl-${Date.now()}`;

  // Fields on pages + interaction state
  readonly fields = signal<SignFieldElement[]>([]);
  readonly selectedFieldId = signal<string | null>(null);
  readonly armedToolType = signal<SignFieldType | null>(null);
  readonly ghostCursor = signal<{ pageIndex: number; x: number; y: number } | null>(null);
  readonly smartGuides = signal<Map<number, SmartGuideLine[]>>(new Map());

  // Dialogs
  readonly signatureDialogKind = signal<SignatureDialogKind | null>(null);
  readonly showStampDialog = signal<boolean>(false);
  readonly showApplyPagesModal = signal<boolean>(false);
  readonly applyPagesRangeInput = signal<string>('1');
  readonly applyPagesError = signal<string | null>(null);

  // Digital signature (.p12 / .pfx) state
  readonly certFile = signal<File | null>(null);
  readonly certPassword = signal<string>('');
  readonly showCertPassword = signal<boolean>(false);
  readonly certReason = signal<string>('Digitally signed with PDFTailor');
  readonly certLocation = signal<string>('');

  // Multi-signer ("Several people") & live tracker state
  readonly signers = signal<SignerDraft[]>([
    { id: 'signer-1', name: 'Signer 1', email: '', orderIndex: 0, color: SIGNER_CHIP_COLORS[0] }
  ]);
  readonly activeSignerId = signal<string>('signer-1');
  readonly signingOrder = signal<SignRequestOrder>('parallel');
  readonly requestTitle = signal<string>('');
  readonly senderEmail = signal<string>('');
  readonly requestMessage = signal<string>('');
  readonly expiryDays = signal<number>(SIGN_PDF_LIMITS.defaultExpiryDays);
  readonly remindersEnabled = signal<boolean>(true);
  readonly requireSignerOtp = signal<boolean>(false);
  readonly showSendRequestModal = signal<boolean>(false);
  readonly sendModalError = signal<string | null>(null);
  readonly senderOtpSent = signal<boolean>(false);
  readonly senderOtpCode = signal<string>('');
  readonly senderOtpVerified = signal<boolean>(false);
  readonly senderDevOtpHint = signal<string | null>(null);
  readonly senderOtpBusy = signal<boolean>(false);
  readonly sentResult = signal<SenderRequestCreateResult | null>(null);
  readonly sentStatus = signal<SenderRequestStatusView | null>(null);
  readonly trackerBusy = signal<boolean>(false);
  readonly trackerNotice = signal<string | null>(null);
  readonly resendEmailOverrides = signal<Record<string, string>>({});
  readonly copiedLinkSignerId = signal<string | null>(null);

  // Result & processing guards
  readonly exportOutcome = signal<SignExportOutcome | null>(null);
  readonly isProcessing = signal<boolean>(false);
  readonly hasUnsavedChanges = computed(() => this.stage() === 'editor' && this.fields().length > 0 && !this.exportOutcome());

  // Derived View Models (computed only)
  readonly placedSignatureCount = computed(() =>
    this.fields().filter(f => f.type === 'signature').length
  );
  readonly validSignersReady = computed(() => {
    const list = this.signers();
    if (list.length === 0 || list.length > SIGN_PDF_LIMITS.maxSigners) return false;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set<string>();
    for (const s of list) {
      const normalized = s.email.trim().toLowerCase();
      if (!s.name.trim() || !emailRe.test(normalized) || seen.has(normalized)) return false;
      seen.add(normalized);
    }
    return true;
  });
  readonly canSign = computed(() => {
    if (this.isProcessing()) return false;
    if (this.whoSigns() === 'several_people') {
      return this.placedSignatureCount() > 0 && this.validSignersReady();
    }
    if (this.signType() === 'digital_certificate') {
      return !!this.certFile();
    }
    return this.placedSignatureCount() > 0;
  });
  readonly actionDisabledReason = computed<string | null>(() => {
    if (this.canSign()) return null;
    if (this.whoSigns() === 'several_people') {
      if (!this.validSignersReady()) {
        return 'Enter a unique name and valid email for each recipient';
      }
      return 'Place at least one Signature field on the page for a recipient';
    }
    if (this.signType() === 'digital_certificate') {
      return 'Upload a .p12 or .pfx certificate file to sign';
    }
    return 'Place your signature on the page first';
  });
  readonly resultIsClientSide = computed(() => this.exportOutcome()?.signedMode !== 'server_openssl');
  readonly displayFileName = computed(() => {
    const f = this.selectedFile();
    return f?.name ? repairMojibakeFilename(f.name) : 'document.pdf';
  });
  readonly hasStampCopies = computed(() => {
    const sel = this.editingStampField();
    if (!sel || !sel.templateId) return false;
    return this.fields().filter(f => f.templateId === sel.templateId).length > 1;
  });
  readonly selectedField = computed<SignFieldElement | null>(() => {
    const id = this.selectedFieldId();
    return id ? (this.fields().find(f => f.id === id) || null) : null;
  });
  readonly formattedInitialsText = computed(() => deriveInitials(this.fullName() || 'Signer'));
  readonly fieldsByPage = computed(() => {
    const map = new Map<number, SignFieldElement[]>();
    for (const f of this.fields()) {
      const arr = map.get(f.pageIndex) || [];
      arr.push(f);
      map.set(f.pageIndex, arr);
    }
    return map;
  });
  readonly resultViewModel = computed<MergeResult | null>(() => {
    const out = this.exportOutcome();
    if (!out) return null;
    return {
      blob: out.blob,
      url: out.url,
      filename: out.filename,
      sizeBytes: out.sizeBytes,
      formattedSize: out.formattedSize,
      pageCount: out.originalPageCount
    };
  });
  readonly resultSubtitle = computed(() => {
    const out = this.exportOutcome();
    if (!out) return '';
    if (out.certificateSubject) {
      const modeLabel = out.signedMode === 'server_openssl' ? 'with temporary OpenSSL' : 'right in your browser';
      return `Signed with certificate "${out.certificateSubject}" (Issuer: ${out.certificateIssuer || 'Self-signed'}) ${modeLabel}.`;
    }
    return `Applied ${out.fieldsApplied} field${out.fieldsApplied === 1 ? '' : 's'} across ${out.pagesSigned.length} page${out.pagesSigned.length === 1 ? '' : 's'} right in your browser.`;
  });

  // Internal non-reactive mutable state
  private rawPdfBytes: Uint8Array | null = null;
  private pdfDocProxy: any = null;
  private renderedPagesCache = new Map<number, HTMLCanvasElement>();
  private activeRenderTasks = new Map<number, any>();
  private resizeDebounceTimeout: any = null;
  private rafDragId: number | null = null;
  private pendingPointerPos: { x: number; y: number } | null = null;
  private runCounter = 0;
  private abortController: AbortController | null = null;
  private pendingSignatureInsertType: SignFieldType | null = null;
  private pendingEncryptedBytes: Uint8Array | null = null;
  private pendingEncryptedFile: File | null = null;
  private dragState: {
    kind: 'move' | 'resize' | 'rotate';
    field: SignFieldElement;
    startClientX: number;
    startClientY: number;
    origField: SignFieldElement;
    corner?: ResizeCorner;
  } | null = null;

  ngOnInit(): void {
    const def = this.toolRegistry.getToolById('sign-pdf');
    if (def?.seo) this.seo.setSeoData(def.seo);

    const savedName = this.storageService.getRememberedSignerName();
    if (savedName) {
      this.fullName.set(savedName);
      this.rememberName.set(true);
    }
    this.customDateValue.set(formatSigningDate(new Date(), this.dateFormat()));

    this.storageService.getDefaultStamp?.()?.then(st => {
      if (st) {
        this.stampDataUrl.set(st.imageDataUrl);
        this.stampSource.set(st.source);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.resizeDebounceTimeout) {
      clearTimeout(this.resizeDebounceTimeout);
      this.resizeDebounceTimeout = null;
    }
    if (this.rafDragId !== null) {
      cancelAnimationFrame(this.rafDragId);
      this.rafDragId = null;
    }
    this.cancelAllRenderTasks();
    this.layoutService.showFooter();
    this.cleanupResources();
  }

  private cancelAllRenderTasks(): void {
    for (const [idx, task] of this.activeRenderTasks.entries()) {
      try {
        task.cancel();
      } catch {
        // ignore cancellation
      }
    }
    this.activeRenderTasks.clear();
  }

  canDeactivate(): boolean {
    if (!this.hasUnsavedChanges()) return true;
    return typeof window !== 'undefined'
      ? window.confirm('You have placed signature fields that have not been saved yet. Leave without downloading?')
      : true;
  }

  /* =========================================================================
     FILE UPLOAD, PASSWORD & EXISTING-SIGNATURE INSPECTION
     ========================================================================= */

  async onFilesSelected(files: File[]): Promise<void> {
    this.errorMessage.set(null);
    const file = files?.[0];
    if (!file) return;

    const current = this.selectedFile();
    if (current && current.name === file.name && current.size === file.size && current.lastModified === file.lastModified) {
      this.errorMessage.set(`"${file.name}" is already loaded in the editor.`);
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      this.inspection.validatePdfMagicAndSize(file, bytes, SIGN_PDF_LIMITS.clientMaxFileSizeBytes);
      const summary = await this.inspection.inspectPdf(bytes);

      if (summary.isEncrypted) {
        this.pendingEncryptedBytes = bytes;
        this.pendingEncryptedFile = file;
        this.passwordInput.set('');
        this.passwordError.set(null);
        this.showPasswordModal.set(true);
        return;
      }

      if (summary.hasExistingDigitalSignatures) {
        this.rawPdfBytes = bytes;
        this.selectedFile.set(file);
        this.inspectionSummary.set(summary);
        this.wasEncryptedOnLoad.set(false);
        this.showExistingSigConfirmModal.set(true);
        return;
      }

      await this.enterEditorWithPdf(file, bytes, summary, false, false);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Unable to load the selected PDF document.');
    }
  }

  async submitPassword(): Promise<void> {
    const pw = this.passwordInput();
    if (!pw || !this.pendingEncryptedBytes || !this.pendingEncryptedFile) return;
    this.passwordError.set(null);
    try {
      const doc = await this.pdfjs.loadDocument(this.pendingEncryptedBytes, { password: pw });
      if (doc.numPages > SIGN_PDF_LIMITS.clientMaxPages) {
        await this.pdfjs.destroyDocument(doc);
        this.passwordError.set(`Document exceeds ${SIGN_PDF_LIMITS.clientMaxPages} pages.`);
        return;
      }
      // Build page metrics directly from pdf.js viewport metadata for encrypted docs
      const pagesMeta: PdfPageBoxMetrics[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i);
        const vp = pg.getViewport({ scale: 1.0 });
        const rawRot = ((pg.rotate || 0) % 360 + 360) % 360;
        const sideways = rawRot === 90 || rawRot === 270;
        pagesMeta.push({
          pageIndex: i - 1,
          widthPt: sideways ? vp.height : vp.width,
          heightPt: sideways ? vp.width : vp.height,
          rotation: rawRot
        });
      }
      await this.pdfjs.destroyDocument(doc);

      const file = this.pendingEncryptedFile;
      const bytes = this.pendingEncryptedBytes;
      this.pendingEncryptedBytes = null;
      this.pendingEncryptedFile = null;
      this.showPasswordModal.set(false);

      const summary: PdfInspectionSummary = {
        pageCount: pagesMeta.length,
        hasExistingDigitalSignatures: false,
        hasAcroFormFields: false,
        acroFormFieldCount: 0,
        isEncrypted: true,
        pagesMeta
      };
      await this.enterEditorWithPdf(file, bytes, summary, true, false, pw);
    } catch (err: any) {
      if (err instanceof PdfPasswordError) {
        this.passwordError.set(err.message);
      } else {
        this.passwordError.set('Could not unlock this PDF with the supplied password.');
      }
    }
  }

  cancelPasswordModal(): void {
    this.showPasswordModal.set(false);
    this.pendingEncryptedBytes = null;
    this.pendingEncryptedFile = null;
    this.passwordInput.set('');
  }

  async confirmExistingSignatureProceed(): Promise<void> {
    this.showExistingSigConfirmModal.set(false);
    const file = this.selectedFile();
    const bytes = this.rawPdfBytes;
    const summary = this.inspectionSummary();
    if (!file || !bytes || !summary) return;
    await this.enterEditorWithPdf(file, bytes, summary, this.wasEncryptedOnLoad(), true);
  }

  cancelExistingSignatureModal(): void {
    this.showExistingSigConfirmModal.set(false);
    this.resetAll();
  }

  private async enterEditorWithPdf(
    file: File,
    bytes: Uint8Array,
    summary: PdfInspectionSummary,
    wasEncrypted: boolean,
    invalidatedExistingSig: boolean,
    password?: string
  ): Promise<void> {
    this.cleanupPdfDocOnly();
    this.rawPdfBytes = bytes;
    this.selectedFile.set(file);
    this.inspectionSummary.set(summary);
    this.wasEncryptedOnLoad.set(wasEncrypted);
    this.invalidatedExistingSigConfirmed.set(invalidatedExistingSig);
    this.pages.set(summary.pagesMeta);
    this.fields.set([]);
    this.history.clear();
    this.selectedFieldId.set(null);
    this.currentPageIndex.set(0);
    const firstPage = summary.pagesMeta[0];
    const initialZoom = firstPage
      ? this.navService.computeFitWidthZoom(this.transform.getPageDisplaySize(firstPage, 1.0).width)
      : 1.0;
    this.zoom.set(initialZoom);
    this.flattenFormFields.set(false);
    this.revokeExportUrl();
    this.exportOutcome.set(null);

    try {
      this.pdfDocProxy = await this.pdfjs.loadDocument(bytes, { password });
      this.stage.set('editor');
      this.layoutService.hideFooter();
      setTimeout(() => {
        void this.renderVisibleWindow();
        void this.generateInitialThumbnails();
      }, 40);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to render PDF document.');
      this.resetAll();
    }
  }

  /* =========================================================================
     VIEWPORT & MEMORY-BOUNDED PAGE RENDERING (VISIBLE ± 1)
     ========================================================================= */

  getPageSize(page: PdfPageBoxMetrics): { width: number; height: number } {
    return this.transform.getPageDisplaySize(page, this.zoom());
  }

  async renderVisibleWindow(): Promise<void> {
    const doc = this.pdfDocProxy;
    if (!doc || this.stage() !== 'editor') return;

    const current = this.currentPageIndex();
    const minIdx = Math.max(0, current - 1);
    const maxIdx = Math.min(this.pages().length - 1, current + 1);
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;

    // Destroy far-away canvases to keep memory flat across 50-500 page PDFs
    for (const [idx, oldCanvas] of Array.from(this.renderedPagesCache.entries())) {
      if (idx < minIdx || idx > maxIdx) {
        const runningTask = this.activeRenderTasks.get(idx);
        if (runningTask) {
          try { runningTask.cancel(); } catch { /* ignore */ }
          this.activeRenderTasks.delete(idx);
        }
        oldCanvas.width = 0;
        oldCanvas.height = 0;
        this.renderedPagesCache.delete(idx);
      }
    }

    for (let idx = minIdx; idx <= maxIdx; idx++) {
      const pageMeta = this.pages()[idx];
      if (!pageMeta) continue;
      const canvas = typeof document !== 'undefined'
        ? (document.getElementById(`sign-canvas-${idx}`) as HTMLCanvasElement | null)
        : null;
      if (!canvas) continue;

      const existingTask = this.activeRenderTasks.get(idx);
      if (existingTask) {
        try { existingTask.cancel(); } catch { /* ignore */ }
        this.activeRenderTasks.delete(idx);
      }

      try {
        const pdfPage = await doc.getPage(idx + 1);
        const display = this.getPageSize(pageMeta);
        const unitVp = pdfPage.getViewport({ scale: 1.0 });
        const scale = (display.width / Math.max(1, unitVp.width)) * dpr;
        const vp = pdfPage.getViewport({ scale });

        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = `${display.width}px`;
        canvas.style.height = `${display.height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const renderTask = pdfPage.render({ canvasContext: ctx, viewport: vp });
          this.activeRenderTasks.set(idx, renderTask);
          try {
            await renderTask.promise;
            this.renderedPagesCache.set(idx, canvas);
          } catch (err: any) {
            if (err?.name !== 'RenderingCancelledException') {
              // Ignore cancellation
            }
          } finally {
            if (this.activeRenderTasks.get(idx) === renderTask) {
              this.activeRenderTasks.delete(idx);
            }
          }
        }
        if (typeof pdfPage.cleanup === 'function') pdfPage.cleanup();
      } catch {
        // Page render or load error handled gracefully
      }
    }
  }

  private async generateInitialThumbnails(): Promise<void> {
    const doc = this.pdfDocProxy;
    if (!doc) return;
    const total = Math.min(doc.numPages, 40);
    const map = new Map<number, string>();
    for (let i = 1; i <= total; i++) {
      if (!this.pdfDocProxy || this.stage() !== 'editor') return;
      try {
        const pg = await doc.getPage(i);
        const vp = pg.getViewport({ scale: 0.16 });
        const off = document.createElement('canvas');
        off.width = Math.max(1, Math.floor(vp.width));
        off.height = Math.max(1, Math.floor(vp.height));
        const ctx = off.getContext('2d');
        if (ctx) {
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          const blob = await new Promise<Blob | null>(res => off.toBlob(res, 'image/jpeg', 0.72));
          if (blob) map.set(i - 1, URL.createObjectURL(blob));
        }
        off.width = 0;
        off.height = 0;
        if (typeof pg.cleanup === 'function') pg.cleanup();
      } catch {
        // Fallback lines displayed automatically by PdfThumbnailsPanelComponent
      }
    }
    this.revokeThumbnailUrls();
    this.thumbnails.set(map);
  }

  goToPage(idx: number): void {
    const clamped = this.navService.clampPageIndex(idx, this.pages().length);
    this.currentPageIndex.set(clamped);
    if (typeof document !== 'undefined') {
      document.getElementById(`sign-page-${clamped}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    void this.renderVisibleWindow();
  }

  zoomIn(): void {
    this.zoom.set(this.navService.zoomIn(this.zoom()));
    void this.renderVisibleWindow();
  }

  zoomOut(): void {
    this.zoom.set(this.navService.zoomOut(this.zoom()));
    void this.renderVisibleWindow();
  }

  resetZoom(): void {
    const active = this.pages()[this.currentPageIndex()] || this.pages()[0];
    const widthAt100 = active ? this.transform.getPageDisplaySize(active, 1.0).width : undefined;
    this.zoom.set(this.navService.resetZoom(widthAt100));
    void this.renderVisibleWindow();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.stage() !== 'editor' || typeof window === 'undefined') return;
    if (this.resizeDebounceTimeout) {
      clearTimeout(this.resizeDebounceTimeout);
    }
    this.resizeDebounceTimeout = setTimeout(() => {
      const active = this.pages()[this.currentPageIndex()] || this.pages()[0];
      if (!active) return;
      const widthAt100 = this.transform.getPageDisplaySize(active, 1.0).width;
      if (window.innerWidth <= 768) {
        const fit = this.navService.computeFitWidthZoom(widthAt100, window.innerWidth);
        if (this.zoom() * widthAt100 > window.innerWidth - 20) {
          this.zoom.set(fit);
          void this.renderVisibleWindow();
        }
      }
    }, 150);
  }

  /* =========================================================================
     FIELD PALETTE, CLICK-TO-PLACE, DRAG-AND-DROP & KEYBOARD PLACEMENT
     ========================================================================= */

  onPaletteTileClick(type: SignFieldType): void {
    const isRemote = this.whoSigns() === 'several_people';
    if (!isRemote && type === 'signature' && !this.signatureDataUrl()) {
      this.pendingSignatureInsertType = 'signature';
      this.signatureDialogKind.set('signature');
      return;
    }
    if (!isRemote && type === 'initials' && !this.initialsDataUrl()) {
      this.pendingSignatureInsertType = 'initials';
      this.signatureDialogKind.set('initials');
      return;
    }
    if (!isRemote && type === 'stamp' && !this.stampDataUrl()) {
      this.pendingSignatureInsertType = 'stamp';
      this.showStampDialog.set(true);
      return;
    }

    // Toggle armed click-to-place mode
    this.armedToolType.set(this.armedToolType() === type ? null : type);
    if (this.armedToolType()) {
      this.announce(`${type} tool armed. Click any page to place, or press Escape to cancel.`);
    }
  }

  onPaletteTileEnter(type: SignFieldType, event: Event): void {
    event.preventDefault();
    const isRemote = this.whoSigns() === 'several_people';
    if (!isRemote && ((type === 'signature' && !this.signatureDataUrl()) ||
        (type === 'initials' && !this.initialsDataUrl()) ||
        (type === 'stamp' && !this.stampDataUrl()))) {
      this.onPaletteTileClick(type);
      return;
    }
    const pageIdx = this.currentPageIndex();
    const pageMeta = this.pages()[pageIdx];
    if (!pageMeta) return;
    const disp = this.getPageSize(pageMeta);
    const existingCount = this.fieldsByPage().get(pageIdx)?.length || 0;
    const yOffset = ((existingCount % 5) - 1) * 56;
    this.placeFieldAtScreenCenter(type, pageIdx, disp.width / 2, disp.height / 2 + yOffset);
  }

  onPaletteDragStart(event: DragEvent, type: SignFieldType): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/x-sign-field-type', type);
      event.dataTransfer.effectAllowed = 'copy';
    }
    this.armedToolType.set(type);
  }

  onPageDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onPageDrop(event: DragEvent, pageIndex: number): void {
    event.preventDefault();
    const type = (event.dataTransfer?.getData('application/x-sign-field-type') || this.armedToolType()) as SignFieldType;
    if (!type) return;

    const container = (event.currentTarget as HTMLElement)?.getBoundingClientRect();
    if (!container) return;
    const xPx = event.clientX - container.left;
    const yPx = event.clientY - container.top;
    const isRemote = this.whoSigns() === 'several_people';

    if (!isRemote && type === 'signature' && !this.signatureDataUrl()) {
      this.pendingSignatureInsertType = 'signature';
      this.signatureDialogKind.set('signature');
      return;
    }
    if (!isRemote && type === 'initials' && !this.initialsDataUrl()) {
      this.pendingSignatureInsertType = 'initials';
      this.signatureDialogKind.set('initials');
      return;
    }
    if (!isRemote && type === 'stamp' && !this.stampDataUrl()) {
      this.pendingSignatureInsertType = 'stamp';
      this.showStampDialog.set(true);
      return;
    }

    this.placeFieldAtScreenCenter(type, pageIndex, xPx, yPx);
    this.armedToolType.set(null);
    this.ghostCursor.set(null);
  }

  onPageMouseMove(event: MouseEvent, pageIndex: number): void {
    if (this.armedToolType()) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.ghostCursor.set({
        pageIndex,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    } else if (this.ghostCursor()) {
      this.ghostCursor.set(null);
    }
  }

  onPageClick(event: MouseEvent, pageIndex: number): void {
    this.currentPageIndex.set(pageIndex);
    const armed = this.armedToolType();
    if (!armed) {
      this.selectedFieldId.set(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.placeFieldAtScreenCenter(armed, pageIndex, event.clientX - rect.left, event.clientY - rect.top);
    this.armedToolType.set(null);
    this.ghostCursor.set(null);
  }

  private placeFieldAtScreenCenter(type: SignFieldType, pageIndex: number, cxPx: number, cyPx: number): void {
    const pageMeta = this.pages()[pageIndex];
    if (!pageMeta) return;
    const preset = this.paletteItems.find(p => p.type === type) || this.paletteItems[0];
    const disp = this.getPageSize(pageMeta);
    const z = this.zoom();
    const wPx = preset.defaultWidthPt * z;
    const hPx = preset.defaultHeightPt * z;

    const clampedX = Math.max(4, Math.min(disp.width - wPx - 4, cxPx - wPx / 2));
    const clampedY = Math.max(4, Math.min(disp.height - hPx - 4, cyPx - hPx / 2));

    const pdfRect = this.transform.screenRectToPdfRect(
      { x: clampedX, y: clampedY, width: wPx, height: hPx },
      pageMeta,
      z
    );

    const maxZ = this.fields().reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);
    const activeDate = this.customDateValue() || formatSigningDate(new Date(), this.dateFormat());
    const nameText = (this.fullName() || 'Signer Name').trim();

    const elId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const el: SignFieldElement = {
      id: elId,
      pageIndex,
      type,
      ...pdfRect,
      zIndex: maxZ + 1,
      signerId: this.whoSigns() === 'several_people' ? this.activeSignerId() : undefined,
      required: type === 'signature',
      imageDataUrl:
        type === 'signature'
          ? (this.signatureDataUrl() || undefined)
          : type === 'initials'
            ? (this.initialsDataUrl() || undefined)
            : type === 'stamp'
              ? (this.stampDataUrl() || undefined)
              : undefined,
      stampSource: type === 'stamp' ? (this.stampSource() || undefined) : undefined,
      templateId: type === 'stamp' ? this.activeStampTemplateId : undefined,
      text:
        type === 'name'
          ? nameText
          : type === 'date'
            ? activeDate
            : type === 'text'
              ? ''
              : undefined,
      textConfig:
        type === 'text'
          ? {
              content: '',
              fontSize: 14,
              color: '#14213D',
              align: 'left',
              lineHeight: 1.25,
              opacity: 1,
              autoGrow: true,
              boxWidth: pdfRect.widthPt
            }
          : undefined,
      checkboxConfig:
        type === 'checkbox'
          ? {
              checked: true,
              mark: 'tick',
              boxSize: 18,
              label: {
                content: '',
                fontSize: 12,
                color: '#14213D'
              },
              labelPosition: 'right'
            }
          : undefined,
      fontId: type === 'text' ? 'noto-sans' : undefined,
      fontSizePt: type === 'name' || type === 'date' || type === 'text' ? 14 : undefined,
      color: type === 'checkbox' ? 'var(--pt-teal-700)' : (type === 'text' ? '#14213D' : this.signatureColor()),
      dateFormat: type === 'date' ? this.dateFormat() : undefined,
      checked: type === 'checkbox' ? true : undefined,
      showSigningDetailsLine: type === 'signature' ? this.addSigningDetails() : undefined,
      signingDetailsText: type === 'signature' && this.addSigningDetails()
        ? `Signed by ${nameText} · ${activeDate}`
        : undefined
    };

    this.history.execute({
      description: `Add ${type} field`,
      execute: () => {
        this.fields.update(list => [...list, el]);
        this.selectedFieldId.set(el.id);
        if (type === 'text' || type === 'checkbox') {
          this.newlyPlacedFieldId.set(el.id);
        }
      },
      undo: () => {
        this.fields.update(list => list.filter(f => f.id !== el.id));
        if (this.selectedFieldId() === el.id) this.selectedFieldId.set(null);
      }
    });

    this.announce(`${preset.label} placed on page ${pageIndex + 1}`);
  }

  /* =========================================================================
     FIELD MANIPULATION (DRAG ACROSS PAGES, SMART GUIDES, RESIZE, ROTATE, Z-ORDER)
     ========================================================================= */

  onFieldDragStart(payload: { event: MouseEvent; field: SignFieldElement }): void {
    payload.event.preventDefault();
    this.selectedFieldId.set(payload.field.id);
    this.dragState = {
      kind: 'move',
      field: payload.field,
      startClientX: payload.event.clientX,
      startClientY: payload.event.clientY,
      origField: { ...payload.field }
    };
  }

  onFieldTouchDragStart(payload: { event: TouchEvent; field: SignFieldElement }): void {
    const touch = payload.event.touches[0];
    if (!touch) return;
    this.selectedFieldId.set(payload.field.id);
    this.dragState = {
      kind: 'move',
      field: payload.field,
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      origField: { ...payload.field }
    };
  }

  onFieldResizeStart(payload: { event: MouseEvent; field: SignFieldElement; corner: ResizeCorner }): void {
    this.selectedFieldId.set(payload.field.id);
    this.dragState = {
      kind: 'resize',
      field: payload.field,
      startClientX: payload.event.clientX,
      startClientY: payload.event.clientY,
      origField: { ...payload.field },
      corner: payload.corner
    };
  }

  onFieldRotateStart(payload: { event: MouseEvent; field: SignFieldElement }): void {
    payload.event.preventDefault();
    this.selectedFieldId.set(payload.field.id);
    this.dragState = {
      kind: 'rotate',
      field: payload.field,
      startClientX: payload.event.clientX,
      startClientY: payload.event.clientY,
      origField: { ...payload.field }
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.dragState) return;
    this.schedulePointerMove(event.clientX, event.clientY);
  }

  @HostListener('document:touchmove', ['$event'])
  onDocumentTouchMove(event: TouchEvent): void {
    if (!this.dragState) return;
    const t = event.touches[0];
    if (t) this.schedulePointerMove(t.clientX, t.clientY);
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onDocumentPointerUp(): void {
    if (this.rafDragId !== null) {
      cancelAnimationFrame(this.rafDragId);
      this.rafDragId = null;
    }
    if (!this.dragState) return;
    const { origField, field } = this.dragState;
    const current = this.fields().find(f => f.id === field.id);
    this.dragState = null;
    this.smartGuides.set(new Map());

    if (!current) return;
    const moved =
      origField.pageIndex !== current.pageIndex ||
      Math.abs(origField.xPt - current.xPt) > 0.1 ||
      Math.abs(origField.yPt - current.yPt) > 0.1 ||
      Math.abs(origField.widthPt - current.widthPt) > 0.1 ||
      Math.abs(origField.heightPt - current.heightPt) > 0.1 ||
      (origField.rotation ?? 0) !== (current.rotation ?? 0);

    if (moved) {
      const snapshotAfter = { ...current };
      const snapshotBefore = { ...origField };
      this.history.execute({
        description: 'Transform field',
        execute: () => this.replaceField(snapshotAfter),
        undo: () => this.replaceField(snapshotBefore)
      });
    }
  }

  private schedulePointerMove(clientX: number, clientY: number): void {
    this.pendingPointerPos = { x: clientX, y: clientY };
    if (this.rafDragId !== null) return;
    this.rafDragId = requestAnimationFrame(() => {
      this.rafDragId = null;
      if (this.pendingPointerPos && this.dragState) {
        this.handlePointerMove(this.pendingPointerPos.x, this.pendingPointerPos.y);
      }
    });
  }

  private handlePointerMove(clientX: number, clientY: number): void {
    const st = this.dragState;
    if (!st) return;

    const dxPx = clientX - st.startClientX;
    const dyPx = clientY - st.startClientY;
    const z = this.zoom();

    if (st.kind === 'move') {
      // Check if cursor moved onto another page in continuous view!
      let targetPageIdx = st.origField.pageIndex;
      if (typeof document !== 'undefined') {
        for (let i = 0; i < this.pages().length; i++) {
          const el = document.getElementById(`sign-page-${i}`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (clientY >= r.top && clientY <= r.bottom && clientX >= r.left && clientX <= r.right) {
            targetPageIdx = i;
            break;
          }
        }
      }

      const origPage = this.pages()[st.origField.pageIndex];
      const targetPage = this.pages()[targetPageIdx];
      if (!origPage || !targetPage) return;

      const origScreen = this.transform.pdfRectToScreenRect(st.origField, origPage, z);
      let nextX = origScreen.x + dxPx;
      let nextY = origScreen.y + dyPx;

      if (targetPageIdx !== st.origField.pageIndex && typeof document !== 'undefined') {
        const origEl = document.getElementById(`sign-page-${st.origField.pageIndex}`)?.getBoundingClientRect();
        const targetEl = document.getElementById(`sign-page-${targetPageIdx}`)?.getBoundingClientRect();
        if (origEl && targetEl) {
          nextX = origScreen.x + dxPx + (origEl.left - targetEl.left);
          nextY = origScreen.y + dyPx + (origEl.top - targetEl.top);
        }
      }

      const disp = this.getPageSize(targetPage);
      nextX = Math.max(0, Math.min(disp.width - origScreen.width, nextX));
      nextY = Math.max(0, Math.min(disp.height - origScreen.height, nextY));

      // Smart Guides snapping (margins 36pt, page center, sibling fields)
      const snapped = this.applySmartSnapping(targetPageIdx, nextX, nextY, origScreen.width, origScreen.height, st.field.id);
      const nextPdfRect = this.transform.screenRectToPdfRect(
        { x: snapped.x, y: snapped.y, width: origScreen.width, height: origScreen.height },
        targetPage,
        z
      );

      this.replaceField({
        ...st.origField,
        pageIndex: targetPageIdx,
        ...nextPdfRect
      });
      this.smartGuides.set(new Map(snapped.guides.length > 0 ? [[targetPageIdx, snapped.guides]] : []));
    } else if (st.kind === 'resize' && st.corner) {
      const pageMeta = this.pages()[st.origField.pageIndex];
      if (!pageMeta) return;
      const origScreen = this.transform.pdfRectToScreenRect(st.origField, pageMeta, z);
      const aspectLocked = st.origField.type === 'signature' || st.origField.type === 'initials' || st.origField.type === 'stamp';
      const aspect = origScreen.width / Math.max(1, origScreen.height);

      let { x, y, width, height } = origScreen;
      const c = st.corner;
      if (c.includes('e')) width = Math.max(20, origScreen.width + dxPx);
      if (c.includes('s')) height = Math.max(16, origScreen.height + dyPx);
      if (c.includes('w')) {
        const nw = Math.max(20, origScreen.width - dxPx);
        x = origScreen.x + (origScreen.width - nw);
        width = nw;
      }
      if (c.includes('n')) {
        const nh = Math.max(16, origScreen.height - dyPx);
        y = origScreen.y + (origScreen.height - nh);
        height = nh;
      }

      if (aspectLocked && (c.length === 2 || c === 'e' || c === 'w')) {
        height = Math.max(16, width / aspect);
      } else if (aspectLocked && (c === 'n' || c === 's')) {
        width = Math.max(20, height * aspect);
      }

      const nextPdf = this.transform.screenRectToPdfRect({ x, y, width, height }, pageMeta, z);
      this.replaceField({ ...st.origField, ...nextPdf });
    } else if (st.kind === 'rotate') {
      const rotDelta = Math.round(dxPx * 0.8);
      this.replaceField({
        ...st.origField,
        rotation: ((st.origField.rotation ?? 0) + rotDelta) % 360
      });
    }
  }

  private applySmartSnapping(
    pageIndex: number,
    x: number,
    y: number,
    w: number,
    h: number,
    selfId: string
  ): { x: number; y: number; guides: SmartGuideLine[] } {
    const pageMeta = this.pages()[pageIndex];
    if (!pageMeta) return { x, y, guides: [] };
    const disp = this.getPageSize(pageMeta);
    const marginPx = 36 * this.zoom();
    const threshold = 5;

    const candidatesX = [marginPx, disp.width / 2, disp.width - marginPx];
    const candidatesY = [marginPx, disp.height / 2, disp.height - marginPx];

    for (const sib of this.fields()) {
      if (sib.pageIndex !== pageIndex || sib.id === selfId) continue;
      const r = this.transform.pdfRectToScreenRect(sib, pageMeta, this.zoom());
      candidatesX.push(r.x, r.x + r.width / 2);
      candidatesY.push(r.y, r.y + r.height / 2);
    }

    const guides: SmartGuideLine[] = [];
    let sx = x;
    let sy = y;

    for (const cx of candidatesX) {
      if (Math.abs(x - cx) <= threshold) {
        sx = cx;
        guides.push({ orientation: 'v', posPx: cx });
        break;
      }
      if (Math.abs(x + w / 2 - cx) <= threshold) {
        sx = cx - w / 2;
        guides.push({ orientation: 'v', posPx: cx });
        break;
      }
    }
    for (const cy of candidatesY) {
      if (Math.abs(y - cy) <= threshold) {
        sy = cy;
        guides.push({ orientation: 'h', posPx: cy });
        break;
      }
      if (Math.abs(y + h / 2 - cy) <= threshold) {
        sy = cy - h / 2;
        guides.push({ orientation: 'h', posPx: cy });
        break;
      }
    }

    return { x: sx, y: sy, guides };
  }

  nudgeField(ev: { id: string; dxPx: number; dyPx: number }): void {
    const field = this.fields().find(f => f.id === ev.id);
    if (!field) return;
    const page = this.pages()[field.pageIndex];
    if (!page) return;
    const z = this.zoom();
    const r = this.transform.pdfRectToScreenRect(field, page, z);
    const disp = this.getPageSize(page);
    const nx = Math.max(0, Math.min(disp.width - r.width, r.x + ev.dxPx));
    const ny = Math.max(0, Math.min(disp.height - r.height, r.y + ev.dyPx));
    const nextPdf = this.transform.screenRectToPdfRect({ ...r, x: nx, y: ny }, page, z);
    const before = { ...field };
    const after = { ...field, ...nextPdf };
    this.history.execute({
      description: 'Nudge field',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  removeField(id: string): void {
    const existing = this.fields().find(f => f.id === id);
    if (!existing) return;
    this.history.execute({
      description: 'Remove field',
      execute: () => {
        this.fields.update(list => list.filter(f => f.id !== id));
        if (this.selectedFieldId() === id) this.selectedFieldId.set(null);
      },
      undo: () => this.fields.update(list => [...list, existing])
    });
  }

  duplicateField(id: string): void {
    const src = this.fields().find(f => f.id === id);
    if (!src) return;
    const clone: SignFieldElement = {
      ...src,
      id: `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      xPt: src.xPt + 14,
      yPt: Math.max(10, src.yPt - 14),
      zIndex: (src.zIndex ?? 1) + 1
    };
    this.history.execute({
      description: 'Duplicate field',
      execute: () => {
        this.fields.update(l => [...l, clone]);
        this.selectedFieldId.set(clone.id);
      },
      undo: () => this.fields.update(l => l.filter(f => f.id !== clone.id))
    });
  }

  bringForward(id: string): void {
    const cur = this.fields().find(f => f.id === id);
    if (!cur) return;
    const before = { ...cur };
    const after = { ...cur, zIndex: (cur.zIndex ?? 1) + 1 };
    this.history.execute({
      description: 'Bring field forward',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  sendBackward(id: string): void {
    const cur = this.fields().find(f => f.id === id);
    if (!cur) return;
    const before = { ...cur };
    const after = { ...cur, zIndex: Math.max(0, (cur.zIndex ?? 1) - 1) };
    this.history.execute({
      description: 'Send field backward',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  toggleCheckboxField(id: string): void {
    const cur = this.fields().find(f => f.id === id);
    if (!cur) return;
    const before = { ...cur };
    const after = { ...cur, checked: !(cur.checked !== false) };
    this.history.execute({
      description: 'Toggle checkbox',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  updateSelectedFieldProp(patch: Partial<SignFieldElement>): void {
    const cur = this.selectedField();
    if (!cur) return;
    this.replaceField({ ...cur, ...patch });
  }

  /* =========================================================================
     APPLY TO ALL PAGES / RANGE OF PAGES
     ========================================================================= */

  canApplyToMultiplePages(): boolean {
    const f = this.selectedField();
    return !!f && f.type !== 'signature' && f.type !== 'checkbox' && this.pages().length > 1;
  }

  applySelectedToAllPages(): void {
    const indices = this.pages().map(p => p.pageIndex);
    this.replicateSelectedToPages(indices);
  }

  openApplyToPagesModal(): void {
    this.applyPagesRangeInput.set(`1-${this.pages().length}`);
    this.applyPagesError.set(null);
    this.showApplyPagesModal.set(true);
  }

  confirmApplyToPagesRange(): void {
    const parsed = parsePageRange(this.applyPagesRangeInput(), this.pages().length);
    if (parsed.error) {
      this.applyPagesError.set(parsed.error);
      return;
    }
    this.showApplyPagesModal.set(false);
    this.replicateSelectedToPages(parsed.pages);
  }

  private replicateSelectedToPages(targetPageIndices: number[]): void {
    const src = this.selectedField();
    if (!src) return;
    const srcPage = this.pages()[src.pageIndex];
    if (!srcPage) return;

    // Relative coordinates on source visual page so each copy lands at same relative placement
    const srcScreen = this.transform.pdfRectToScreenRect(src, srcPage, 1.0);
    const srcDisp = this.transform.getPageDisplaySize(srcPage, 1.0);
    const relX = srcScreen.x / Math.max(1, srcDisp.width);
    const relY = srcScreen.y / Math.max(1, srcDisp.height);

    const clones: SignFieldElement[] = [];
    for (const pIdx of targetPageIndices) {
      if (pIdx === src.pageIndex) continue;
      const tPage = this.pages()[pIdx];
      if (!tPage) continue;
      const tDisp = this.transform.getPageDisplaySize(tPage, 1.0);
      const tRect = this.transform.screenRectToPdfRect(
        {
          x: relX * tDisp.width,
          y: relY * tDisp.height,
          width: srcScreen.width,
          height: srcScreen.height
        },
        tPage,
        1.0
      );
      clones.push({
        ...src,
        id: `sf-${Date.now()}-${pIdx}-${Math.random().toString(36).slice(2, 6)}`,
        pageIndex: pIdx,
        ...tRect
      });
    }
    if (clones.length === 0) return;
    const addedIds = new Set(clones.map(c => c.id));
    this.history.execute({
      description: `Apply ${src.type} to ${clones.length} pages`,
      execute: () => this.fields.update(list => [...list, ...clones]),
      undo: () => this.fields.update(list => list.filter(f => !addedIds.has(f.id)))
    });
    this.announce(`Applied ${src.type} to ${clones.length} additional page(s).`);
  }

  /* =========================================================================
     DIALOG CALLBACKS & GLOBAL PREFERENCES
     ========================================================================= */

  openEditSignature(field: SignFieldElement): void {
    this.editingSignatureField.set(field);
    this.signatureDialogKind.set(field.type === 'initials' ? 'initials' : 'signature');
  }

  closeSignatureDialog(): void {
    this.signatureDialogKind.set(null);
    this.editingSignatureField.set(null);
  }

  onSignatureApplied(res: SignatureApplyResult): void {
    const kind = this.signatureDialogKind() || 'signature';
    const target = this.editingSignatureField();
    this.signatureDialogKind.set(null);
    this.editingSignatureField.set(null);

    if (target) {
      const before = { ...target };
      const after: SignFieldElement = {
        ...target,
        imageDataUrl: res.imageDataUrl,
        color: res.color,
        ...(res.text ? { text: res.text } : {})
      };
      this.history.execute({
        description: `Update ${target.type}`,
        execute: () => {
          this.fields.update(list => list.map(f => (f.id === target.id ? after : f)));
        },
        undo: () => {
          this.fields.update(list => list.map(f => (f.id === target.id ? before : f)));
        }
      });
      this.announce(`Updated ${target.type}.`);
      return;
    }

    if (kind === 'signature') {
      this.signatureDataUrl.set(res.imageDataUrl);
      this.signatureColor.set(res.color);
      if (res.text && !this.fullName().trim()) {
        this.fullName.set(res.text);
      }
      // Update any existing signature fields if empty
      this.fields.update(list =>
        list.map(f => (f.type === 'signature' && !f.imageDataUrl ? { ...f, imageDataUrl: res.imageDataUrl } : f))
      );
    } else {
      this.initialsDataUrl.set(res.imageDataUrl);
    }

    if (this.pendingSignatureInsertType === kind) {
      this.pendingSignatureInsertType = null;
      this.armedToolType.set(kind);
      this.announce(`${kind} ready. Click a page or press Enter on the tile to place.`);
    }
  }

  onStampApplied(res: StampApplyResult): void {
    this.showStampDialog.set(false);
    const target = this.editingStampField();
    const isDefault = this.isEditingDefaultStamp();
    this.editingStampField.set(null);
    this.isEditingDefaultStamp.set(false);

    if (isDefault) {
      this.stampDataUrl.set(res.imageDataUrl);
      this.stampSource.set(res.source);
      this.announce('Default company stamp updated.');
      return;
    }

    if (target) {
      const scope = res.scope || 'all';
      if (scope === 'all' && target.templateId) {
        const tId = target.templateId;
        const matching = this.fields().filter(f => f.templateId === tId);
        const beforeList = [...this.fields()];
        const afterList = this.fields().map(f => {
          if (f.templateId === tId) {
            return {
              ...f,
              imageDataUrl: res.imageDataUrl,
              stampSource: res.source
            };
          }
          return f;
        });
        this.history.execute({
          description: `Update all ${matching.length} stamp copies`,
          execute: () => this.fields.set(afterList),
          undo: () => this.fields.set(beforeList)
        });
        this.announce(`Updated ${matching.length} stamp copies.`);
      } else {
        const before = { ...target };
        const after: SignFieldElement = {
          ...target,
          imageDataUrl: res.imageDataUrl,
          stampSource: res.source
        };
        this.history.execute({
          description: 'Update company stamp',
          execute: () => this.replaceField(after),
          undo: () => this.replaceField(before)
        });
        this.announce('Company stamp updated.');
      }
      return;
    }

    this.stampDataUrl.set(res.imageDataUrl);
    this.stampSource.set(res.source);
    this.activeStampTemplateId = `stamp-tmpl-${Date.now()}`;
    if (this.pendingSignatureInsertType === 'stamp') {
      this.pendingSignatureInsertType = null;
      this.armedToolType.set('stamp');
      this.announce('Company stamp ready. Click a page to place.');
    }
  }

  openEditStamp(field: SignFieldElement): void {
    this.editingStampField.set(field);
    this.isEditingDefaultStamp.set(false);
    this.showStampDialog.set(true);
  }

  openDefaultStampEdit(): void {
    this.editingStampField.set(null);
    this.isEditingDefaultStamp.set(true);
    this.showStampDialog.set(true);
  }

  onFieldTextChanged(payload: { id: string; content: string }): void {
    const cur = this.fields().find(f => f.id === payload.id);
    if (!cur) return;
    if (!payload.content || payload.content.trim() === '') {
      this.removeField(payload.id);
      return;
    }
    const before = { ...cur };
    const after: SignFieldElement = {
      ...cur,
      text: payload.content,
      textConfig: {
        ...(cur.textConfig || {
          fontSize: cur.fontSizePt || 14,
          color: cur.color || '#14213D',
          align: 'left',
          lineHeight: 1.25,
          opacity: 1,
          autoGrow: true,
          boxWidth: cur.widthPt
        }),
        content: payload.content
      }
    };
    this.history.execute({
      description: 'Edit text',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  onFieldLabelChanged(payload: { id: string; content: string }): void {
    const cur = this.fields().find(f => f.id === payload.id);
    if (!cur) return;
    const before = { ...cur };
    const after: SignFieldElement = {
      ...cur,
      checkboxConfig: {
        ...(cur.checkboxConfig || {
          checked: cur.checked !== false,
          mark: 'tick',
          boxSize: 18,
          labelPosition: 'right'
        }),
        label: {
          ...(cur.checkboxConfig?.label || {
            fontSize: 12,
            color: '#14213D'
          }),
          content: payload.content
        }
      }
    };
    this.history.execute({
      description: 'Edit checkbox label',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  onAddCheckboxOption(fieldId: string): void {
    const cur = this.fields().find(f => f.id === fieldId);
    if (!cur) return;
    const pageMeta = this.pages()[cur.pageIndex];
    if (!pageMeta) return;

    const spacingPt = 8;
    const nextYPt = cur.yPt - cur.heightPt - spacingPt;
    const newId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newField: SignFieldElement = {
      ...cur,
      id: newId,
      yPt: Math.max(10, nextYPt),
      zIndex: (cur.zIndex ?? 1) + 1,
      checkboxConfig: {
        ...cur.checkboxConfig!,
        checked: false,
        label: {
          ...cur.checkboxConfig?.label,
          content: ''
        }
      }
    };

    this.history.execute({
      description: 'Add checkbox option',
      execute: () => {
        this.fields.update(list => [...list, newField]);
        this.selectedFieldId.set(newId);
        this.newlyPlacedFieldId.set(newId);
      },
      undo: () => {
        this.fields.update(list => list.filter(f => f.id !== newId));
        if (this.selectedFieldId() === newId) this.selectedFieldId.set(cur.id);
      }
    });
    this.announce('Checkbox option added.');
  }

  updateSelectedTextProp(patch: Partial<SignTextConfig>): void {
    const cur = this.selectedField();
    if (!cur || cur.type !== 'text') return;
    const currentCfg = cur.textConfig || {
      content: cur.text || '',
      fontSize: cur.fontSizePt || 14,
      color: cur.color || '#14213D',
      align: 'left',
      lineHeight: 1.25,
      opacity: 1,
      autoGrow: true,
      boxWidth: cur.widthPt
    };
    const nextCfg: SignTextConfig = { ...currentCfg, ...patch };
    const before = { ...cur };
    const after: SignFieldElement = {
      ...cur,
      textConfig: nextCfg,
      text: nextCfg.content,
      fontSizePt: nextCfg.fontSize,
      color: nextCfg.color,
      fontId: nextCfg.fontFamily || cur.fontId
    };
    this.history.execute({
      description: 'Format text field',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  updateSelectedCheckboxProp(patch: Partial<SignCheckboxConfig>): void {
    const cur = this.selectedField();
    if (!cur || cur.type !== 'checkbox') return;
    const currentCfg = cur.checkboxConfig || {
      checked: cur.checked !== false,
      mark: 'tick',
      boxSize: 18,
      labelPosition: 'right'
    };
    const nextCfg: SignCheckboxConfig = { ...currentCfg, ...patch };
    const before = { ...cur };
    const after: SignFieldElement = {
      ...cur,
      checkboxConfig: nextCfg,
      checked: nextCfg.checked
    };
    this.history.execute({
      description: 'Format checkbox',
      execute: () => this.replaceField(after),
      undo: () => this.replaceField(before)
    });
  }

  getFieldPlacedCount(type: SignFieldType): number {
    return this.fields().filter(f => f.type === type).length;
  }

  onFullNameChange(name: string): void {
    this.fullName.set(name);
    if (this.rememberName()) {
      this.storageService.setRememberedSignerName(name);
    }
  }

  onRememberNameToggle(checked: boolean): void {
    this.rememberName.set(checked);
    if (checked) {
      this.storageService.setRememberedSignerName(this.fullName());
    } else {
      this.storageService.forgetSignerName();
    }
  }

  onCanvasEditDate(field: SignFieldElement): void {
    this.selectedFieldId.set(field.id);
    this.announce(`Selected date field on page ${field.pageIndex + 1}. Customize in the sidebar.`);
  }

  openDateSettings(): void {
    this.detailsExpanded.set(true);
    const cur = this.selectedField();
    if (!cur || cur.type !== 'date') {
      const firstDateField = this.fields().find(f => f.type === 'date');
      if (firstDateField) {
        this.selectedFieldId.set(firstDateField.id);
      }
    }
    this.announce('Date settings opened.');
  }

  updateSelectedDateFormat(fmt: SignDateFormat): void {
    const sel = this.selectedField();
    if (!sel || sel.type !== 'date') return;
    const formatted = formatSigningDate(new Date(), fmt);
    const before = { ...sel };
    const after: SignFieldElement = {
      ...sel,
      dateFormat: fmt,
      text: formatted
    };
    this.history.execute({
      description: 'Update date format',
      execute: () => {
        this.fields.update(list => list.map(f => (f.id === sel.id ? after : f)));
      },
      undo: () => {
        this.fields.update(list => list.map(f => (f.id === sel.id ? before : f)));
      }
    });
    this.announce(`Updated date format to ${fmt}.`);
  }

  setSelectedDateToToday(sel: SignFieldElement): void {
    const fmt = sel.dateFormat || this.dateFormat();
    const formatted = formatSigningDate(new Date(), fmt);
    const before = { ...sel };
    const after: SignFieldElement = {
      ...sel,
      text: formatted
    };
    this.history.execute({
      description: 'Set date to today',
      execute: () => {
        this.fields.update(list => list.map(f => (f.id === sel.id ? after : f)));
      },
      undo: () => {
        this.fields.update(list => list.map(f => (f.id === sel.id ? before : f)));
      }
    });
    this.announce(`Set date to today (${formatted}).`);
  }

  toggleFieldSigningDetails(sel: SignFieldElement, event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;
    const who = (this.fullName() || 'Signer').trim();
    const when = this.customDateValue() || formatSigningDate(new Date(), this.dateFormat());
    const before = { ...sel };
    const after: SignFieldElement = {
      ...sel,
      showSigningDetailsLine: checked,
      signingDetailsText: checked ? `Signed by ${who} · ${when}` : undefined
    };
    this.history.execute({
      description: 'Toggle signing details',
      execute: () => {
        this.fields.update(list => list.map(f => (f.id === sel.id ? after : f)));
      },
      undo: () => {
        this.fields.update(list => list.map(f => (f.id === sel.id ? before : f)));
      }
    });
  }

  onDateFormatChange(fmt: SignDateFormat): void {
    this.dateFormat.set(fmt);
    const formatted = formatSigningDate(new Date(), fmt);
    this.customDateValue.set(formatted);
    this.fields.update(list =>
      list.map(f => (f.type === 'date' ? { ...f, dateFormat: fmt, text: formatted } : f))
    );
  }

  onAddSigningDetailsToggle(checked: boolean): void {
    this.addSigningDetails.set(checked);
    const who = (this.fullName() || 'Signer').trim();
    const when = this.customDateValue() || formatSigningDate(new Date(), this.dateFormat());
    this.fields.update(list =>
      list.map(f =>
        f.type === 'signature'
          ? {
              ...f,
              showSigningDetailsLine: checked,
              signingDetailsText: checked ? `Signed by ${who} · ${when}` : undefined
            }
          : f
      )
    );
  }

  /* =========================================================================
     SIGN MODE, CERTIFICATES & MULTI-SIGNER RECIPIENTS
     ========================================================================= */

  setWhoSigns(mode: SignModeChoice): void {
    this.whoSigns.set(mode);
    this.errorMessage.set(null);
    if (mode === 'several_people') {
      if (this.signType() === 'digital_certificate') {
        this.signType.set('simple');
      }
      const firstId = this.signers()[0]?.id || 'signer-1';
      if (!this.signers().some(s => s.id === this.activeSignerId())) {
        this.activeSignerId.set(firstId);
      }
      // Assign any unassigned placed fields to the active recipient
      const fallbackId = this.activeSignerId();
      this.fields.update(list => list.map(f => (f.signerId ? f : { ...f, signerId: fallbackId })));
      this.announce('Multi-signer request mode selected. Assign fields to recipients.');
    } else {
      this.announce('Only me mode selected. Signing stays on your device.');
    }
  }

  setSignType(type: SignTypeChoice): void {
    this.signType.set(type);
    this.errorMessage.set(null);
    if (type === 'digital_certificate' && this.whoSigns() === 'several_people') {
      this.whoSigns.set('only_me');
      this.announce('Switched to Only me for digital certificate signing.');
    }
  }

  onCertificateFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0] || null;
    if (input) input.value = '';
    if (!file) return;
    if (!/\.(p12|pfx)$/i.test(file.name)) {
      this.errorMessage.set('Please select a valid PKCS#12 certificate file (.p12 or .pfx).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage.set('Certificate file exceeds 5 MB maximum size.');
      return;
    }
    this.errorMessage.set(null);
    this.certFile.set(file);
  }

  clearCertificateFile(): void {
    this.certFile.set(null);
    this.certPassword.set('');
  }

  addRecipient(): void {
    const cur = this.signers();
    if (cur.length >= SIGN_PDF_LIMITS.maxSigners) return;
    const idx = cur.length;
    const next: SignerDraft = {
      id: `signer-${Date.now().toString(36)}-${idx + 1}`,
      name: `Signer ${idx + 1}`,
      email: '',
      orderIndex: idx,
      color: SIGNER_CHIP_COLORS[idx % SIGNER_CHIP_COLORS.length]
    };
    this.signers.set([...cur, next]);
    this.activeSignerId.set(next.id);
  }

  removeRecipient(id: string): void {
    const cur = this.signers();
    if (cur.length <= 1) return;
    const filtered = cur.filter(s => s.id !== id).map((s, i) => ({ ...s, orderIndex: i }));
    this.signers.set(filtered);
    const fallbackId = filtered[0].id;
    if (this.activeSignerId() === id) {
      this.activeSignerId.set(fallbackId);
    }
    this.fields.update(list => list.map(f => (f.signerId === id ? { ...f, signerId: fallbackId } : f)));
  }

  updateRecipient(id: string, patch: Partial<Pick<SignerDraft, 'name' | 'email'>>): void {
    this.signers.update(list => list.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  moveRecipient(id: string, delta: -1 | 1): void {
    const cur = [...this.signers()];
    const idx = cur.findIndex(s => s.id === id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= cur.length) return;
    const [moved] = cur.splice(idx, 1);
    cur.splice(target, 0, moved);
    this.signers.set(cur.map((s, i) => ({ ...s, orderIndex: i })));
  }

  getFieldAssigneeName(field: SignFieldElement): string {
    if (this.whoSigns() !== 'several_people' || !field.signerId) return '';
    return this.signers().find(s => s.id === field.signerId)?.name || '';
  }

  getFieldAssigneeColor(field: SignFieldElement): string | null {
    if (this.whoSigns() !== 'several_people' || !field.signerId) return null;
    return this.signers().find(s => s.id === field.signerId)?.color || null;
  }

  getFieldAccentColor(field: SignFieldElement): string {
    return this.getFieldAssigneeColor(field) || 'var(--pt-teal-700)';
  }

  /* =========================================================================
     SIGN & EXPORT FLOW (RUN-ID GUARD, CANCEL, WARNINGS)
     ========================================================================= */

  async executeSign(): Promise<void> {
    if (!this.canSign() || !this.rawPdfBytes || !this.selectedFile()) return;
    this.errorMessage.set(null);

    if (this.whoSigns() === 'several_people') {
      this.openSendRequestModal();
      return;
    }

    if (this.signType() === 'digital_certificate') {
      await this.executeCertificateSign();
      return;
    }

    this.isProcessing.set(true);
    this.stage.set('processing');

    const myRunId = ++this.runCounter;
    const abortCtrl = new AbortController();
    this.abortController = abortCtrl;

    try {
      const warningsPrefix = this.collectDocumentWarnings();
      const outcome = await this.signExport.exportSignedDocument({
        originalBytes: this.rawPdfBytes,
        originalFilename: this.selectedFile()!.name,
        pageCount: this.pages().length,
        fields: this.fields(),
        flattenFormFields: this.flattenFormFields(),
        warningsPrefix
      });

      if (myRunId !== this.runCounter || abortCtrl.signal.aborted) {
        URL.revokeObjectURL(outcome.url);
        return;
      }

      this.revokeExportUrl();
      this.exportOutcome.set(outcome);
      this.isProcessing.set(false);
      this.stage.set('completed');
      this.layoutService.showFooter();
    } catch (err: any) {
      if (myRunId !== this.runCounter || abortCtrl.signal.aborted) return;
      this.isProcessing.set(false);
      this.stage.set('editor');
      this.errorMessage.set(err?.message || 'Signing failed. Your placed fields are preserved.');
    }
  }

  private async executeCertificateSign(): Promise<void> {
    const file = this.certFile();
    if (!file || !this.rawPdfBytes || !this.selectedFile()) {
      this.errorMessage.set('Select a .p12 or .pfx certificate file first.');
      return;
    }

    this.isProcessing.set(true);
    this.stage.set('processing');

    const myRunId = ++this.runCounter;
    const abortCtrl = new AbortController();
    this.abortController = abortCtrl;
    const warningsPrefix = this.collectDocumentWarnings();

    try {
      const certBytes = new Uint8Array(await file.arrayBuffer());
      const outcome = await this.signExport.exportWithBrowserCertificate({
        originalBytes: this.rawPdfBytes,
        originalFilename: this.selectedFile()!.name,
        pageCount: this.pages().length,
        fields: this.fields(),
        flattenFormFields: this.flattenFormFields(),
        certBytes,
        password: this.certPassword(),
        reason: this.certReason(),
        location: this.certLocation(),
        warningsPrefix
      });

      if (myRunId !== this.runCounter || abortCtrl.signal.aborted) {
        URL.revokeObjectURL(outcome.url);
        return;
      }

      this.revokeExportUrl();
      this.exportOutcome.set(outcome);
      this.isProcessing.set(false);
      this.stage.set('completed');
      this.layoutService.showFooter();
    } catch (err: any) {
      if (myRunId !== this.runCounter || abortCtrl.signal.aborted) return;

      if (err instanceof UnsupportedPkcs12CipherError) {
        const consented = await this.uploadConsent.ask({
          title: 'Consent for Legacy Certificate Signing',
          actionId: 'sign_pdf_cert_legacy',
          pageCountDescription: `${this.pages().length}-page PDF + legacy .p12 certificate`,
          purposeDescription:
            'Your certificate uses legacy 3DES/RC2 encryption that browser WebCrypto cannot open. PDFTailor can run OpenSSL certificate signing transiently on the server.',
          retentionDescription:
            'Your PDF, certificate, and passphrase exist only in memory during signing and are deleted immediately afterward.',
          confirmText: 'Consent & Sign Certificate',
          cancelText: 'Cancel'
        });

        if (!consented) {
          this.isProcessing.set(false);
          this.stage.set('editor');
          this.errorMessage.set('Legacy certificate signing was cancelled. Your placed fields are preserved.');
          return;
        }

        try {
          let bytesForOpenSsl = this.rawPdfBytes!;
          let fieldsApplied = 0;
          let pagesSigned: number[] = [];
          const warnings = [...warningsPrefix];

          if (this.fields().length > 0) {
            const visual = await this.signExport.exportSignedDocument({
              originalBytes: this.rawPdfBytes!,
              originalFilename: this.selectedFile()!.name,
              pageCount: this.pages().length,
              fields: this.fields(),
              flattenFormFields: this.flattenFormFields()
            });
            URL.revokeObjectURL(visual.url);
            bytesForOpenSsl = new Uint8Array(await visual.blob.arrayBuffer());
            fieldsApplied = visual.fieldsApplied;
            pagesSigned = visual.pagesSigned;
            warnings.push(...visual.warnings);
          }

          const remote = await this.signRequestApi.signWithCertificateOnServer(
            bytesForOpenSsl,
            this.selectedFile()!.name,
            file,
            this.certPassword(),
            this.certReason(),
            this.certLocation(),
            abortCtrl.signal
          );

          if (myRunId !== this.runCounter || abortCtrl.signal.aborted) return;

          const outcome = this.signExport.createOutcomeFromBlob(remote.blob, {
            originalFilename: this.selectedFile()!.name,
            pageCount: this.pages().length,
            fieldsApplied,
            pagesSigned,
            warnings,
            certificateSubject: remote.signerCn,
            certificateIssuer: remote.issuerCn,
            signedMode: 'server_openssl'
          });

          this.revokeExportUrl();
          this.exportOutcome.set(outcome);
          this.isProcessing.set(false);
          this.stage.set('completed');
          this.layoutService.showFooter();
          return;
        } catch (srvErr: any) {
          if (myRunId !== this.runCounter || abortCtrl.signal.aborted) return;
          this.isProcessing.set(false);
          this.stage.set('editor');
          this.errorMessage.set(srvErr?.message || 'Certificate signing failed. Your placed fields are preserved.');
          return;
        }
      }

      this.isProcessing.set(false);
      this.stage.set('editor');
      this.errorMessage.set(err?.message || 'Certificate signing failed. Check your password and certificate file.');
    }
  }

  private collectDocumentWarnings(): string[] {
    const warningsPrefix: string[] = [];
    if (this.invalidatedExistingSigConfirmed()) {
      warningsPrefix.push('Original digital signatures were invalidated when re-saving the PDF with new signature changes.');
    }
    if (this.wasEncryptedOnLoad()) {
      warningsPrefix.push('Signed output copy is not password-protected because browser export removes original PDF encryption.');
    }
    return warningsPrefix;
  }

  openSendRequestModal(): void {
    if (!this.requestTitle().trim() && this.selectedFile()) {
      this.requestTitle.set(this.selectedFile()!.name.replace(/\.pdf$/i, ''));
    }
    this.sendModalError.set(null);
    this.showSendRequestModal.set(true);
  }

  async sendSenderOtp(): Promise<void> {
    const email = this.senderEmail().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.sendModalError.set('Enter a valid sender email before verifying.');
      return;
    }
    this.sendModalError.set(null);
    this.senderOtpBusy.set(true);
    try {
      const res = await this.signRequestApi.startSenderOtp(email);
      this.senderOtpSent.set(true);
      this.senderDevOtpHint.set(res._devOtpCode || null);
    } catch (err: any) {
      this.sendModalError.set(err?.message || 'Could not send verification code.');
    } finally {
      this.senderOtpBusy.set(false);
    }
  }

  async confirmSenderOtp(): Promise<void> {
    const email = this.senderEmail().trim();
    const code = this.senderOtpCode().trim();
    if (code.length !== 6) {
      this.sendModalError.set('Enter the 6-digit verification code.');
      return;
    }
    this.sendModalError.set(null);
    this.senderOtpBusy.set(true);
    try {
      const res = await this.signRequestApi.verifySenderOtp(email, code);
      this.senderOtpVerified.set(res.verified);
      this.senderDevOtpHint.set(null);
    } catch (err: any) {
      this.sendModalError.set(err?.message || 'Verification failed.');
    } finally {
      this.senderOtpBusy.set(false);
    }
  }

  async submitSendRequest(): Promise<void> {
    const senderName = (this.fullName() || 'Sender').trim();
    const senderEmail = this.senderEmail().trim();
    const title = (this.requestTitle() || this.selectedFile()?.name || 'Signature Request').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      this.sendModalError.set('Enter a valid sender email address.');
      return;
    }
    if (!this.validSignersReady()) {
      this.sendModalError.set('Every recipient must have a unique name and valid email.');
      return;
    }
    if (!this.rawPdfBytes || !this.selectedFile()) return;

    this.sendModalError.set(null);
    const consented = await this.uploadConsent.ask({
      title: 'Consent to Upload & Send Request',
      actionId: 'sign_pdf_request',
      pageCountDescription: `${this.pages().length}-page PDF to ${this.signers().length} recipient(s)`,
      purposeDescription:
        'Multi-signer requests encrypt your PDF and field assignments on the signing server so each recipient can open their private signing link.',
      retentionDescription: `Requests expire automatically after ${this.expiryDays()} day(s) and can be cancelled anytime.`,
      confirmText: 'Encrypt & Send Request',
      cancelText: 'Cancel'
    });
    if (!consented) return;

    this.showSendRequestModal.set(false);
    this.isProcessing.set(true);
    this.stage.set('processing');

    const myRunId = ++this.runCounter;
    const abortCtrl = new AbortController();
    this.abortController = abortCtrl;

    try {
      const fallbackSignerId = this.signers()[0].id;
      const payload: CreateSignRequestInput = {
        senderName,
        senderEmail,
        title,
        message: this.requestMessage().trim(),
        order: this.signingOrder(),
        expiryDays: Math.max(SIGN_PDF_LIMITS.minExpiryDays, Math.min(SIGN_PDF_LIMITS.maxExpiryDays, Number(this.expiryDays()) || SIGN_PDF_LIMITS.defaultExpiryDays)),
        remindersEnabled: this.remindersEnabled(),
        requireSignerOtp: this.requireSignerOtp(),
        signers: this.signers().map((s, idx) => ({
          ...s,
          name: s.name.trim(),
          email: s.email.trim(),
          orderIndex: idx
        })),
        fields: this.fields().map(f => ({
          ...f,
          signerId: f.signerId || fallbackSignerId
        }))
      };

      const created = await this.signRequestApi.createRequest(
        this.rawPdfBytes,
        this.selectedFile()!.name,
        payload,
        abortCtrl.signal
      );

      if (myRunId !== this.runCounter || abortCtrl.signal.aborted) return;

      const statusView = await this.signRequestApi.getRequestStatus(
        created.requestId,
        created.senderAccessToken,
        abortCtrl.signal
      );

      if (myRunId !== this.runCounter || abortCtrl.signal.aborted) return;

      this.sentResult.set(created);
      this.sentStatus.set(statusView);
      this.trackerNotice.set(null);
      this.isProcessing.set(false);
      this.stage.set('sent');
      this.layoutService.showFooter();
    } catch (err: any) {
      if (myRunId !== this.runCounter || abortCtrl.signal.aborted) return;
      this.isProcessing.set(false);
      this.stage.set('editor');
      this.errorMessage.set(err?.message || 'Failed to create signature request.');
    }
  }

  async refreshSentStatus(): Promise<void> {
    const res = this.sentResult();
    if (!res) return;
    this.trackerBusy.set(true);
    this.errorMessage.set(null);
    try {
      const view = await this.signRequestApi.getRequestStatus(res.requestId, res.senderAccessToken);
      this.sentStatus.set(view);
      this.trackerNotice.set('Status refreshed.');
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Could not refresh status.');
    } finally {
      this.trackerBusy.set(false);
    }
  }

  updateResendEmailOverride(signerId: string, value: string): void {
    this.resendEmailOverrides.update(m => ({ ...m, [signerId]: value }));
  }

  async resendInvitation(signerId: string): Promise<void> {
    const res = this.sentResult();
    if (!res) return;
    const override = this.resendEmailOverrides()[signerId]?.trim();
    this.trackerBusy.set(true);
    this.errorMessage.set(null);
    try {
      const out = await this.signRequestApi.resendSigner(
        res.requestId,
        res.senderAccessToken,
        signerId,
        override || undefined
      );
      if (out.devSigningUrl) {
        this.sentResult.update(cur =>
          cur
            ? {
                ...cur,
                devSigningLinks: { ...(cur.devSigningLinks || {}), [signerId]: out.devSigningUrl! }
              }
            : cur
        );
      }
      await this.refreshSentStatus();
      this.trackerNotice.set(`Invitation resent to ${out.email}.`);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Could not resend invitation.');
    } finally {
      this.trackerBusy.set(false);
    }
  }

  async cancelSentRequest(): Promise<void> {
    const res = this.sentResult();
    if (!res) return;
    this.trackerBusy.set(true);
    this.errorMessage.set(null);
    try {
      await this.signRequestApi.cancelRequest(res.requestId, res.senderAccessToken);
      const view = await this.signRequestApi.getRequestStatus(res.requestId, res.senderAccessToken);
      this.sentStatus.set(view);
      this.trackerNotice.set('Signature request cancelled.');
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Could not cancel request.');
    } finally {
      this.trackerBusy.set(false);
    }
  }

  async downloadSentFinalPdf(): Promise<void> {
    const res = this.sentResult();
    if (!res) return;
    this.trackerBusy.set(true);
    try {
      const blob = await this.signRequestApi.downloadFinalPdf(res.requestId, res.senderAccessToken);
      this.triggerBlobDownload(blob, `${(this.sentStatus()?.title || 'signed-document').replace(/[^\w.-]+/g, '_')}-signed.pdf`);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Could not download final PDF.');
    } finally {
      this.trackerBusy.set(false);
    }
  }

  async downloadSentCertificatePdf(): Promise<void> {
    const res = this.sentResult();
    if (!res) return;
    this.trackerBusy.set(true);
    try {
      const blob = await this.signRequestApi.downloadCertificatePdf(res.requestId, res.senderAccessToken);
      this.triggerBlobDownload(blob, `${(this.sentStatus()?.title || 'certificate').replace(/[^\w.-]+/g, '_')}-certificate.pdf`);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Could not download audit certificate.');
    } finally {
      this.trackerBusy.set(false);
    }
  }

  async copyDevSigningLink(signerId: string, url: string): Promise<void> {
    const fullUrl = typeof window !== 'undefined' && url.startsWith('/') ? `${window.location.origin}${url}` : url;
    try {
      await navigator?.clipboard?.writeText(fullUrl);
      this.copiedLinkSignerId.set(signerId);
      setTimeout(() => {
        if (this.copiedLinkSignerId() === signerId) this.copiedLinkSignerId.set(null);
      }, 2000);
    } catch {
      this.trackerNotice.set(`Signing URL: ${fullUrl}`);
    }
  }

  private triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  cancelSigning(): void {
    this.runCounter++;
    this.abortController?.abort();
    this.abortController = null;
    this.isProcessing.set(false);
    this.stage.set('editor');
  }

  backToEditorFromResult(): void {
    this.stage.set('editor');
    this.layoutService.hideFooter();
    setTimeout(() => void this.renderVisibleWindow(), 30);
  }

  resetAll(): void {
    this.runCounter++;
    this.abortController?.abort();
    this.cleanupResources();
    this.selectedFile.set(null);
    this.rawPdfBytes = null;
    this.pages.set([]);
    this.fields.set([]);
    this.history.clear();
    this.selectedFieldId.set(null);
    this.armedToolType.set(null);
    this.inspectionSummary.set(null);
    this.wasEncryptedOnLoad.set(false);
    this.invalidatedExistingSigConfirmed.set(false);
    this.certFile.set(null);
    this.certPassword.set('');
    this.showCertPassword.set(false);
    this.sentResult.set(null);
    this.sentStatus.set(null);
    this.showSendRequestModal.set(false);
    this.senderOtpSent.set(false);
    this.senderOtpCode.set('');
    this.senderOtpVerified.set(false);
    this.senderDevOtpHint.set(null);
    this.trackerNotice.set(null);
    this.resendEmailOverrides.set({});
    this.exportOutcome.set(null);
    this.isProcessing.set(false);
    this.errorMessage.set(null);
    this.stage.set('upload');
    this.layoutService.showFooter();
  }

  /* =========================================================================
     GLOBAL KEYBOARD SHORTCUTS (UNDO/REDO/ESC)
     ========================================================================= */

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent): void {
    if (this.stage() !== 'editor') return;
    if (this.signatureDialogKind() || this.showStampDialog() || this.showApplyPagesModal() || this.showPasswordModal() || this.showExistingSigConfirmModal() || this.showSendRequestModal()) {
      return;
    }

    const active = document.activeElement;
    const isInputFocused = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
    if (isInputFocused) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.history.redo();
      else this.history.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.history.redo();
      return;
    }
    if (event.key === 'Escape') {
      this.armedToolType.set(null);
      this.ghostCursor.set(null);
      this.selectedFieldId.set(null);
    }
  }

  // Helper used by Phase 2 tests / UI when enabled
  buildPhase2PayloadPreview(): CreateSignRequestInput | null {
    if (this.whoSigns() !== 'several_people') return null;
    return {
      senderName: this.fullName() || 'Sender',
      senderEmail: this.senderEmail().trim() || 'sender@example.com',
      title: this.requestTitle().trim() || this.selectedFile()?.name || 'Document',
      message: this.requestMessage().trim(),
      order: this.signingOrder(),
      expiryDays: this.expiryDays() || SIGN_PDF_LIMITS.defaultExpiryDays,
      remindersEnabled: this.remindersEnabled(),
      requireSignerOtp: this.requireSignerOtp(),
      signers: this.signers(),
      fields: this.fields()
    };
  }

  private replaceField(next: SignFieldElement): void {
    this.fields.update(list => list.map(f => (f.id === next.id ? next : f)));
  }

  private announce(msg: string): void {
    this.liveAnnouncement.set('');
    setTimeout(() => this.liveAnnouncement.set(msg), 10);
  }

  private revokeThumbnailUrls(): void {
    for (const url of this.thumbnails().values()) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  }

  private revokeExportUrl(): void {
    const out = this.exportOutcome();
    if (out?.url) URL.revokeObjectURL(out.url);
  }

  private cleanupPdfDocOnly(): void {
    this.cancelAllRenderTasks();
    for (const c of this.renderedPagesCache.values()) {
      c.width = 0;
      c.height = 0;
    }
    this.renderedPagesCache.clear();
    this.revokeThumbnailUrls();
    this.thumbnails.set(new Map());
    if (this.pdfDocProxy) {
      void this.pdfjs.destroyDocument(this.pdfDocProxy);
      this.pdfDocProxy = null;
    }
  }

  private cleanupResources(): void {
    this.cleanupPdfDocOnly();
    this.revokeExportUrl();
  }
}
