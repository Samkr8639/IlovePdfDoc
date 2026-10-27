import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResultViewComponent } from './result-view.component';
import { MergeResult } from '../../../core/services/browser-pdf.service';

describe('ResultViewComponent with Document Layout Viewer', () => {
  let component: ResultViewComponent;
  let fixture: ComponentFixture<ResultViewComponent>;

  const mockDocxResult: MergeResult = {
    blob: new Blob(['fake docx binary content'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }),
    url: 'blob:http://localhost:4200/fake-docx-uuid',
    filename: 'Sample_Invoice.docx',
    pageCount: 3,
    sizeBytes: 24500,
    formattedSize: '24.5 KB'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultViewComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ResultViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('result', mockDocxResult);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should recognize DOCX format and configure Word preview mode', () => {
    expect(component.isDocx()).toBe(true);
    const pillBtn = fixture.nativeElement.querySelector('.preview-pill-btn');
    expect(pillBtn).toBeTruthy();
    expect(pillBtn.textContent).toContain('Preview Word Document');
  });

  it('should toggle preview state and display Word layout viewer drawer', () => {
    expect(component.showPreview()).toBe(false);
    component.togglePreview();
    fixture.detectChanges();

    expect(component.showPreview()).toBe(true);
    const titleEl = fixture.nativeElement.querySelector('.preview-title');
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent).toContain('Word Document Layout Preview');

    const bannerEl = fixture.nativeElement.querySelector('.docx-preview-banner');
    expect(bannerEl).toBeTruthy();
    expect(bannerEl.textContent).toContain('Word Document Layout Preview');

    const dlBtn = fixture.nativeElement.querySelector('.preview-direct-download-btn');
    expect(dlBtn).toBeTruthy();
    expect(dlBtn.textContent).toContain('Download WORD');
  });

  it('should utilize previewPdfUrl when provided for high-fidelity rendering', () => {
    const customPdfUrl = 'blob:http://localhost:4200/custom-preview-pdf';
    fixture.componentRef.setInput('previewPdfUrl', customPdfUrl);
    fixture.detectChanges();

    component.togglePreview();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('.preview-embed-frame');
    expect(iframe).toBeTruthy();
    expect(component.previewUrl()).toBeTruthy();
  });

  it('should display original to compressed size and progress bar for compressed PDF', () => {
    const mockCompressResult: any = {
      blob: new Blob(['fake compressed pdf'], { type: 'application/pdf' }),
      url: 'blob:http://localhost:4200/fake-compress-uuid',
      filename: 'Sample_Brochure.pdf',
      pageCount: 4,
      sizeBytes: 150000,
      formattedSize: '150 KB',
      formattedOriginalSize: '1.5 MB',
      formattedCompressedSize: '150 KB',
      reductionPercent: 90
    };

    fixture.componentRef.setInput('result', mockCompressResult);
    fixture.detectChanges();

    const transitionEl = fixture.nativeElement.querySelector('.size-transition-pill');
    expect(transitionEl).toBeTruthy();
    expect(transitionEl.textContent).toContain('1.5 MB → 150 KB');

    const progressBar = fixture.nativeElement.querySelector('.savings-progress-track[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('90');
    expect(progressBar.getAttribute('aria-label')).toBe('90% space saved');

    // Low savings callout should NOT show when reduction is 90%
    const callout = fixture.nativeElement.querySelector('.low-savings-callout');
    expect(callout).toBeNull();
  });

  it('should display low savings explanation alert when reduction is less than 5%', () => {
    const mockLowSavingsResult: any = {
      blob: new Blob(['fake text pdf'], { type: 'application/pdf' }),
      url: 'blob:http://localhost:4200/fake-compress-uuid',
      filename: 'Sample_Contract.pdf',
      pageCount: 6,
      sizeBytes: 7400,
      formattedSize: '7.4 KB',
      formattedOriginalSize: '7.6 KB',
      formattedCompressedSize: '7.4 KB',
      reductionPercent: 2,
      savingsReason: 'This PDF is mostly text and already well optimised.'
    };

    fixture.componentRef.setInput('result', mockLowSavingsResult);
    fixture.detectChanges();

    const callout = fixture.nativeElement.querySelector('.low-savings-callout[role="alert"]');
    expect(callout).toBeTruthy();
    expect(callout.textContent).toContain('This PDF is mostly text and already well optimised.');
  });
});
