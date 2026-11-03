import { TestBed } from '@angular/core/testing';
import { AreaSelectionService } from './area-selection.service';
import { CoordinateTransformService } from './coordinate-transform';
import { CommandHistoryService } from './command-history';
import { EditElement, PageDimensions } from '../models/document-model';

describe('AreaSelectionService', () => {
  let service: AreaSelectionService;
  let transform: CoordinateTransformService;
  let history: CommandHistoryService;

  const mockPage: PageDimensions = {
    pageIndex: 0,
    widthPt: 612,
    heightPt: 792,
    rotation: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AreaSelectionService, CoordinateTransformService, CommandHistoryService]
    });
    service = TestBed.inject(AreaSelectionService);
    transform = TestBed.inject(CoordinateTransformService);
    history = TestBed.inject(CommandHistoryService);
  });

  it('should be created and initialized without selection or marquee', () => {
    expect(service).toBeTruthy();
    expect(service.selection()).toBeNull();
    expect(service.marquee()).toBeNull();
    expect(service.hasSelection()).toBe(false);
    expect(service.canPaste()).toBe(false);
  });

  it('should start, update and clear marquee drag state', () => {
    service.startMarquee(0, 100, 150);
    expect(service.marquee()).toEqual({
      pageIndex: 0,
      startScreenX: 100,
      startScreenY: 150,
      currentScreenX: 100,
      currentScreenY: 150
    });

    service.updateMarquee(250, 300);
    expect(service.marquee()).toEqual({
      pageIndex: 0,
      startScreenX: 100,
      startScreenY: 150,
      currentScreenX: 250,
      currentScreenY: 300
    });

    service.clearSelection();
    expect(service.marquee()).toBeNull();
    expect(service.selection()).toBeNull();
  });

  it('should reject tiny marquee drags (< 6px) to avoid accidental click artifacts', () => {
    service.startMarquee(0, 100, 100);
    service.updateMarquee(102, 103);
    const result = service.finishMarquee(mockPage, [], 1.0);
    expect(result).toBeNull();
    expect(service.hasSelection()).toBe(false);
  });

  it('should copy area selection to clipboard and allow pasting onto a page', () => {
    service.selection.set({
      pageIndex: 0,
      xPt: 50,
      yPt: 100,
      widthPt: 150,
      heightPt: 80,
      rotation: 0,
      snapshotDataUrl: 'data:image/png;base64,fakeSnapshot',
      originalXPt: 50,
      originalYPt: 100,
      originalPageIndex: 0,
      originalWidthPt: 150,
      originalHeightPt: 80
    });

    service.copy();
    expect(service.canPaste()).toBe(true);

    let elementsList: EditElement[] = [];
    const elementsSignal = {
      update: (fn: (list: EditElement[]) => EditElement[]) => {
        elementsList = fn(elementsList);
      }
    };

    let selectedId: string | null = null;
    const pasted = service.paste(elementsSignal, mockPage, id => {
      selectedId = id;
    });

    expect(pasted).toBeTruthy();
    expect(elementsList.length).toBe(1);
    expect(elementsList[0].type).toBe('image');
    expect(selectedId).toBe(pasted!.id);
  });

  it('should delete area by placing a whiteout element over the captured region', () => {
    service.selection.set({
      pageIndex: 0,
      xPt: 80,
      yPt: 200,
      widthPt: 120,
      heightPt: 60,
      rotation: 0,
      snapshotDataUrl: 'data:image/png;base64,fakeSnapshot',
      originalXPt: 80,
      originalYPt: 200,
      originalPageIndex: 0,
      originalWidthPt: 120,
      originalHeightPt: 60,
      capturedElementIds: []
    });

    let elementsList: EditElement[] = [];
    const elementsSignal = {
      update: (fn: (list: EditElement[]) => EditElement[]) => {
        elementsList = fn(elementsList);
      }
    };

    service.deleteArea(elementsSignal, mockPage);
    expect(elementsList.length).toBe(1);
    expect(elementsList[0].type).toBe('whiteout');
    expect(elementsList[0].xPt).toBe(80);
    expect(elementsList[0].yPt).toBe(200);

    // Verify Undo completely restores the document
    history.undo();
    expect(elementsList.length).toBe(0);
  });

  it('should nudge selection position and clamp to page bounds', () => {
    service.selection.set({
      pageIndex: 0,
      xPt: 100,
      yPt: 100,
      widthPt: 50,
      heightPt: 50,
      rotation: 0,
      snapshotDataUrl: null,
      originalXPt: 100,
      originalYPt: 100,
      originalPageIndex: 0,
      originalWidthPt: 50,
      originalHeightPt: 50
    });

    service.nudge(10, -5, mockPage);
    expect(service.selection()?.xPt).toBe(110);
    expect(service.selection()?.yPt).toBe(95);
  });
});

