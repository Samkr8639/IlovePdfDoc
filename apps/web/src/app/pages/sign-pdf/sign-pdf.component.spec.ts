import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignPdfComponent } from './sign-pdf.component';
import { SignSignatureDialogComponent } from './components/signature-dialog/signature-dialog.component';
import { SeoService } from '../../core/services/seo.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { LayoutService } from '../../core/services/layout.service';
import { SharedPdfjsService } from '../../core/services/shared-pdfjs.service';
import { PdfInspectionService } from '../../core/services/sign-pdf/pdf-inspection.service';
import { SignatureImageService } from '../../core/services/sign-pdf/signature-image.service';
import { SignatureStorageService } from '../../core/services/sign-pdf/signature-storage.service';
import { SignExportService } from '../../core/services/sign-pdf/sign-export.service';
import { SignRequestService } from '../../core/services/sign-pdf/sign-request.service';
import { UploadConsentService } from '../../core/services/upload-consent.service';
import { UnsupportedPkcs12CipherError } from '@paperflow/sign-core';
import {
  PdfInspectionSummary,
  SavedSignatureRecord,
  SignExportOutcome
} from '../../core/services/sign-pdf/sign-pdf.models';

describe('SignPdfComponent & Dialogs', () => {
  let fixture: ComponentFixture<SignPdfComponent>;
  let component: SignPdfComponent;

  let inspectionMock: any;
  let pdfjsMock: any;
  let storageMock: any;
  let imageMock: any;
  let exportMock: any;
  let signRequestMock: any;
  let consentMock: any;
  let layoutMock: any;
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  const fakePage = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    rotate: 0
  };

  const fakePdfDoc = {
    numPages: 2,
    getPage: vi.fn().mockResolvedValue(fakePage)
  };

  const defaultSummary: PdfInspectionSummary = {
    pageCount: 2,
    hasExistingDigitalSignatures: false,
    hasAcroFormFields: false,
    acroFormFieldCount: 0,
    isEncrypted: false,
    pagesMeta: [
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 },
      { pageIndex: 1, widthPt: 595, heightPt: 842, rotation: 0 }
    ]
  };

  const sampleOutcome: SignExportOutcome = {
    blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }),
    url: 'blob:signed-output-url',
    filename: 'contract-signed.pdf',
    sizeBytes: 12000,
    formattedSize: '11.7 KB',
    fieldsApplied: 1,
    pagesSigned: [1],
    warnings: [],
    originalPageCount: 2
  };

  function makePdfFile(name = 'contract.pdf', bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])): File {
    const f = new File([bytes], name, { type: 'application/pdf', lastModified: 1700000000000 });
    Object.defineProperty(f, 'arrayBuffer', {
      value: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    });
    return f;
  }

  beforeEach(async () => {
    if (typeof URL.createObjectURL !== 'function') {
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:thumb');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as any).revokeObjectURL = vi.fn();
    }
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    inspectionMock = {
      validatePdfMagicAndSize: vi.fn(),
      inspectPdf: vi.fn().mockResolvedValue(defaultSummary)
    };

    pdfjsMock = {
      loadDocument: vi.fn().mockResolvedValue(fakePdfDoc),
      destroyDocument: vi.fn().mockResolvedValue(undefined)
    };

    storageMock = {
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clearAll: vi.fn().mockResolvedValue(undefined),
      getRememberedSignerName: vi.fn().mockReturnValue(''),
      setRememberedSignerName: vi.fn(),
      forgetSignerName: vi.fn(),
      isUnavailable: vi.fn().mockReturnValue(false)
    };

    imageMock = {
      renderTypedSignatureToPngDataUrl: vi.fn().mockReturnValue('data:image/png;base64,AAA='),
      trimCanvasToPngDataUrl: vi.fn().mockReturnValue('data:image/png;base64,BBB='),
      processUploadedSignatureFile: vi.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,CCC=' }),
      reprocessUploadedDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,DDD='),
      renderStampPngDataUrl: vi.fn().mockReturnValue('data:image/png;base64,EEE=')
    };

    exportMock = {
      exportSignedDocument: vi.fn().mockResolvedValue(sampleOutcome),
      exportWithBrowserCertificate: vi.fn().mockResolvedValue({
        ...sampleOutcome,
        certificateSubject: 'Jane Doe',
        certificateIssuer: 'PDFTailor Root CA',
        signedMode: 'browser_webcrypto'
      }),
      createOutcomeFromBlob: vi.fn().mockImplementation((_blob: Blob, meta: any) => ({
        ...sampleOutcome,
        certificateSubject: meta.certificateSubject,
        certificateIssuer: meta.certificateIssuer,
        signedMode: meta.signedMode
      }))
    };

    signRequestMock = {
      getFeatures: vi.fn().mockResolvedValue({ signRequestsEnabled: true }),
      startSenderOtp: vi.fn().mockResolvedValue({ sent: true, expiresInSeconds: 600, _devOtpCode: '123456' }),
      verifySenderOtp: vi.fn().mockResolvedValue({ verified: true }),
      createRequest: vi.fn().mockResolvedValue({
        requestId: 'req-123',
        statusUrl: '/sign/requests/req-123',
        senderAccessToken: 'sender-tok',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        originalSha256: 'abc123def456',
        signerStatusSummaries: [
          { id: 'signer-1', name: 'Signer 1', email: 's1@example.com', status: 'pending', orderIndex: 0 }
        ],
        devSigningLinks: { 'signer-1': '/sign/tok-1' }
      }),
      getRequestStatus: vi.fn().mockResolvedValue({
        requestId: 'req-123',
        title: 'contract',
        status: 'in_progress',
        order: 'parallel',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        originalSha256: 'abc123def456',
        auditChainValid: true,
        signers: [
          { id: 'signer-1', name: 'Signer 1', email: 's1@example.com', color: '#0F766E', orderIndex: 0, status: 'pending' }
        ],
        auditLog: []
      }),
      resendSigner: vi.fn().mockResolvedValue({ resent: true, email: 's1@example.com', devSigningUrl: '/sign/tok-2' }),
      cancelRequest: vi.fn().mockResolvedValue({ status: 'cancelled' }),
      downloadFinalPdf: vi.fn().mockResolvedValue(new Blob([new Uint8Array([0x25, 0x50])], { type: 'application/pdf' })),
      downloadCertificatePdf: vi.fn().mockResolvedValue(new Blob([new Uint8Array([0x25, 0x50])], { type: 'application/pdf' })),
      signWithCertificateOnServer: vi.fn().mockResolvedValue({
        blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }),
        signerCn: 'Legacy Signer',
        issuerCn: 'Legacy CA'
      })
    };

    consentMock = {
      ask: vi.fn().mockResolvedValue(true)
    };

    layoutMock = {
      hideFooter: vi.fn(),
      showFooter: vi.fn(),
      isFooterVisible: vi.fn().mockReturnValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [SignPdfComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: SeoService, useValue: { setPageSeo: vi.fn() } },
        { provide: ToolRegistryService, useValue: { getToolById: vi.fn().mockReturnValue(undefined) } },
        { provide: LayoutService, useValue: layoutMock },
        { provide: SharedPdfjsService, useValue: pdfjsMock },
        { provide: PdfInspectionService, useValue: inspectionMock },
        { provide: SignatureImageService, useValue: imageMock },
        { provide: SignatureStorageService, useValue: storageMock },
        { provide: SignExportService, useValue: exportMock },
        { provide: SignRequestService, useValue: signRequestMock },
        { provide: UploadConsentService, useValue: consentMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SignPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders upload hero and displays error banner when validation throws', async () => {
    const h1 = fixture.nativeElement.querySelector('h1.tool-h1');
    expect(h1?.textContent?.trim()).toBe('Sign PDF');

    inspectionMock.validatePdfMagicAndSize.mockImplementation(() => {
      throw new Error('Invalid file header.');
    });

    await component.onFilesSelected([makePdfFile('bad.txt')]);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.global-error-banner');
    expect(banner?.textContent).toContain('Invalid file header.');
  });

  it('keeps Sign button disabled until >= 1 signature field is placed and wires aria-describedby', async () => {
    await component.onFilesSelected([makePdfFile()]);
    fixture.detectChanges();

    expect(component.stage()).toBe('editor');
    const signBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-sign-action');
    expect(signBtn).toBeTruthy();
    expect(signBtn.disabled).toBe(true);
    expect(signBtn.getAttribute('aria-describedby')).toBe('sign-btn-hint');

    const hint = fixture.nativeElement.querySelector('#sign-btn-hint');
    expect(hint?.textContent).toContain('Place your signature on the page first');

    // Place a non-signature field -> Sign still disabled
    component.signatureDataUrl.set('data:image/png;base64,AAA=');
    component.onPaletteTileEnter('date', new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.fields().length).toBe(1);
    expect(signBtn.disabled).toBe(true);

    // Place a signature field -> Sign becomes enabled and aria-describedby cleared
    component.onPaletteTileEnter('signature', new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.placedSignatureCount()).toBe(1);
    expect(signBtn.disabled).toBe(false);
    expect(signBtn.getAttribute('aria-describedby')).toBeNull();
  });

  it('enables Phase 2/3 radio cards and reveals certificate and recipient controls', async () => {
    await component.onFilesSelected([makePdfFile()]);
    fixture.detectChanges();

    const radios: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('aside input[type="radio"]');
    const severalInput = Array.from(radios).find(r => r.value === 'several_people');
    const certInput = Array.from(radios).find(r => r.value === 'digital_certificate');
    expect(severalInput?.disabled).toBe(false);
    expect(certInput?.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Coming soon');

    component.setSignType('digital_certificate');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('PKCS#12 Certificate');

    component.setWhoSigns('several_people');
    fixture.detectChanges();
    expect(component.signType()).toBe('simple');
    expect(fixture.nativeElement.textContent).toContain('RECIPIENTS');
  });

  it('signs PBES2 .p12 certificate purely in browser and uses consented OpenSSL fallback on legacy 3DES', async () => {
    await component.onFilesSelected([makePdfFile()]);
    component.setSignType('digital_certificate');

    const p12File = new File([new Uint8Array([0x30, 0x82])], 'cert.p12', { type: 'application/x-pkcs12' });
    Object.defineProperty(p12File, 'arrayBuffer', {
      value: () => Promise.resolve(new Uint8Array([0x30, 0x82]).buffer)
    });
    component.certFile.set(p12File);
    component.certPassword.set('secret');
    fixture.detectChanges();

    await component.executeSign();
    fixture.detectChanges();

    expect(exportMock.exportWithBrowserCertificate).toHaveBeenCalled();
    expect(consentMock.ask).not.toHaveBeenCalled();
    expect(signRequestMock.signWithCertificateOnServer).not.toHaveBeenCalled();
    expect(component.stage()).toBe('completed');
    expect(component.resultIsClientSide()).toBe(true);
    expect(component.resultSubtitle()).toContain('Jane Doe');

    // Now test legacy 3DES fallback with explicit consent
    component.backToEditorFromResult();
    exportMock.exportWithBrowserCertificate.mockRejectedValueOnce(new UnsupportedPkcs12CipherError('3DES not in WebCrypto'));
    consentMock.ask.mockResolvedValueOnce(false);
    await component.executeSign();
    expect(component.stage()).toBe('editor');
    expect(signRequestMock.signWithCertificateOnServer).not.toHaveBeenCalled();

    exportMock.exportWithBrowserCertificate.mockRejectedValueOnce(new UnsupportedPkcs12CipherError('3DES not in WebCrypto'));
    consentMock.ask.mockResolvedValueOnce(true);
    await component.executeSign();
    expect(signRequestMock.signWithCertificateOnServer).toHaveBeenCalled();
    expect(component.stage()).toBe('completed');
    expect(component.resultIsClientSide()).toBe(false);
  });

  it('creates a multi-signer request after consent and displays live tracker controls', async () => {
    await component.onFilesSelected([makePdfFile()]);
    component.setWhoSigns('several_people');
    component.updateRecipient('signer-1', { name: 'Alice', email: 'alice@example.com' });
    component.addRecipient();
    const secondId = component.signers()[1].id;
    component.updateRecipient(secondId, { name: 'Bob', email: 'bob@example.com' });

    // Recipients don't need sender's pre-drawn signature before placing fields
    component.onPaletteTileEnter('signature', new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.placedSignatureCount()).toBe(1);
    expect(component.canSign()).toBe(true);

    // Click primary CTA -> opens Send Request modal
    await component.executeSign();
    expect(component.showSendRequestModal()).toBe(true);

    component.senderEmail.set('sender@example.com');
    await component.submitSendRequest();
    fixture.detectChanges();

    expect(consentMock.ask).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'sign_pdf_request' }));
    expect(signRequestMock.createRequest).toHaveBeenCalled();
    expect(component.stage()).toBe('sent');
    expect(fixture.nativeElement.textContent).toContain('SIGNATURE REQUEST TRACKER');
    expect(fixture.nativeElement.textContent).toContain('/sign/tok-1');

    await component.resendInvitation('signer-1');
    expect(signRequestMock.resendSigner).toHaveBeenCalledWith('req-123', 'sender-tok', 'signer-1', undefined);

    await component.cancelSentRequest();
    expect(signRequestMock.cancelRequest).toHaveBeenCalledWith('req-123', 'sender-tok');
  });

  it('keeps global error banner visible inside the editor state on duplicate upload', async () => {
    const file = makePdfFile('same.pdf');
    await component.onFilesSelected([file]);
    fixture.detectChanges();
    expect(component.stage()).toBe('editor');

    await component.onFilesSelected([file]);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.global-error-banner');
    expect(banner?.textContent).toContain('already loaded');
  });

  it('prompts before replacing PDFs that already contain digital signatures', async () => {
    inspectionMock.inspectPdf.mockResolvedValue({
      ...defaultSummary,
      hasExistingDigitalSignatures: true
    });

    await component.onFilesSelected([makePdfFile('signed.pdf')]);
    fixture.detectChanges();

    expect(component.showExistingSigConfirmModal()).toBe(true);
    expect(component.stage()).toBe('upload');

    await component.confirmExistingSignatureProceed();
    fixture.detectChanges();

    expect(component.showExistingSigConfirmModal()).toBe(false);
    expect(component.stage()).toBe('editor');
    expect(component.invalidatedExistingSigConfirmed()).toBe(true);
  });

  it('cancels in-flight signing cleanly, restores editor, and revokes late result URL', async () => {
    await component.onFilesSelected([makePdfFile()]);
    component.signatureDataUrl.set('data:image/png;base64,AAA=');
    component.onPaletteTileEnter('signature', new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    let resolveLate!: (v: SignExportOutcome) => void;
    exportMock.exportSignedDocument.mockReturnValue(
      new Promise<SignExportOutcome>(res => {
        resolveLate = res;
      })
    );

    const runPromise = component.executeSign();
    fixture.detectChanges();
    expect(component.stage()).toBe('processing');

    component.cancelSigning();
    fixture.detectChanges();
    expect(component.stage()).toBe('editor');
    expect(component.isProcessing()).toBe(false);

    resolveLate({ ...sampleOutcome, url: 'blob:late-cancelled-url' });
    await runPromise;
    expect(component.stage()).toBe('editor');
    expect(revokeSpy).toHaveBeenCalledWith('blob:late-cancelled-url');
  });

  it('revokes export URL on reset and checks canDeactivate guard', async () => {
    expect(component.canDeactivate()).toBe(true);

    await component.onFilesSelected([makePdfFile()]);
    component.signatureDataUrl.set('data:image/png;base64,AAA=');
    component.onPaletteTileEnter('signature', new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(component.hasUnsavedChanges()).toBe(true);
    expect(component.canDeactivate()).toBe(false);
    expect(confirmSpy).toHaveBeenCalled();

    await component.executeSign();
    fixture.detectChanges();
    expect(component.stage()).toBe('completed');
    expect(component.canDeactivate()).toBe(true);

    component.resetAll();
    expect(revokeSpy).toHaveBeenCalledWith('blob:signed-output-url');
    expect(component.stage()).toBe('upload');
  });
});

