import { Injectable, signal, computed } from '@angular/core';

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  fallbackPlacement?: 'top' | 'bottom' | 'left' | 'right';
  actionBeforeStep?: () => void | Promise<void>;
}

export interface TourConfig {
  tourId: string;
  steps: TourStep[];
  force?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

@Injectable({
  providedIn: 'root'
})
export class GuidedTourService {
  private readonly STORAGE_PREFIX = 'pt_tour_completed_';

  // Reactive State via Signals
  readonly isActive = signal<boolean>(false);
  readonly currentStepIndex = signal<number>(0);
  readonly config = signal<TourConfig | null>(null);
  readonly targetRect = signal<SpotlightRect | null>(null);

  // Computed Properties
  readonly currentStep = computed<TourStep | null>(() => {
    const cfg = this.config();
    const idx = this.currentStepIndex();
    if (!cfg || !cfg.steps || idx < 0 || idx >= cfg.steps.length) {
      return null;
    }
    return cfg.steps[idx];
  });

  readonly totalSteps = computed<number>(() => {
    return this.config()?.steps?.length || 0;
  });

  readonly isFirstStep = computed<boolean>(() => {
    return this.currentStepIndex() === 0;
  });

  readonly isLastStep = computed<boolean>(() => {
    const total = this.totalSteps();
    return total > 0 && this.currentStepIndex() === total - 1;
  });

  /**
   * Returns true on or after step 2 (0-indexed step >= 1) to offer "Skip the rest"
   */
  readonly canSkipRest = computed<boolean>(() => {
    return this.currentStepIndex() >= 1;
  });

  private resizeListener?: () => void;
  private scrollListener?: () => void;

  /**
   * Checks if this tour was previously completed or skipped in localStorage
   */
  isTourCompleted(tourId: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      return window.localStorage.getItem(this.STORAGE_PREFIX + tourId) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Marks a tour as completed or skipped in localStorage
   */
  markTourCompleted(tourId: string): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(this.STORAGE_PREFIX + tourId, 'true');
    } catch {}
  }

  /**
   * Resets tour completion state
   */
  resetTour(tourId: string): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(this.STORAGE_PREFIX + tourId);
    } catch {}
  }

  /**
   * Starts a tour. If already completed and force is false, does not start.
   */
  startTour(tourConfig: TourConfig, force?: boolean): boolean {
    if (!tourConfig || !tourConfig.steps || tourConfig.steps.length === 0) {
      return false;
    }

    const shouldForce = force !== undefined ? force : !!tourConfig.force;
    if (!shouldForce && this.isTourCompleted(tourConfig.tourId)) {
      return false;
    }

    this.config.set(tourConfig);
    this.currentStepIndex.set(0);
    this.isActive.set(true);

    this.setupWindowListeners();
    this.measureCurrentTarget();

    return true;
  }

  /**
   * Moves to the next tour step or completes if on last step
   */
  nextStep(): void {
    if (!this.isActive()) return;

    const nextIndex = this.currentStepIndex() + 1;
    if (nextIndex < this.totalSteps()) {
      this.currentStepIndex.set(nextIndex);
      this.measureCurrentTarget();
    } else {
      this.completeTour();
    }
  }

  /**
   * Moves to previous tour step
   */
  prevStep(): void {
    if (!this.isActive()) return;

    const prevIndex = this.currentStepIndex() - 1;
    if (prevIndex >= 0) {
      this.currentStepIndex.set(prevIndex);
      this.measureCurrentTarget();
    }
  }

  /**
   * User chooses to skip from the beginning
   */
  skipTour(): void {
    const cfg = this.config();
    if (cfg?.tourId) {
      this.markTourCompleted(cfg.tourId);
    }
    cfg?.onSkip?.();
    this.endTour();
  }

  /**
   * User chooses to skip the rest after step 2
   */
  skipRest(): void {
    this.skipTour();
  }

  /**
   * User completes the tour through the final step
   */
  completeTour(): void {
    const cfg = this.config();
    if (cfg?.tourId) {
      this.markTourCompleted(cfg.tourId);
    }
    cfg?.onComplete?.();
    this.endTour();
  }

  /**
   * Cleanly closes the tour overlay and tears down listeners
   */
  private endTour(): void {
    this.isActive.set(false);
    this.targetRect.set(null);
    this.teardownWindowListeners();
  }

  /**
   * Measures the target element for the current step and updates the spotlight rect
   */
  measureCurrentTarget(): void {
    const step = this.currentStep();
    if (!step || typeof document === 'undefined') {
      this.targetRect.set(null);
      return;
    }

    if (step.actionBeforeStep) {
      try {
        step.actionBeforeStep();
      } catch {}
    }

    // Measure after microtask/render
    setTimeout(() => {
      const el = document.querySelector(step.targetSelector);
      if (!el) {
        // Fallback: If element not found, center spotlight in viewport
        const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
        this.targetRect.set({
          x: vw / 2 - 150,
          y: vh / 2 - 100,
          width: 300,
          height: 200,
          radius: 12
        });
        return;
      }

      // Scroll target into view if outside viewport
      try {
        el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      } catch {}

      const rect = el.getBoundingClientRect();
      this.targetRect.set({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        radius: 10
      });
    }, 50);

    // Re-verify after transitions settle
    setTimeout(() => {
      const el = document.querySelector(step.targetSelector);
      if (el && this.isActive() && this.currentStep()?.id === step.id) {
        const rect = el.getBoundingClientRect();
        this.targetRect.set({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          radius: 10
        });
      }
    }, 250);
  }

  private setupWindowListeners(): void {
    if (typeof window === 'undefined') return;

    this.resizeListener = () => {
      if (this.isActive()) {
        this.measureCurrentTarget();
      }
    };
    this.scrollListener = () => {
      if (this.isActive()) {
        const step = this.currentStep();
        if (step) {
          const el = document.querySelector(step.targetSelector);
          if (el) {
            const rect = el.getBoundingClientRect();
            this.targetRect.set({
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
              radius: 10
            });
          }
        }
      }
    };

    window.addEventListener('resize', this.resizeListener, { passive: true });
    window.addEventListener('scroll', this.scrollListener, { capture: true, passive: true });
  }

  private teardownWindowListeners(): void {
    if (typeof window === 'undefined') return;

    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = undefined;
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, { capture: true });
      this.scrollListener = undefined;
    }
  }
}
