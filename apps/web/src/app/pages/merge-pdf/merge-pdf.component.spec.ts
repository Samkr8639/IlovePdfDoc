import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MergePdfComponent } from './merge-pdf.component';
import { BrowserPdfService } from '../../core/services/browser-pdf.service';
import { PDFDocument } from 'pdf-lib';

describe('MergePdfComponent Integration Test', () => {
  let component: MergePdfComponent;
  let fixture: ComponentFixture<MergePdfComponent>;
  let pdfService: BrowserPdfService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MergePdfComponent],
      providers: [
        provideRouter([]),
        BrowserPdfService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MergePdfComponent);
    component = fixture.componentInstance;
    pdfService = TestBed.inject(BrowserPdfService);
    fixture.detectChanges();
  });

  async function createTestPdfFile(pages: number, name: string): Promise<File> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      doc.addPage([500, 350]);
    }
    const bytes = await doc.save();
    return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/pdf' });
  }

  it('should initialize in "upload" state', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.mergeResult()).toBeNull();
  });

  it('should transition to "organize" state when files are added and validated', async () => {
    const file1 = await createTestPdfFile(2, 'doc_alpha.pdf');
    const file2 = await createTestPdfFile(3, 'doc_beta.pdf');

    await component.onFilesAdded([file1, file2]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(2);
    expect(component.selectedFiles()[0].name).toBe('doc_alpha.pdf');
    expect(component.selectedFiles()[0].pageCount).toBe(2);
    expect(component.selectedFiles()[1].name).toBe('doc_beta.pdf');
    expect(component.selectedFiles()[1].pageCount).toBe(3);
  });

  it('should support reordering files before merging', async () => {
    const file1 = await createTestPdfFile(1, 'first.pdf');
    const file2 = await createTestPdfFile(2, 'second.pdf');

    await component.onFilesAdded([file1, file2]);
    expect(component.selectedFiles()[0].name).toBe('first.pdf');

    // Move second item up to index 0
    component.onMoveUp(1);
    expect(component.selectedFiles()[0].name).toBe('second.pdf');
    expect(component.selectedFiles()[1].name).toBe('first.pdf');

    // Move first item down back to index 1
    component.onMoveDown(0);
    expect(component.selectedFiles()[0].name).toBe('first.pdf');
    expect(component.selectedFiles()[1].name).toBe('second.pdf');
  });

  it('should execute merge in-browser, generate download URL, and aggregate 5 pages', async () => {
    const file1 = await createTestPdfFile(2, 'part1.pdf');
    const file2 = await createTestPdfFile(3, 'part2.pdf');

    await component.onFilesAdded([file1, file2]);
    expect(component.currentState()).toBe('organize');

    // Execute merge
    await component.executeMerge();
    fixture.detectChanges();

    // Verify completed state
    expect(component.currentState()).toBe('completed');
    const result = component.mergeResult();
    expect(result).not.toBeNull();
    expect(result!.pageCount).toBe(5); // 2 + 3 = 5
    expect(result!.filename).toMatch(/^paperflow-merged-[\d-]+\.pdf$/);
    expect(result!.url).toMatch(/^blob:/);
    expect(result!.sizeBytes).toBeGreaterThan(0);

    // Verify the downloaded blob is valid PDF with 5 pages
    const buffer = await result!.blob.arrayBuffer();
    const verified = await PDFDocument.load(buffer);
    expect(verified.getPageCount()).toBe(5);

    // Verify DOM contains download link with correct attributes
    const compiled = fixture.nativeElement as HTMLElement;
    const downloadLink = compiled.querySelector('a.download-btn') as HTMLAnchorElement;
    expect(downloadLink).not.toBeNull();
    expect(downloadLink.getAttribute('download')).toBe(result!.filename);
  });

  it('should reset workspace properly and revoke object URL', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const file1 = await createTestPdfFile(1, 'doc1.pdf');
    const file2 = await createTestPdfFile(1, 'doc2.pdf');

    await component.onFilesAdded([file1, file2]);
    await component.executeMerge();

    expect(component.currentState()).toBe('completed');
    const blobUrl = component.mergeResult()!.url;

    // Reset workspace
    component.resetWorkspace();
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.mergeResult()).toBeNull();
    expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
  });
});
