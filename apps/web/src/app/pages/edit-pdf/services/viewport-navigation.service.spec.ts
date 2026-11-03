import { TestBed } from '@angular/core/testing';
import { ViewportNavigationService } from './viewport-navigation.service';

describe('ViewportNavigationService', () => {
  let service: ViewportNavigationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ViewportNavigationService]
    });
    service = TestBed.inject(ViewportNavigationService);
  });

  it('clamps and updates zoom levels within bounds', () => {
    expect(service.zoomIn(1.0)).toBe(1.15);
    expect(service.zoomOut(1.0)).toBe(0.85);
    expect(service.resetZoom()).toBe(1.0);
    expect(service.zoomIn(3.0)).toBe(3.0);
    expect(service.zoomOut(0.25)).toBe(0.25);
  });

  it('navigates page indices within bounds', () => {
    expect(service.nextPage(0, 5)).toBe(1);
    expect(service.nextPage(4, 5)).toBe(4);
    expect(service.prevPage(2)).toBe(1);
    expect(service.prevPage(0)).toBe(0);
    expect(service.clampPageIndex(10, 3)).toBe(2);
  });
});

