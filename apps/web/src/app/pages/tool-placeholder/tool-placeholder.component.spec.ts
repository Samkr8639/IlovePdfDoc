import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { ToolPlaceholderComponent } from './tool-placeholder.component';
import { BrowserPdfService } from '../../core/services/browser-pdf.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { PDFDocument } from 'pdf-lib';

describe('ToolPlaceholderComponent Integration Test', () => {
  let component: ToolPlaceholderComponent;
  let fixture: ComponentFixture<ToolPlaceholderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolPlaceholderComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              routeConfig: { path: 'compress-pdf' }
            }
          }
        },
        BrowserPdfService,
        ToolRegistryService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ToolPlaceholderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  async function createTestPdfFile(pages: number, name: string): Promise<File> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      doc.addPage([400, 300]);
    }
    const bytes = await doc.save();
    return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/pdf' });
  }

  it('should initialize compress-pdf with proper hero title and upload state', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.tool()?.id).toBe('compress-pdf');
    expect(component.heroTitle()).toBe('Compress PDF files');
    expect(component.dropzoneButtonTitle()).toBe('Select PDF files');
    expect(component.compressionLevel()).toBe('recommended');
  });

  it('should transition to organize mode when a PDF file is added', async () => {
    const file = await createTestPdfFile(3, 'quarterly_report.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('quarterly_report.pdf');
    expect(component.selectedFiles()[0].pageCount).toBe(3);
  });

  it('should compress PDF and transition to completed result state with savings info', async () => {
    const file = await createTestPdfFile(2, 'doc_to_compress.pdf');
    await component.onFilesAdded([file]);
    expect(component.currentState()).toBe('organize');

    await component.executeToolAction();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    const res = component.toolResult();
    expect(res).not.toBeNull();
    expect(res!.filename).toBe('doc_to_compress_compressed.pdf');
    expect(res!.url).toMatch(/^blob:/);
    expect(component.resultSavingsText()).toBeTruthy();
  });

  it('should compress multiple PDF files into a ZIP package', async () => {
    const file1 = await createTestPdfFile(2, 'doc1.pdf');
    const file2 = await createTestPdfFile(2, 'doc2.pdf');
    await component.onFilesAdded([file1, file2]);
    expect(component.selectedFiles().length).toBe(2);

    await component.executeToolAction();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    const res = component.toolResult();
    expect(res).not.toBeNull();
    expect(res!.filename).toContain('.zip');
    expect(component.resultTitle()).toBe('2 PDFs Compressed!');
    expect(component.resultDownloadLabel()).toBe('Download All Compressed PDFs (.ZIP)');
  });

  it('should support adding, removing, and validating custom split ranges', async () => {
    component.tool.set({
      id: 'split-pdf',
      name: 'Split PDF',
      maxFiles: 1
    } as any);
    const file = await createTestPdfFile(5, 'sample_for_split.pdf');
    await component.onFilesAdded([file]);
    component.splitMainTab.set('range');
    component.splitRangeMode.set('custom');
    fixture.detectChanges();

    expect(component.customRanges().length).toBe(1);
    expect(component.customRanges()[0].from).toBe(1);

    // Add Range
    component.addCustomRange();
    expect(component.customRanges().length).toBe(2);

    // Add another range
    component.addCustomRange();
    expect(component.customRanges().length).toBe(3);

    // Remove Range 2
    component.removeCustomRange(1);
    expect(component.customRanges().length).toBe(2);

    // Cannot remove when only 1 range left
    component.removeCustomRange(0);
    expect(component.customRanges().length).toBe(1);
    component.removeCustomRange(0);
    expect(component.customRanges().length).toBe(1);

    // Validation: from > to
    component.updateRangeFrom(0, 4);
    component.updateRangeTo(0, 2);
    expect(component.customRangesValidation().hasError).toBe(true);
    expect(component.isSplitActionDisabled()).toBe(true);

    // Validation: valid range within 5 pages
    component.updateRangeFrom(0, 1);
    component.updateRangeTo(0, 3);
    expect(component.customRangesValidation().hasError).toBe(false);
    expect(component.isSplitActionDisabled()).toBe(false);
  });
});
