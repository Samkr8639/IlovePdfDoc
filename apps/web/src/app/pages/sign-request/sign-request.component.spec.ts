import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignRequestComponent } from './sign-request.component';
import { SignRequestService, SignerSessionPayload } from '../../core/services/sign-pdf/sign-request.service';
import { SharedPdfjsService } from '../../core/services/shared-pdfjs.service';

describe('SignRequestComponent (/sign/:token)', () => {
  let fixture: ComponentFixture<SignRequestComponent>;
  let component: SignRequestComponent;
  let apiMock: any;
  let pdfjsMock: any;
  let metaUpdateSpy: ReturnType<typeof vi.spyOn>;

  const sampleSession: SignerSessionPayload = {
    requestId: 'req-1',
    title: 'Employment Agreement',
    message: 'Please review',
    senderName: 'HR Team',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    order: 'parallel',
    pageCount: 1,
    pagesMeta: [{ pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }],
    signer: { id: 's1', name: 'Jordan Lee', email: 'jordan@example.com', color: '#0F766E', status: 'sent' },
    isYourTurn: true,
    assignedFields: [
      { id: 'f-sig', pageIndex: 0, type: 'signature', xPt: 60, yPt: 120, widthPt: 180, heightPt: 60, signerId: 's1', required: true },
      { id: 'f-name', pageIndex: 0, type: 'name', xPt: 60, yPt: 80, widthPt: 160, heightPt: 24, signerId: 's1', required: true }
    ]
  };

  beforeEach(async () => {
    apiMock = {
      getFeatures: vi.fn().mockResolvedValue({ signRequestsEnabled: false }),
      getSignerSession: vi.fn().mockResolvedValue(sampleSession),
      fetchSignerPdfBytes: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      completeSigner: vi.fn().mockResolvedValue({ status: 'completed', finalSha256: 'abc123' }),
      declineSigner: vi.fn().mockResolvedValue({ status: 'declined' })
    };
    pdfjsMock = {
      loadDocument: vi.fn().mockResolvedValue({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({ width: 595, height: 842 }),
          render: () => ({ promise: Promise.resolve() })
        })
      }),
      destroyDocument: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [SignRequestComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'secret-token-value-123456' } } }
        },
        { provide: SignRequestService, useValue: apiMock },
        { provide: SharedPdfjsService, useValue: pdfjsMock }
      ]
    }).compileComponents();

    const meta = TestBed.inject(Meta);
    metaUpdateSpy = vi.spyOn(meta, 'updateTag');

    fixture = TestBed.createComponent(SignRequestComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets noindex meta and shows friendly offline screen when signRequestsEnabled=false', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(metaUpdateSpy).toHaveBeenCalledWith({ name: 'robots', content: 'noindex, nofollow' });
    expect(component.routeState()).toBe('disabled');
    expect(fixture.nativeElement.textContent).toContain('Remote Signature Requests Are Offline');
  });

  it('shows signer checklist progress and enforces consent + required fields before finishing', async () => {
    apiMock.getFeatures.mockResolvedValue({ signRequestsEnabled: true });

    fixture.detectChanges();
    await component.loadSession();
    fixture.detectChanges();

    expect(component.routeState()).toBe('ready');
    // Name is auto-filled from signer profile (1 of 2 fields done)
    expect(component.completedFieldCount()).toBe(1);
    expect(component.totalFieldCount()).toBe(2);
    expect(component.canFinish()).toBe(false);

    // Fill signature image -> 2 of 2 done, still requires consent checkbox
    component.updateField('f-sig', { imageDataUrl: 'data:image/png;base64,AAA=' });
    fixture.detectChanges();
    expect(component.completedFieldCount()).toBe(2);
    expect(component.canFinish()).toBe(false);

    // Tick consent -> Finish enabled & submits cleanly
    component.consentGiven.set(true);
    fixture.detectChanges();
    expect(component.canFinish()).toBe(true);

    await component.finishSigning();
    expect(apiMock.completeSigner).toHaveBeenCalledWith(
      'secret-token-value-123456',
      expect.objectContaining({ consentGiven: true })
    );
    expect(component.routeState()).toBe('completed');
  });
});
