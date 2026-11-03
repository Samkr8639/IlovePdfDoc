import { TestBed } from '@angular/core/testing';
import { CanvasInteractionService } from './canvas-interaction.service';
import { CoordinateTransformService } from './coordinate-transform';
import { PageDimensions } from '../models/document-model';

describe('CanvasInteractionService', () => {
  let service: CanvasInteractionService;
  const mockPage: PageDimensions = {
    pageIndex: 0,
    widthPt: 600,
    heightPt: 800,
    rotation: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CanvasInteractionService, CoordinateTransformService]
    });
    service = TestBed.inject(CanvasInteractionService);
  });

  it('calculates drag move deltas correctly', () => {
    const moved = service.calculateDragMove(100, -50, 1.0, { xPt: 200, yPt: 300 });
    expect(moved.xPt).toBe(300);
    expect(moved.yPt).toBe(350);
  });

  it('generates smooth spline SVG path from points', () => {
    const pts = [
      { x: 10, y: 10 },
      { x: 20, y: 30 },
      { x: 40, y: 50 }
    ];
    const path = service.smoothSplinePoints(pts);
    expect(path).toContain('M 10 10');
    expect(path).toContain('Q 20 30');
    expect(path).toContain('L 40 50');
  });

  it('calculates resize rect for standard boxes', () => {
    const startScreen = { x: 50, y: 50, width: 100, height: 100 };
    const resized = service.calculateResize('se', 20, 30, startScreen, false, mockPage, 1.0);
    expect(resized.widthPt).toBe(120);
    expect(resized.heightPt).toBe(130);
  });
});