describe('SignSignatureDialogComponent', () => {
  let fixture: ComponentFixture<SignSignatureDialogComponent>;
  let dialog: SignSignatureDialogComponent;
  let storageMock: any;
  let imageMock: any;

  const savedRec: SavedSignatureRecord = {
    id: 'saved-1',
    kind: 'signature',
    pngBlob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
    label: 'A. Kumar',
    created: 1700000000000
  };

  beforeEach(async () => {
    if (typeof URL.createObjectURL !== 'function') {
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:saved-preview');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:saved-preview');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as any).revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    } as Response);

    storageMock = {
      list: vi.fn().mockResolvedValue([savedRec]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clearAll: vi.fn().mockResolvedValue(undefined),
      getRememberedSignerName: vi.fn().mockReturnValue(''),
      isUnavailable: vi.fn().mockReturnValue(false)
    };
    imageMock = {
      renderTypedSignatureToPngDataUrl: vi.fn().mockReturnValue('data:image/png;base64,iVBORw0KGgo='),
      trimCanvasToPngDataUrl: vi.fn().mockReturnValue('data:image/png;base64,DRAWN'),
      processUploadedSignatureFile: vi.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,UP' }),
      reprocessUploadedDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,UP2')
    };

    await TestBed.configureTestingModule({
      imports: [SignSignatureDialogComponent],
      providers: [
        { provide: SignatureStorageService, useValue: storageMock },
        { provide: SignatureImageService, useValue: imageMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SignSignatureDialogComponent);
    dialog = fixture.componentInstance;
    fixture.componentRef.setInput('kind', 'signature');
    fixture.componentRef.setInput('initialName', 'Alex Mercer');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads saved signatures, switches tabs, types signature and persists if checked', async () => {
    expect(storageMock.list).toHaveBeenCalledWith('signature');
    expect(dialog.savedRecords().length).toBe(1);

    const applySpy = vi.fn();
    dialog.applied.subscribe(applySpy);

    dialog.activeTab.set('type');
    dialog.typedValue.set('Alex Mercer');
    dialog.saveOnDevice.set(true);
    fixture.detectChanges();

    await dialog.confirmApply();
    expect(imageMock.renderTypedSignatureToPngDataUrl).toHaveBeenCalled();
    expect(storageMock.save).toHaveBeenCalled();
    expect(applySpy).toHaveBeenCalledWith(expect.objectContaining({
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      mode: 'type',
      text: 'Alex Mercer'
    }));
  });

  it('deletes individual saved signature and supports clearing all', async () => {
    await dialog.deleteSavedRecord({ ...savedRec, previewUrl: 'blob:saved-preview' });
    expect(storageMock.delete).toHaveBeenCalledWith('saved-1');
    expect(dialog.savedRecords().length).toBe(0);

    await dialog.clearAllSaved();
    expect(storageMock.clearAll).toHaveBeenCalled();
  });
});
