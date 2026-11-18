/**
 * Watermark Thumbnails Panel Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WatermarkThumbnailsPanelComponent } from './watermark-thumbnails-panel.component';

describe('WatermarkThumbnailsPanelComponent', () => {
  let component: WatermarkThumbnailsPanelComponent;
  let fixture: ComponentFixture<WatermarkThumbnailsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatermarkThumbnailsPanelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(WatermarkThumbnailsPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('totalPages', 3);
    fixture.componentRef.setInput('currentPage', 1);
    fixture.detectChanges();
  });

  it('creates the thumbnails panel component', () => {
    expect(component).toBeTruthy();
  });

  it('computes page numbers array according to totalPages', () => {
    expect(component.pagesList()).toEqual([1, 2, 3]);

    fixture.componentRef.setInput('totalPages', 5);
    fixture.detectChanges();
    expect(component.pagesList()).toEqual([1, 2, 3, 4, 5]);
  });

  it('emits selectPage when a thumbnail is clicked', () => {
    const selectSpy = vi.fn();
    component.selectPage.subscribe(selectSpy);

    const el = fixture.nativeElement as HTMLElement;
    const secondThumb = el.querySelector('#thumb-page-2') as HTMLElement;
    expect(secondThumb).toBeTruthy();

    secondThumb.click();
    expect(selectSpy).toHaveBeenCalledWith(2);
  });

  it('emits rotatePage when rotate action button is clicked', () => {
    const rotateSpy = vi.fn();
    component.rotatePage.subscribe(rotateSpy);

    const el = fixture.nativeElement as HTMLElement;
    const rotateBtn = el.querySelector('#thumb-page-2 .card-action-btn:not(.danger)') as HTMLButtonElement;
    expect(rotateBtn).toBeTruthy();

    rotateBtn.click();
    expect(rotateSpy).toHaveBeenCalledWith(2);
  });

  it('emits deletePage when delete action button is clicked', () => {
    const deleteSpy = vi.fn();
    component.deletePage.subscribe(deleteSpy);

    const el = fixture.nativeElement as HTMLElement;
    const deleteBtn = el.querySelector('#thumb-page-2 .card-action-btn.danger') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();

    deleteBtn.click();
    expect(deleteSpy).toHaveBeenCalledWith(2);
  });

  it('emits toggleCollapse when collapse toggle button is clicked', () => {
    const collapseSpy = vi.fn();
    component.toggleCollapse.subscribe(collapseSpy);

    const el = fixture.nativeElement as HTMLElement;
    const toggleBtn = el.querySelector('.collapse-toggle-btn') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();

    toggleBtn.click();
    expect(collapseSpy).toHaveBeenCalled();
  });

  it('marks current page thumbnail with active class', () => {
    fixture.componentRef.setInput('currentPage', 2);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const activeThumb = el.querySelector('.thumbnail-card.active');
    expect(activeThumb?.id).toBe('thumb-page-2');
  });
});
