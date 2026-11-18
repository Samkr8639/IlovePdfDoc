/**
 * Watermark PDF Component Tests
 * Verification of upload, workspace, settings, validation, execution, and reset.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WatermarkPdfComponent } from './watermark-pdf.component';
import { BrowserPdfService } from '../../core/services/browser-pdf.service';
import { SharedPdfjsService } from '../../core/services/shared-pdfjs.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { WatermarkExportService } from '../../core/services/watermark-pdf/watermark-export.service';
import { WatermarkProcessingService } from '../../core/services/watermark-pdf/watermark-processing.service';
import { WatermarkImageService } from '../../core/services/watermark-pdf/watermark-image.service';
import { WATERMARK_DEFAULT_SETTINGS } from '@paperflow/contracts';

describe('WatermarkPdfComponent', () => {
  let component: WatermarkPdfComponent;
  let fixture: ComponentFixture<WatermarkPdfComponent>;
  let mockSharedPdfjs: any;
  let mockLayoutService: any;
  let mockProcessingService: any;
  let mockImageService: any;

  beforeEach(async () => {
    mockSharedPdfjs = {
      loadDocument: vi.fn().mockResolvedValue({
        numPages: 5,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 595, height: 842 }),
          render: vi.fn().mockReturnValue({
            promise: Promise.resolve(),
            cancel: vi.fn()
          }),
          cleanup: vi.fn()
        })
      })
    };

    mockLayoutService = {
      hideFooter: vi.fn(),
      showFooter: vi.fn()
    };

    mockProcessingService = {
      processWatermark: vi.fn().mockResolvedValue({
        filename: 'test-watermarked.pdf',
        pdfBytes: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]),
        totalPages: 5,
        watermarkedPagesCount: 5,
        warnings: []
      }),
      processMultipleWatermarks: vi.fn().mockResolvedValue({
        results: [
          {
            filename: 'test1-watermarked.pdf',
            pdfBytes: new Uint8Array([37, 80, 68, 70]),
            totalPages: 5,
            watermarkedPagesCount: 5,
            warnings: []
          },
          {
            filename: 'test2-watermarked.pdf',
            pdfBytes: new Uint8Array([37, 80, 68, 70]),
            totalPages: 5,
            watermarkedPagesCount: 5,
            warnings: []
          }
        ],
        zipBytes: new Uint8Array([80, 75, 3, 4]),
        zipFilename: 'watermarked-pdfs.zip'
      }),
      cancel: vi.fn()
    };

    mockImageService = {
      validateImageHeader: vi.fn().mockResolvedValue({
        valid: true,
        image: {
          header: {
            width: 400,
            height: 200,
            format: 'png',
            fileSizeBytes: 500
          },
          format: 'png',
          bytes: new Uint8Array()
        }
      })
    };

    await TestBed.configureTestingModule({
      imports: [WatermarkPdfComponent],
      providers: [
        provideRouter([]),
        { provide: SharedPdfjsService, useValue: mockSharedPdfjs },
        { provide: LayoutService, useValue: mockLayoutService },
        { provide: WatermarkProcessingService, useValue: mockProcessingService },
        { provide: WatermarkImageService, useValue: mockImageService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WatermarkPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the watermark component', () => {
    expect(component).toBeTruthy();
    expect(component.currentState()).toBe('upload');
  });

  it('initializes with authoritative default values matching R-031', () => {
    const s = component.settings();
    expect(s.common.activeTab).toBe('text');
    expect(s.textConfig.text).toBe('');
    expect(s.textConfig.fontFamily).toBe('Noto Sans');
    expect(s.textConfig.fontSize).toBe('auto');
    expect(s.textConfig.bold).toBe(true);
    expect(s.textConfig.italic).toBe(false);
    expect(s.textConfig.underline).toBe(false);
    expect(s.textConfig.color).toBe('#4B5563');

    expect(s.common.position).toBe('center');
    expect(s.common.marginMm).toBe(10);
    expect(s.common.opacity).toBe(50);
    expect(s.common.rotation).toBe(45);
    expect(s.common.pageMode).toBe('all');
    expect(s.common.layer).toBe('over');
    expect(s.common.markAsArtifact).toBe(true);
  });

  it('rejects non-PDF files in onFilesAdded', async () => {
    const fakeFile = new File(['hello'], 'image.png', { type: 'image/png' });
    await component.onFilesAdded([fakeFile]);

    expect(component.errorMessage()).toContain('valid PDF');
    expect(component.currentState()).toBe('upload');
  });

  it('rejects files exceeding 100 MB limit', async () => {
    const bigFile = new File([new ArrayBuffer(10)], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 105 * 1024 * 1024 });

    await component.onFilesAdded([bigFile]);
    expect(component.errorMessage()).toContain('100 MB');
    expect(component.currentState()).toBe('upload');
  });

  it('loads valid PDF, switches to organize workspace, and hides footer', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const validFile = new File([pdfBytes], 'contract.pdf', { type: 'application/pdf' });

    await component.onFilesAdded([validFile]);

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFile()?.name).toBe('contract.pdf');
    expect(component.totalPages()).toBe(5);
    expect(component.currentPage()).toBe(1);
    expect(mockLayoutService.hideFooter).toHaveBeenCalled();
  });

  it('handles text formatting toolbar and quick chips (R-019, R-020, R-021)', () => {
    component.applyQuickChip('CONFIDENTIAL');
    expect(component.settings().textConfig.text).toBe('CONFIDENTIAL');

    component.onTextChange('TEST \x00 CONTROL');
    expect(component.settings().textConfig.text).toBe('TEST  CONTROL');

    component.setFontFamily('Roboto');
    expect(component.settings().textConfig.fontFamily).toBe('Roboto');

    component.setFontSize(36);
    expect(component.settings().textConfig.fontSize).toBe(36);

    component.setFontSize('auto');
    expect(component.settings().textConfig.fontSize).toBe('auto');

    component.toggleBold();
    expect(component.settings().textConfig.bold).toBe(false);

    component.toggleItalic();
    expect(component.settings().textConfig.italic).toBe(true);

    component.toggleUnderline();
    expect(component.settings().textConfig.underline).toBe(true);

    component.setColor('#DC2626');
    expect(component.settings().textConfig.color).toBe('#DC2626');
  });

  it('handles image watermark options (R-023, R-024)', () => {
    component.setActiveTab('image');
    expect(component.activeTab()).toBe('image');

    component.setImageWidthPercent(50);
    expect(component.settings().imageConfig.widthPercent).toBe(50);

    component.toggleRemoveWhiteBg();
    expect(component.settings().imageConfig.removeWhiteBg).toBe(true);

    component.setWhiteBgTolerance(25);
    expect(component.settings().imageConfig.tolerance).toBe(25);

    component.removeImage();
    expect(component.settings().imageConfig.imageDataUrl).toBeNull();
  });

  it('handles 3x3 position, margin, opacity, rotation, and layers (R-025, R-026, R-027, R-029)', () => {
    component.setPosition('top-right');
    expect(component.settings().common.position).toBe('top-right');

    component.setMarginMm(25);
    expect(component.settings().common.marginMm).toBe(25);

    component.setOpacity(75);
    expect(component.settings().common.opacity).toBe(75);

    component.setRotation(90);
    expect(component.settings().common.rotation).toBe(90);

    component.setLayer('below');
    expect(component.settings().common.layer).toBe('below');
  });

  it('handles page selection range parser and clamping (R-028)', () => {
    component.totalPages.set(10);
    component.setPageMode('custom');
    component.setCustomRange('1-3, 5, 8-10');

    expect(component.includedPagesCount()).toBe(7);
    expect(component.includedPageNumbers()).toEqual([1, 2, 3, 5, 8, 9, 10]);

    component.currentPage.set(2);
    expect(component.isCurrentPageIncluded()).toBe(true);

    component.currentPage.set(4);
    expect(component.isCurrentPageIncluded()).toBe(false);
  });

  it('validates primary button disabled state (R-030)', () => {
    // In text mode, empty text is invalid
    component.onTextChange('');
    expect(component.isTextValid()).toBe(false);
    expect(component.isSettingsValid()).toBe(false);

    // With text entered
    component.onTextChange('SAMPLE');
    expect(component.isTextValid()).toBe(true);
    expect(component.isSettingsValid()).toBe(true);

    // Switch to image tab without image -> invalid
    component.setActiveTab('image');
    expect(component.isImageValid()).toBe(false);
    expect(component.isSettingsValid()).toBe(false);

    // 0 pages in custom range -> invalid
    component.setActiveTab('text');
    component.setPageMode('custom');
    component.setCustomRange('99-100'); // total pages is 1
    expect(component.includedPagesCount()).toBe(0);
    expect(component.isSettingsValid()).toBe(false);
  });

  it('executes watermark processing, updates progress, and transitions to completed', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const validFile = new File([pdfBytes], 'test.pdf', { type: 'application/pdf' });
    await component.onFilesAdded([validFile]);

    component.applyQuickChip('CONFIDENTIAL');
    expect(component.isSettingsValid()).toBe(true);

    await component.executeWatermark();

    expect(mockProcessingService.processWatermark).toHaveBeenCalled();
    expect(component.currentState()).toBe('completed');
    expect(component.resultData()?.filename).toBe('test-watermarked.pdf');
    expect(mockLayoutService.showFooter).toHaveBeenCalled();
  });

  it('handles dynamic tokens insertion and mosaic configuration (R-032, R-033)', () => {
    component.onTextChange('Doc');
    component.insertToken('{page}');
    expect(component.settings().textConfig.text).toBe('Doc {page}');

    component.insertToken('{pages}');
    expect(component.settings().textConfig.text).toBe('Doc {page} {pages}');

    expect(component.settings().common.mosaic).toBe(false);
    component.toggleMosaic();
    expect(component.settings().common.mosaic).toBe(true);

    component.setHorizontalGapMm(35);
    expect(component.settings().common.horizontalGapMm).toBe(35);

    component.setVerticalGapMm(40);
    expect(component.settings().common.verticalGapMm).toBe(40);

    expect(component.settings().common.stagger).toBe(true);
    component.toggleStagger();
    expect(component.settings().common.stagger).toBe(false);
  });

  it('handles page filter presets for odd, even, first, and last (R-036)', () => {
    component.totalPages.set(10);
    component.setPageMode('all');

    component.setFilterPreset('odd');
    expect(component.settings().common.filterPreset).toBe('odd');
    expect(component.includedPagesCount()).toBe(5);
    expect(component.includedPageNumbers()).toEqual([1, 3, 5, 7, 9]);

    component.setFilterPreset('even');
    expect(component.includedPagesCount()).toBe(5);
    expect(component.includedPageNumbers()).toEqual([2, 4, 6, 8, 10]);

    component.setFilterPreset('first');
    expect(component.includedPagesCount()).toBe(1);
    expect(component.includedPageNumbers()).toEqual([1]);

    component.setFilterPreset('last');
    expect(component.includedPagesCount()).toBe(1);
    expect(component.includedPageNumbers()).toEqual([10]);
  });

  it('handles interactive position and rotation changes from preview (R-032, R-034)', () => {
    component.onPositionChange({ customXPercent: 70, customYPercent: 30, rotation: 90 });
    expect(component.settings().common.useCustomPosition).toBe(true);
    expect(component.settings().common.customXPercent).toBe(70);
    expect(component.settings().common.customYPercent).toBe(30);
    expect(component.settings().common.rotation).toBe(90);
  });

  it('manages device presets and "Remember my settings" (R-039)', async () => {
    component.newPresetName.set('Draft Stamp');
    component.applyQuickChip('DRAFT');
    await component.saveCurrentAsPreset();

    expect(component.presets().length).toBeGreaterThanOrEqual(1);
    const saved = component.presets().find(p => p.name === 'Draft Stamp');
    expect(saved).toBeDefined();

    // Modify settings then apply preset
    component.applyQuickChip('CONFIDENTIAL');
    expect(component.settings().textConfig.text).toBe('CONFIDENTIAL');

    component.applyPreset(saved!);
    expect(component.settings().textConfig.text).toBe('DRAFT');

    // Test delete preset
    await component.deletePreset(saved!.id);
    expect(component.presets().some(p => p.id === saved!.id)).toBe(false);

    // Test remember settings
    component.toggleRememberSettings(true);
    expect(component.isRememberSettings()).toBe(true);
    component.toggleRememberSettings(false);
    expect(component.isRememberSettings()).toBe(false);
  });

  it('detects Unicode scripts and flags color emojis (R-040)', () => {
    component.onTextChange('TOP SECRET 🚀');
    expect(component.hasEmoji()).toBe(true);

    component.onTextChange('गोपनीय दस्तऐवज');
    expect(component.hasEmoji()).toBe(false);
    expect(component.detectedScript()).toBe('indic');
    expect(component.scriptInfo().name).toContain('Indic');
  });

  it('handles single-file upload and document replacement with "Change file"', async () => {
    const f1 = new File([new Uint8Array([37, 80, 68, 70])], 'doc1.pdf', { type: 'application/pdf' });
    const f2 = new File([new Uint8Array([37, 80, 68, 70])], 'doc2.pdf', { type: 'application/pdf' });

    // When multiple files are provided, single-document workflow focuses on the first PDF
    await component.onFilesAdded([f1, f2]);
    expect(component.files().length).toBe(1);
    expect(component.selectedFileIndex()).toBe(0);
    expect(component.selectedFile()?.name).toBe('doc1.pdf');

    // Change file replaces the current document cleanly
    await component.onFilesAdded([f2]);
    expect(component.files().length).toBe(1);
    expect(component.selectedFileIndex()).toBe(0);
    expect(component.selectedFile()?.name).toBe('doc2.pdf');

    // Execute watermark export
    component.applyQuickChip('CONFIDENTIAL');
    await component.executeWatermark();

    expect(component.currentState()).toBe('completed');
    expect(component.resultData()?.url).toBeTruthy();
    expect(component.resultData()?.filename).toBe('test-watermarked.pdf');
  });

  it('toggles advanced artifact and optional content layer settings (R-042, R-043)', () => {
    expect(component.settings().common.markAsArtifact).toBe(true);
    component.toggleMarkAsArtifact();
    expect(component.settings().common.markAsArtifact).toBe(false);

    expect(component.settings().common.optionalContentLayer).toBe(false);
    component.toggleOptionalContentLayer();
    expect(component.settings().common.optionalContentLayer).toBe(true);
  });

  it('triggers digital signature warning modal and proceeds on confirmation (R-044)', async () => {
    const sigFile = new File([new Uint8Array([37, 80, 68, 70])], 'signed.pdf', { type: 'application/pdf' });
    await component.onFilesAdded([sigFile]);

    // Mock compliance report indicating digital signatures
    component.files.update(list => list.map(f => ({
      ...f,
      complianceReport: { ...f.complianceReport, hasSignatures: true }
    })));

    component.applyQuickChip('CONFIDENTIAL');
    await component.executeWatermark();

    // Modal should be shown, not completed immediately
    expect(component.showSignatureModal()).toBe(true);
    expect(component.currentState()).toBe('organize');

    // Confirm execution
    component.confirmSignatureAndExecute();
    expect(component.showSignatureModal()).toBe(false);
  });

  it('handles password-protected PDFs with unlock workflow (R-045)', async () => {
    mockSharedPdfjs.loadDocument.mockRejectedValueOnce({
      name: 'PasswordException',
      code: 'PASSWORD_REQUIRED',
      message: 'Password required'
    });

    const encFile = new File([new Uint8Array([37, 80, 68, 70])], 'locked.pdf', { type: 'application/pdf' });
    await component.onFilesAdded([encFile]);

    expect(component.showPasswordModal()).toBe(true);

    // Empty password rejected
    await component.submitPassword();
    expect(component.passwordError()).toContain('enter a password');

    // Incorrect password rejected
    mockSharedPdfjs.loadDocument.mockRejectedValueOnce(new Error('Incorrect password'));
    component.passwordInput.set('wrongpass');
    await component.submitPassword();
    expect(component.passwordError()).toContain('Incorrect password');

    // Correct password unlocks
    mockSharedPdfjs.loadDocument.mockResolvedValueOnce({
      numPages: 3,
      getPage: vi.fn()
    });
    component.passwordInput.set('correctpass');
    await component.submitPassword();

    expect(component.showPasswordModal()).toBe(false);
    expect(component.currentState()).toBe('organize');
    expect(component.files().length).toBeGreaterThanOrEqual(1);
  });

  it('cancels processing and returns to organize workspace', () => {
    component.currentState.set('processing');
    component.isProcessing.set(true);

    component.cancelProcessing();

    expect(mockProcessingService.cancel).toHaveBeenCalled();
    expect(component.isProcessing()).toBe(false);
    expect(component.currentState()).toBe('organize');
  });

  it('resets tool back to upload state', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const validFile = new File([pdfBytes], 'test.pdf', { type: 'application/pdf' });
    await component.onFilesAdded([validFile]);

    component.resetTool();

    expect(component.currentState()).toBe('upload');
    expect(component.selectedFile()).toBeNull();
    expect(component.fileBytes()).toBeNull();
    expect(component.resultData()).toBeNull();
    expect(mockLayoutService.showFooter).toHaveBeenCalled();
  });

  it('toggles thumbnails panel collapse state', () => {
    expect(component.isThumbnailsCollapsed()).toBe(false);
    component.toggleThumbnailsCollapse();
    expect(component.isThumbnailsCollapsed()).toBe(true);
    component.toggleThumbnailsCollapse();
    expect(component.isThumbnailsCollapsed()).toBe(false);
  });

  it('prevents deleting page when document has only 1 page', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const validFile = new File([pdfBytes], 'single-page.pdf', { type: 'application/pdf' });
    await component.onFilesAdded([validFile]);

    component.totalPages.set(1);
    if (component.files()[0]) {
      component.files()[0].totalPages = 1;
    }

    await component.deletePage(1);

    expect(component.errorMessage()).toContain('A document must have at least one page');
  });

  it('handles hold to compare press, release, quick click, and keyboard shortcut', () => {
    expect(component.isCompareActive()).toBe(false);

    // 1. Hold to compare: mousedown for 300ms, then mouseup
    component.onCompareHoldStart();
    expect(component.isCompareActive()).toBe(true);

    vi.spyOn(Date, 'now').mockReturnValueOnce(Date.now() + 300);
    component.onCompareHoldEnd();
    expect(component.isCompareActive()).toBe(false);

    // A click event that follows immediately after release should be ignored
    component.toggleCompare();
    expect(component.isCompareActive()).toBe(false);

    // 2. Quick click (<200ms): toggles compare mode ON
    component.onCompareHoldStart();
    component.onCompareHoldEnd();
    component.toggleCompare();
    expect(component.isCompareActive()).toBe(true);

    // Quick click again: toggles compare mode OFF
    component.onCompareHoldStart();
    component.onCompareHoldEnd();
    component.toggleCompare();
    expect(component.isCompareActive()).toBe(false);

    // 3. Keyboard shortcut 'C' toggles compare
    component.onWindowKeyDown(new KeyboardEvent('keydown', { key: 'c' }));
    expect(component.isCompareActive()).toBe(true);
    component.onWindowKeyDown(new KeyboardEvent('keydown', { key: 'C' }));
    expect(component.isCompareActive()).toBe(false);
  });

  it('updates zoom and executes onZoomFit', () => {
    component.onZoomChange(1.5);
    expect(component.zoom()).toBe(1.5);

    component.onZoomFit();
    // In test environment without preview ref it falls back to 1.0
    expect(component.zoom()).toBe(1.0);
  });
});
