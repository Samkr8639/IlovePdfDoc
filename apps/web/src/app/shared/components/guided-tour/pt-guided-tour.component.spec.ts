import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PtGuidedTourComponent } from './pt-guided-tour.component';
import { GuidedTourService, TourConfig } from '../../../core/services/guided-tour/guided-tour.service';

describe('PtGuidedTourComponent', () => {
  let component: PtGuidedTourComponent;
  let fixture: ComponentFixture<PtGuidedTourComponent>;
  let tourService: GuidedTourService;

  const mockConfig: TourConfig = {
    tourId: 'spec-tour',
    steps: [
      {
        id: 'step-1',
        targetSelector: '#target1',
        title: 'Step 1 Title',
        content: 'Step 1 Description'
      },
      {
        id: 'step-2',
        targetSelector: '#target2',
        title: 'Step 2 Title',
        content: 'Step 2 Description'
      },
      {
        id: 'step-3',
        targetSelector: '#target3',
        title: 'Step 3 Title',
        content: 'Step 3 Description'
      }
    ]
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PtGuidedTourComponent],
      providers: [GuidedTourService]
    }).compileComponents();

    fixture = TestBed.createComponent(PtGuidedTourComponent);
    component = fixture.componentInstance;
    tourService = TestBed.inject(GuidedTourService);
    fixture.detectChanges();
  });

  it('does not render card when tour is inactive', () => {
    expect(tourService.isActive()).toBe(false);
    const card = fixture.nativeElement.querySelector('.guided-tour-popover-card');
    expect(card).toBeNull();
  });

  it('renders card and displays correct step info when tour starts', () => {
    tourService.startTour(mockConfig);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.guided-tour-popover-card');
    expect(card).not.toBeNull();

    const badge = fixture.nativeElement.querySelector('.step-counter-pill');
    expect(badge.textContent).toContain('Step 1 of 3');

    const title = fixture.nativeElement.querySelector('.popover-title');
    expect(title.textContent).toBe('Step 1 Title');

    const desc = fixture.nativeElement.querySelector('.popover-text');
    expect(desc.textContent).toBe('Step 1 Description');

    const skipTourBtn = fixture.nativeElement.querySelector('.btn-skip-tour');
    expect(skipTourBtn).not.toBeNull();
    const skipRestBtn = fixture.nativeElement.querySelector('.btn-skip-rest');
    expect(skipRestBtn).toBeNull(); // not on step 2 yet
  });

  it('shows "Skip the rest" button after step 2', () => {
    tourService.startTour(mockConfig);
    tourService.nextStep(); // step index 1 (Step 2)
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.step-counter-pill');
    expect(badge.textContent).toContain('Step 2 of 3');

    const skipRestBtn = fixture.nativeElement.querySelector('.btn-skip-rest');
    expect(skipRestBtn).not.toBeNull();
    expect(skipRestBtn.textContent).toContain('Skip the rest');
  });

  it('advances through steps with Next button and closes on Finish', () => {
    tourService.startTour(mockConfig);
    fixture.detectChanges();

    const nextBtn = fixture.nativeElement.querySelector('.btn-tour-next');
    expect(nextBtn.textContent).toContain('Next');

    nextBtn.click();
    fixture.detectChanges();
    expect(tourService.currentStepIndex()).toBe(1);

    nextBtn.click();
    fixture.detectChanges();
    expect(tourService.currentStepIndex()).toBe(2);

    const finishBtn = fixture.nativeElement.querySelector('.btn-tour-next');
    expect(finishBtn.textContent).toContain('Finish');

    finishBtn.click();
    fixture.detectChanges();
    expect(tourService.isActive()).toBe(false);
  });

  it('closes cleanly on Escape key without error', () => {
    tourService.startTour(mockConfig);
    fixture.detectChanges();
    expect(tourService.isActive()).toBe(true);

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);
    fixture.detectChanges();

    expect(tourService.isActive()).toBe(false);
  });
});
