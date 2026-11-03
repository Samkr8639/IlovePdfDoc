import { TestBed } from '@angular/core/testing';
import { PdfRenderingService } from './pdf-rendering.service';
import { CoordinateTransformService } from './coordinate-transform';
import { PageDimensions, TextEditElement } from '../models/document-model';

describe('PdfRenderingService', () => {
  let service: PdfRenderingService;
  const mockPage: PageDimensions = {
    pageIndex: 0,
    widthPt: 600,
    heightPt: 800,
    rotation: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PdfRenderingService, CoordinateTransformService]
    });
    service = TestBed.inject(PdfRenderingService);
  });

  it('draws whiteout rectangle over original text bounding box', () => {
    const textEl: TextEditElement = {
      id: 'text-1',
      pageIndex: 0,
      type: 'text',
      xPt: 50,
      yPt: 100,
      widthPt: 200,
      heightPt: 20,
      fontFamily: 'Inter',
      fontSizePt: 12,
      color: '#000000',
      text: 'Original Text'
    };

    const mockCtx = {
      fillStyle: '',
      fillRect: vi.fn()
    } as unknown as CanvasRenderingContext2D;

    service.whiteoutOriginalText(textEl, mockCtx, mockPage, 1, 1);
    expect(mockCtx.fillStyle).toBe('#ffffff');
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });
});
