import { TestBed } from '@angular/core/testing';
import { FreehandDrawingService } from './freehand-drawing.service';
import { CoordinateTransformService } from './coordinate-transform';
import { CanvasInteractionService } from './canvas-interaction.service';
import { PageDimensions } from '../models/document-model';

describe('FreehandDrawingService', () => {
  let service: FreehandDrawingService;
  const mockPage: PageDimensions = {
    pageIndex: 0,
    widthPt: 600,
    heightPt: 800,
    rotation: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FreehandDrawingService, CoordinateTransformService, CanvasInteractionService]
    });
    service = TestBed.inject(FreehandDrawingService);
  });

  it('manages drawing lifecycle and produces DrawEditElement', () => {
    const startPath = service.startDrawing(10, 10);
    expect(startPath).toContain('M 10 10');

    const next = service.moveDrawing(30, 40);
    expect(next).toBeTruthy();

    const element = service.finishDrawing(mockPage, 1.0, '#ff0000', 3);
    expect(element).not.toBeNull();
    expect(element?.type).toBe('draw');
    expect(element?.strokeColor).toBe('#ff0000');
    expect(element?.strokeWidth).toBe(3);
    expect(element?.points.length).toBe(2);
  });

  it('manages highlight area drag lifecycle and produces HighlightEditElement', () => {
    const mockRect = { left: 0, top: 0, width: 600, height: 800 } as DOMRect;
    const initial = service.startHighlightDrag(0, 50, 100, mockRect);
    expect(initial.x).toBe(50);
    expect(initial.y).toBe(100);

    const moved = service.moveHighlightDrag(150, 140, mockRect);
    expect(moved).not.toBeNull();
    expect(moved?.width).toBe(100);
    expect(moved?.height).toBe(40);

    const hl = service.finishHighlightDrag(moved, mockPage, 1.0, '#ffff00', 0.4);
    expect(hl).not.toBeNull();
    expect(hl?.type).toBe('highlight');
    expect(hl?.color).toBe('#ffff00');
    expect(hl?.opacity).toBe(0.4);
  });
});
