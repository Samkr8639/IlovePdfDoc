import { TestBed } from '@angular/core/testing';
import { PdfTextExtractionService } from './pdf-text-extraction.service';

describe('PdfTextExtractionService', () => {
  let service: PdfTextExtractionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PdfTextExtractionService]
    });
    service = TestBed.inject(PdfTextExtractionService);
  });

  it('correctly builds line segment and computes horizontal bounds and font size', () => {
    const items = [
      { text: 'Hello', x: 10, width: 25, fontSize: 12, height: 12 },
      { text: 'World', x: 40, width: 25, fontSize: 12, height: 12 }
    ];
    const segment = service.buildLineSegment(items, 100);
    expect(segment.text).toBe('Hello World');
    expect(segment.x0).toBe(10);
    expect(segment.x1).toBe(65);
    expect(segment.baselineY).toBe(100);
    expect(segment.fontSize).toBe(12);
  });

  it('identifies bullet lines and section headings correctly', () => {
    expect(service.isBulletLine('• Item 1')).toBe(true);
    expect(service.isBulletLine('- Dash item')).toBe(true);
    expect(service.isBulletLine('Normal sentence')).toBe(false);

    expect(service.isSectionHeading('OVERVIEW')).toBe(true);
    expect(service.isSectionHeading('TERMS AND CONDITIONS')).toBe(true);
    expect(service.isSectionHeading('Overview and Notes')).toBe(false);
  });

  it('clusters adjacent line segments into paragraph blocks', () => {
    const line1 = {
      text: 'First line of paragraph.',
      x0: 50,
      x1: 250,
      width: 200,
      baselineY: 500,
      fontSize: 12,
      y0: 497,
      y1: 509
    };
    const line2 = {
      text: 'Second line of paragraph.',
      x0: 50,
      x1: 245,
      width: 195,
      baselineY: 486, // deltaY = 14pt (within 12*0.8 and 12*1.8)
      fontSize: 12,
      y0: 483,
      y1: 495
    };
    const blocks = service.clusterLineSegmentsIntoBlocks([line1, line2]);
    expect(blocks.length).toBe(1);
    expect(blocks[0].lines.length).toBe(2);
  });
});
