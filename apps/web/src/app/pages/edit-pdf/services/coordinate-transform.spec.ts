import { TestBed } from '@angular/core/testing';
import { CoordinateTransformService } from './coordinate-transform';
import { ViewportNavigationService } from './viewport-navigation.service';
import { PageDimensions } from '../models/document-model';

describe('CoordinateTransformService', () => {
  let service: CoordinateTransformService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CoordinateTransformService]
    });
    service = TestBed.inject(CoordinateTransformService);
  });

  const a4Page: PageDimensions = {
    pageIndex: 0,
    widthPt: 595,
    heightPt: 842,
    rotation: 0
  };

  it('transforms screen point to PDF point and back at 0 deg rotation', () => {
    const screenPt = { x: 100, y: 150 };
    const pdfPt = service.screenPointToPdfPoint(screenPt, a4Page, 1.0);
    expect(pdfPt.xPt).toBe(100);
    expect(pdfPt.yPt).toBe(842 - 150);

    const roundTrip = service.pdfPointToScreenPoint(pdfPt, a4Page, 1.0);
    expect(roundTrip.x).toBeCloseTo(100);
    expect(roundTrip.y).toBeCloseTo(150);
  });

  it('correctly handles zoom scaling', () => {
    const screenPt = { x: 200, y: 300 };
    const zoom = 2.0;
    const pdfPt = service.screenPointToPdfPoint(screenPt, a4Page, zoom);
    expect(pdfPt.xPt).toBe(100);
    expect(pdfPt.yPt).toBe(842 - 150);

    const screenBack = service.pdfPointToScreenPoint(pdfPt, a4Page, zoom);
    expect(screenBack.x).toBeCloseTo(200);
    expect(screenBack.y).toBeCloseTo(300);
  });

  it('transforms rectangles bi-directionally', () => {
    const screenRect = { x: 50, y: 80, width: 200, height: 100 };
    const pdfRect = service.screenRectToPdfRect(screenRect, a4Page, 1.0);
    expect(pdfRect.widthPt).toBe(200);
    expect(pdfRect.heightPt).toBe(100);

    const roundTrip = service.pdfRectToScreenRect(pdfRect, a4Page, 1.0);
    expect(roundTrip.x).toBeCloseTo(50);
    expect(roundTrip.y).toBeCloseTo(80);
    expect(roundTrip.width).toBeCloseTo(200);
    expect(roundTrip.height).toBeCloseTo(100);
  });

  it('correctly calculates display dimensions for 90 deg rotation', () => {
    const rotatedPage: PageDimensions = { ...a4Page, rotation: 90 };
    const display = service.getPageDisplaySize(rotatedPage, 1.0);
    expect(display.width).toBe(842);
    expect(display.height).toBe(595);
  });

  it('fits wide PDF pages cleanly inside narrow mobile viewports without cropping', () => {
    const nav = new ViewportNavigationService();
    // 390px phone with 595pt A4 page -> ~0.61 zoom, while 1440px desktop stays 1.0
    const mobileZoom = nav.computeFitWidthZoom(595, 390);
    expect(mobileZoom).toBeGreaterThan(0.5);
    expect(mobileZoom).toBeLessThan(0.7);
    expect(595 * mobileZoom).toBeLessThanOrEqual(370);
    expect(nav.computeFitWidthZoom(595, 1440)).toBe(1.0);
    expect(nav.resetZoom(595, 390)).toBe(mobileZoom);
  });
});

