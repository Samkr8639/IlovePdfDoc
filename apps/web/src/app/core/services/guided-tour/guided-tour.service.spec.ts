import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GuidedTourService, TourConfig } from './guided-tour.service';

describe('GuidedTourService', () => {
  let service: GuidedTourService;

  const mockTourConfig: TourConfig = {
    tourId: 'test-tour',
    steps: [
      {
        id: 'step-1',
        targetSelector: '#step1El',
        title: 'Step 1 Title',
        content: 'Step 1 Content'
      },
      {
        id: 'step-2',
        targetSelector: '#step2El',
        title: 'Step 2 Title',
        content: 'Step 2 Content'
      },
      {
        id: 'step-3',
        targetSelector: '#step3El',
        title: 'Step 3 Title',
        content: 'Step 3 Content'
      }
    ]
  };

  beforeEach(() => {
    localStorage.clear();
    service = new GuidedTourService();
  });

  it('initializes with inactive state and step 0', () => {
    expect(service.isActive()).toBe(false);
    expect(service.currentStepIndex()).toBe(0);
    expect(service.currentStep()).toBeNull();
    expect(service.totalSteps()).toBe(0);
  });

  it('starts tour when not previously completed', () => {
    const started = service.startTour(mockTourConfig);
    expect(started).toBe(true);
    expect(service.isActive()).toBe(true);
    expect(service.currentStepIndex()).toBe(0);
    expect(service.currentStep()?.id).toBe('step-1');
    expect(service.totalSteps()).toBe(3);
    expect(service.isFirstStep()).toBe(true);
    expect(service.isLastStep()).toBe(false);
  });

  it('does not start tour if previously completed unless forced', () => {
    service.markTourCompleted('test-tour');
    expect(service.isTourCompleted('test-tour')).toBe(true);

    const startedNormal = service.startTour(mockTourConfig);
    expect(startedNormal).toBe(false);
    expect(service.isActive()).toBe(false);

    const startedForced = service.startTour(mockTourConfig, true);
    expect(startedForced).toBe(true);
    expect(service.isActive()).toBe(true);
  });

  it('advances steps cleanly and tracks isLastStep and canSkipRest', () => {
    service.startTour(mockTourConfig);

    expect(service.canSkipRest()).toBe(false); // Step 1 (index 0)

    service.nextStep();
    expect(service.currentStepIndex()).toBe(1);
    expect(service.currentStep()?.id).toBe('step-2');
    expect(service.canSkipRest()).toBe(true); // Step 2 (index 1) - Skip the rest available!

    service.nextStep();
    expect(service.currentStepIndex()).toBe(2);
    expect(service.currentStep()?.id).toBe('step-3');
    expect(service.isLastStep()).toBe(true);
  });

  it('navigates backwards with prevStep', () => {
    service.startTour(mockTourConfig);
    service.nextStep();
    service.nextStep();
    expect(service.currentStepIndex()).toBe(2);

    service.prevStep();
    expect(service.currentStepIndex()).toBe(1);

    service.prevStep();
    expect(service.currentStepIndex()).toBe(0);
    expect(service.isFirstStep()).toBe(true);
  });

  it('skips tour and records completion in localStorage', () => {
    const onSkip = vi.fn();
    service.startTour({ ...mockTourConfig, onSkip });

    service.skipTour();
    expect(service.isActive()).toBe(false);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(service.isTourCompleted('test-tour')).toBe(true);
  });

  it('skips the rest after step 2 and records completion in localStorage', () => {
    const onSkip = vi.fn();
    service.startTour({ ...mockTourConfig, onSkip });
    service.nextStep(); // on step 2

    expect(service.canSkipRest()).toBe(true);
    service.skipRest();
    expect(service.isActive()).toBe(false);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(service.isTourCompleted('test-tour')).toBe(true);
  });

  it('completes tour on finish and calls onComplete', () => {
    const onComplete = vi.fn();
    service.startTour({ ...mockTourConfig, onComplete });
    service.nextStep();
    service.nextStep();
    expect(service.isLastStep()).toBe(true);

    service.completeTour();
    expect(service.isActive()).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(service.isTourCompleted('test-tour')).toBe(true);
  });
});
