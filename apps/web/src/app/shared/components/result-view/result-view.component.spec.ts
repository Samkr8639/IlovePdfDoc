import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResultViewComponent } from './result-view.component';
import { MergeResult } from '../../../core/services/browser-pdf.service';

describe('ResultViewComponent with In-Browser DOCX Viewer', () => {
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

  it('should toggle preview state and display Word viewer drawer', () => {
    expect(component.showPreview()).toBe(false);
    component.togglePreview();
    fixture.detectChanges();

    expect(component.showPreview()).toBe(true);
    const titleEl = fixture.nativeElement.querySelector('.preview-title');
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent).toContain('Word Document Inspection Viewer');
  });

  it('should manage zoom controls correctly', () => {
    expect(component.docxZoom()).toBe(100);
    component.zoomIn();
    expect(component.docxZoom()).toBe(110);
    component.zoomOut();
    expect(component.docxZoom()).toBe(100);
    component.zoomOut();
    expect(component.docxZoom()).toBe(90);
    component.resetZoom();
    expect(component.docxZoom()).toBe(100);
  });
});
