import { TestBed } from '@angular/core/testing';
import { OcrWorkflowService } from './ocr-workflow.service';
import { EditPdfOcrResult } from '@paperflow/contracts';

describe('OcrWorkflowService', () => {
  let service: OcrWorkflowService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OcrWorkflowService]
    });
    service = TestBed.inject(OcrWorkflowService);
  });

  it('validates page range for current, all, and custom ranges', () => {
    expect(service.validatePageRange('current', '', 5).valid).toBe(true);
    expect(service.validatePageRange('all', '', 5).valid).toBe(true);
    expect(service.validatePageRange('custom', '1-3, 5', 5).valid).toBe(true);

    const invalid = service.validatePageRange('custom', '1-10', 5);
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain('Invalid range');
  });

  it('parses page indices correctly', () => {
    expect(service.parsePageIndices('current', '', 5, 2)).toEqual([2]);
    expect(service.parsePageIndices('all', '', 3, 0)).toEqual([0, 1, 2]);
    expect(service.parsePageIndices('custom', '1-2, 4', 5, 0)).toEqual([0, 1, 3]);
  });

  it('converts searchable OCR results to OcrTextLayerElement', () => {
    const mockResult: EditPdfOcrResult = {
      jobId: 'job-1',
      language: 'eng',
      averageConfidence: 90,
      warnings: [],
      pages: [
        {
          index: 0,
          widthPt: 600,
          heightPt: 800,
          rotation: 0,
          lines: [
            {
              text: 'Invoice 101',
              bbox: [50, 700, 150, 720],
              baselineY: 710,
              fontSizePt: 14,
              confidence: 95,
              words: [
                { text: 'Invoice', bbox: [50, 700, 100, 720], confidence: 95 },
                { text: '101', bbox: [105, 700, 150, 720], confidence: 55 } // low confidence
              ]
            }
          ]
        }
      ]
    };

    const out = service.convertOcrResultToElements(mockResult, [0], 'searchable');
    expect(out.elements.length).toBe(1);
    expect(out.elements[0].type).toBe('ocr-layer');
    expect(out.lowConfidenceWords.length).toBe(1);
    expect(out.lowConfidenceWords[0].text).toBe('101');
  });
});
