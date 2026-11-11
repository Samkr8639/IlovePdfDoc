import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import {
  formatSigningDate,
  getDefaultDateFormatForLocale,
  PdfPageBoxMetrics,
  SignFieldElement
} from '@paperflow/contracts';
import { SharedPdfjsService } from '../../core/services/shared-pdfjs.service';
import { CoordinateTransformService } from '../edit-pdf/services/coordinate-transform';
import {
  SignRequestService,
  SignerSessionPayload
} from '../../core/services/sign-pdf/sign-request.service';
import {
  SignSignatureDialogComponent,
  SignatureApplyResult
} from '../sign-pdf/components/signature-dialog/signature-dialog.component';

type SignerRouteState = 'loading' | 'disabled' | 'waiting_turn' | 'ready' | 'completed' | 'declined' | 'error';

@Component({
  selector: 'app-sign-request',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SignSignatureDialogComponent],
  templateUrl: './sign-request.component.html',
  styleUrl: './sign-request.component.css'
})
export class SignRequestComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly titleService = inject(Title);
  private readonly pdfjs = inject(SharedPdfjsService);
  private readonly transform = inject(CoordinateTransformService);
  private readonly api = inject(SignRequestService);

  readonly routeState = signal<SignerRouteState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly session = signal<SignerSessionPayload | null>(null);
  readonly fields = signal<SignFieldElement[]>([]);
  readonly activeFieldId = signal<string | null>(null);
  readonly consentGiven = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  readonly showSignatureDialogForFieldId = signal<string | null>(null);
  readonly showDeclineModal = signal<boolean>(false);
  readonly declineReason = signal<string>('');
  readonly completionMessage = signal<string>('');
  readonly completionSha256 = signal<string | null>(null);

  readonly totalFieldCount = computed(() => this.fields().length);
  readonly completedFieldCount = computed(() =>
    this.fields().filter((f) => this.isFieldFilled(f)).length
  );
  readonly requiredIncompleteCount = computed(() =>
    this.fields().filter((f) => (f.required ?? f.type === 'signature') && !this.isFieldFilled(f)).length
  );
  readonly canFinish = computed(() =>
    this.routeState() === 'ready' &&
    this.requiredIncompleteCount() === 0 &&
    this.consentGiven() &&
    !this.isSubmitting()
  );

  private token = '';
  private abortController: AbortController | null = null;
  private pdfDocProxy: any = null;
  private renderedCanvases = new Map<number, HTMLCanvasElement>();

  async ngOnInit(): Promise<void> {
    this.titleService.setTitle('Review & Sign Document | PDFTailor');
    // Strictly prevent search-engine indexing of secret signer URLs
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.errorMessage.set('Missing signing token in URL.');
      this.routeState.set('error');
      return;
    }

    await this.loadSession();
  }

  ngOnDestroy(): void {
    this.abortController?.abort();
    this.meta.removeTag("name='robots'");
    this.cleanupPdfDoc();
  }

  async loadSession(): Promise<void> {
    this.abortController?.abort();
    const ctrl = new AbortController();
    this.abortController = ctrl;
    this.routeState.set('loading');
    this.errorMessage.set(null);

    try {
      const features = await this.api.getFeatures(ctrl.signal);
      if (!features.signRequestsEnabled) {
        this.routeState.set('disabled');
        return;
      }

      const sess = await this.api.getSignerSession(this.token, ctrl.signal);
      this.session.set(sess);

      if (!sess.isYourTurn) {
        this.routeState.set('waiting_turn');
        return;
      }

      const dateFmt = getDefaultDateFormatForLocale();
      const prefilled = sess.assignedFields.map((f) => {
        if (f.type === 'date' && !f.text) {
          return { ...f, text: formatSigningDate(new Date(), f.dateFormat || dateFmt) };
        }
        if (f.type === 'name' && !f.text) {
          return { ...f, text: sess.signer.name };
        }
        return { ...f };
      });
      this.fields.set(prefilled);

      const pdfBytes = await this.api.fetchSignerPdfBytes(this.token, ctrl.signal);
      if (ctrl.signal.aborted) return;

      this.cleanupPdfDoc();
      this.pdfDocProxy = await this.pdfjs.loadDocument(pdfBytes);
      this.routeState.set('ready');
      setTimeout(() => void this.renderAllPages(), 30);
    } catch (err: any) {
      if (ctrl.signal.aborted) return;
      this.errorMessage.set(err?.message || 'Unable to load signing session.');
      this.routeState.set('error');
    }
  }

  isFieldFilled(f: SignFieldElement): boolean {
    if (f.type === 'signature' || f.type === 'initials' || f.type === 'stamp') {
      return Boolean(f.imageDataUrl);
    }
    if (f.type === 'checkbox') {
      return f.required ? Boolean(f.checked) : true;
    }
    return Boolean(f.text?.trim());
  }

  getPageSize(page: PdfPageBoxMetrics): { width: number; height: number } {
    return this.transform.getPageDisplaySize(page, 1.0);
  }

  fieldsOnPage(pageIndex: number): SignFieldElement[] {
    return this.fields().filter((f) => f.pageIndex === pageIndex);
  }

  getFieldScreenRect(field: SignFieldElement, page: PdfPageBoxMetrics) {
    return this.transform.pdfRectToScreenRect(field, page, 1.0);
  }

  activateField(field: SignFieldElement): void {
    this.activeFieldId.set(field.id);
    if (field.type === 'signature' || field.type === 'initials' || field.type === 'stamp') {
      this.showSignatureDialogForFieldId.set(field.id);
    } else if (field.type === 'checkbox') {
      this.updateField(field.id, { checked: !field.checked });
    }
  }

  onDialogApplied(res: SignatureApplyResult): void {
    const fieldId = this.showSignatureDialogForFieldId();
    this.showSignatureDialogForFieldId.set(null);
    if (!fieldId) return;
    this.updateField(fieldId, { imageDataUrl: res.imageDataUrl, text: res.text });
  }

  updateField(fieldId: string, patch: Partial<SignFieldElement>): void {
    this.fields.update((list) => list.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
  }

  async finishSigning(): Promise<void> {
    if (!this.canFinish()) return;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const result = await this.api.completeSigner(this.token, {
        consentGiven: true,
        completedFields: this.fields().map((f) => ({
          fieldId: f.id,
          imageDataUrl: f.imageDataUrl,
          text: f.text,
          checked: f.checked
        }))
      });
      this.completionSha256.set(result.finalSha256 || null);
      this.completionMessage.set(
        result.status === 'completed'
          ? 'All parties have signed! Your completed PDF has been sent to everyone.'
          : 'Your signature was recorded. Remaining signers will be notified next.'
      );
      this.routeState.set('completed');
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Submission failed. Please check all required fields.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async confirmDecline(): Promise<void> {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.api.declineSigner(this.token, this.declineReason().trim() || 'Declined by recipient');
      this.showDeclineModal.set(false);
      this.routeState.set('declined');
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Unable to decline document.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async renderAllPages(): Promise<void> {
    if (!this.pdfDocProxy || typeof document === 'undefined') return;
    const pages = this.session()?.pagesMeta || [];
    for (const p of pages) {
      const target = document.getElementById(`signer-page-canvas-${p.pageIndex}`) as HTMLCanvasElement | null;
      if (!target) continue;
      const pdfPage = await this.pdfDocProxy.getPage(p.pageIndex + 1);
      const vp = pdfPage.getViewport({ scale: 1.0 });
      target.width = Math.round(vp.width);
      target.height = Math.round(vp.height);
      const ctx = target.getContext('2d');
      if (!ctx) continue;
      await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;
      this.renderedCanvases.set(p.pageIndex, target);
    }
  }

  private cleanupPdfDoc(): void {
    for (const c of this.renderedCanvases.values()) {
      c.width = 0;
      c.height = 0;
    }
    this.renderedCanvases.clear();
    if (this.pdfDocProxy) {
      void this.pdfjs.destroyDocument(this.pdfDocProxy);
      this.pdfDocProxy = null;
    }
  }
}

