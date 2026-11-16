import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WatermarkPreviewComponent } from './watermark-preview.component';
import { WatermarkLayoutService } from '../../../../core/services/watermark-pdf/watermark-layout.service';
import { WATERMARK_DEFAULT_SETTINGS } from '@paperflow/contracts';

describe('WatermarkPreviewComponent', () => {
  let component: WatermarkPreviewComponent;
  let fixture: ComponentFixture<WatermarkPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatermarkPreviewComponent],
      providers: [WatermarkLayoutService]
    }).compileComponents();

    fixture = TestBed.createComponent(WatermarkPreviewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('settings', { ...WATERMARK_DEFAULT_SETTINGS });
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('totalPages', 5);
    fixture.componentRef.setInput('isPageIncluded', true);
    fixture.detectChanges();
  });

  it('creates the watermark preview component', () => {
    expect(component).toBeTruthy();
  });

  it('computes accessible preview aria-label accurately', () => {
    const label = component.previewAriaLabel();
    expect(label).toContain('Page 1 of 5');
    expect(label).toContain('CONFIDENTIAL');
    expect(label).toContain('45 degrees');
    expect(label).toContain('center');
  });

  it('appends "(Not included)" to aria-label when page is excluded', () => {
    fixture.componentRef.setInput('isPageIncluded', false);
    fixture.detectChanges();
    expect(component.previewAriaLabel()).toContain('(Not included)');
  });

  it('toggles compare mode and updates isCompareActive', () => {
    expect(component.isCompareActive()).toBe(false);

    component.onCompareHoldStart();
    expect(component.isCompareActive()).toBe(true);

    component.onCompareHoldEnd();
    expect(component.isCompareActive()).toBe(false);

    component.toggleCompare();
    expect(component.isCompareActive()).toBe(true);

    component.toggleCompare();
    expect(component.isCompareActive()).toBe(false);
  });

  it('emits pageChange events on navigation', () => {
    const pageSpy = vi.fn();
    component.pageChange.subscribe(pageSpy);

    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('totalPages', 3);

    component.goToNextPage();
    expect(pageSpy).toHaveBeenCalledWith(2);

    fixture.componentRef.setInput('currentPage', 2);
    component.goToPrevPage();
    expect(pageSpy).toHaveBeenCalledWith(1);
  });

  it('emits zoomChange events on zoom in and zoom out', () => {
    const zoomSpy = vi.fn();
    component.zoomChange.subscribe(zoomSpy);

    fixture.componentRef.setInput('zoom', 1.0);
    component.zoomIn();
    expect(zoomSpy).toHaveBeenCalledWith(1.25);

    fixture.componentRef.setInput('zoom', 1.0);
    component.zoomOut();
    expect(zoomSpy).toHaveBeenCalledWith(0.75);

    component.resetZoom();
    expect(zoomSpy).toHaveBeenCalledWith(1.0);
  });

  it('applies correct z-indices for Over vs Below layer modes', () => {
    // Default is Over: pageCanvas z-index 1, watermarkCanvas z-index 2
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const pageCanvas = el.querySelector('.pdf-page-canvas') as HTMLCanvasElement;
    const wmCanvas = el.querySelector('.watermark-overlay-canvas') as HTMLCanvasElement;

    expect(pageCanvas.style.zIndex).toBe('1');
    expect(wmCanvas.style.zIndex).toBe('2');

    // Change to Below: watermarkCanvas z-index 1, pageCanvas z-index 2
    fixture.componentRef.setInput('settings', {
      ...component.settings(),
      common: {
        ...component.settings().common,
        layer: 'below'
      }
    });
    fixture.detectChanges();

    expect(wmCanvas.style.zIndex).toBe('1');
    expect(pageCanvas.style.zIndex).toBe('2');
  });
});
