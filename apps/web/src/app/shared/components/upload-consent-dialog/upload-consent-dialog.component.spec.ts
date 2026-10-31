import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UploadConsentDialogComponent } from './upload-consent-dialog.component';
import { UploadConsentService } from '../../../core/services/upload-consent.service';
import { ServerActionGuard } from '../../../core/guards/server-action.guard';
import { provideRouter } from '@angular/router';

describe('UploadConsentDialogComponent', () => {
  let component: UploadConsentDialogComponent;
  let fixture: ComponentFixture<UploadConsentDialogComponent>;
  let consentService: UploadConsentService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadConsentDialogComponent],
      providers: [UploadConsentService, ServerActionGuard, provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadConsentDialogComponent);
    component = fixture.componentInstance;
    consentService = TestBed.inject(UploadConsentService);
    fixture.detectChanges();
  });

  it('should create and render nothing when state is null', () => {
    expect(component).toBeTruthy();
    const modalEl = fixture.nativeElement.querySelector('.consent-modal');
    expect(modalEl).toBeNull();
  });

  it('should render dialog when consent is asked', async () => {
    consentService.ask({
      actionId: 'ocr-test',
      pageCountDescription: '5 pages of this PDF'
    });
    fixture.detectChanges();

    const modalEl = fixture.nativeElement.querySelector('.consent-modal');
    expect(modalEl).toBeTruthy();
    expect(modalEl.getAttribute('role')).toBe('dialog');
    expect(modalEl.getAttribute('aria-modal')).toBe('true');

    const pagesEl = fixture.nativeElement.querySelector('.highlight-pages');
    expect(pagesEl?.textContent).toContain('5 pages of this PDF');
  });

  it('should cancel on escape key', () => {
    const cancelSpy = vi.spyOn(consentService, 'cancel');
    consentService.ask({ actionId: 'test', pageCountDescription: '1 page' });
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    expect(cancelSpy).toHaveBeenCalled();
  });
});

