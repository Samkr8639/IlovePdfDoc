import { TestBed } from '@angular/core/testing';
import { ElementOperationsService } from './element-operations.service';
import { EditElement, PageDimensions } from '../models/document-model';

describe('ElementOperationsService', () => {
  let service: ElementOperationsService;
  const mockPage: PageDimensions = {
    pageIndex: 0,
    widthPt: 600,
    heightPt: 800,
    rotation: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ElementOperationsService]
    });
    service = TestBed.inject(ElementOperationsService);
  });

  it('creates text, shape, and highlight elements with correct defaults and positioning', () => {
    const textEl = service.createTextElement(mockPage, {
      fontFamily: 'Inter',
      fontSizePt: 14,
      color: '#000000'
    });
    expect(textEl.type).toBe('text');
    expect(textEl.fontFamily).toBe('Inter');
    expect(textEl.pageIndex).toBe(0);

    const shapeEl = service.createShapeElement(mockPage, {
      shapeType: 'rectangle',
      strokeColor: '#ff0000',
      fillColor: 'transparent',
      strokeWidth: 2
    });
    expect(shapeEl.type).toBe('shape');
    expect(shapeEl.shapeType).toBe('rectangle');
    expect(shapeEl.xPt).toBe((600 - 160) / 2);

    const hlEl = service.createHighlightElement(mockPage, {
      color: '#ffff00',
      opacity: 0.35
    });
    expect(hlEl.type).toBe('highlight');
    expect(hlEl.opacity).toBe(0.35);
  });

  it('duplicates, brings to front, sends to back, and deletes elements correctly', () => {
    const el1 = service.createHighlightElement(mockPage, { color: '#ffff00', opacity: 0.35 });
    const el2 = service.createHighlightElement(mockPage, { color: '#00ff00', opacity: 0.35 });

    let list: EditElement[] = [el1, el2];
    expect(list[0].id).toBe(el1.id);

    // Bring el1 to front
    list = service.bringToFront(list, el1.id);
    expect(list[1].id).toBe(el1.id);

    // Send el1 to back
    list = service.sendToBack(list, el1.id);
    expect(list[0].id).toBe(el1.id);

    // Duplicate
    const dup = service.duplicateElement(el1);
    expect(dup.id).not.toBe(el1.id);
    expect(dup.xPt).toBe(el1.xPt + 20);

    // Delete
    list = service.deleteElement(list, el1.id);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(el2.id);
  });
});
