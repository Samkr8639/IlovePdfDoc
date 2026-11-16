import { Component, computed, HostListener, ElementRef, ViewChild, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuidedTourService, SpotlightRect } from '../../../core/services/guided-tour/guided-tour.service';

export interface PopoverStyle {
  top: string;
  left: string;
  width?: string;
  bottom?: string;
  right?: string;
  transform?: string;
}

@Component({
  selector: 'app-pt-guided-tour',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pt-guided-tour.component.html',
  styleUrls: ['./pt-guided-tour.component.css']
})
export class PtGuidedTourComponent {
  @ViewChild('popoverCard') popoverCardRef?: ElementRef<HTMLDivElement>;

  public tourService = inject(GuidedTourService);

  readonly isActive = this.tourService.isActive;
  readonly currentStep = this.tourService.currentStep;
  readonly currentStepIndex = this.tourService.currentStepIndex;
  readonly totalSteps = this.tourService.totalSteps;
  readonly isFirstStep = this.tourService.isFirstStep;
  readonly isLastStep = this.tourService.isLastStep;
  readonly canSkipRest = this.tourService.canSkipRest;
  readonly targetRect = this.tourService.targetRect;

  // Viewport dimensions
  private vw = signal<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  private vh = signal<number>(typeof window !== 'undefined' ? window.innerHeight : 800);

  // Spotlight dimensions with padding
  readonly spotlight = computed(() => {
    const r = this.targetRect();
    if (!r) return null;
    const pad = 8;
    return {
      x: Math.max(0, r.x - pad),
      y: Math.max(0, r.y - pad),
      width: r.width + pad * 2,
      height: r.height + pad * 2,
      radius: r.radius || 10
    };
  });

  // Dynamic Popover Style based on target positioning
  readonly popoverStyle = computed<PopoverStyle>(() => {
    const s = this.spotlight();
    const vw = this.vw();
    const vh = this.vh();

    // Mobile dock
    if (vw <= 640) {
      return {
        top: 'auto',
        bottom: '20px',
        left: '16px',
        right: '16px',
        width: 'auto'
      };
    }

    if (!s) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '360px'
      };
    }

    const cardWidth = 360;
    const cardHeight = 220; // approximate height for placement calculation
    const step = this.currentStep();
    const placement = step?.placement || 'bottom';

    let left = s.x + (s.width - cardWidth) / 2;
    let top = s.y + s.height + 16;

    if (placement === 'bottom') {
      top = s.y + s.height + 16;
      if (top + cardHeight > vh - 20 && s.y - cardHeight - 16 >= 20) {
        // Flip to top
        top = s.y - cardHeight - 16;
      }
    } else if (placement === 'top') {
      top = s.y - cardHeight - 16;
      if (top < 20 && s.y + s.height + cardHeight + 16 <= vh - 20) {
        // Flip to bottom
        top = s.y + s.height + 16;
      }
    } else if (placement === 'left') {
      left = s.x - cardWidth - 16;
      top = s.y + (s.height - cardHeight) / 2;
      if (left < 20 && s.x + s.width + cardWidth + 16 <= vw - 20) {
        // Flip to right
        left = s.x + s.width + 16;
      }
    } else if (placement === 'right') {
      left = s.x + s.width + 16;
      top = s.y + (s.height - cardHeight) / 2;
      if (left + cardWidth > vw - 20 && s.x - cardWidth - 16 >= 20) {
        // Flip to left
        left = s.x - cardWidth - 16;
      }
    }

    // Viewport bounds clamping
    left = Math.max(16, Math.min(vw - cardWidth - 16, left));
    top = Math.max(16, Math.min(vh - cardHeight - 16, top));

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`
    };
  });

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.vw.set(window.innerWidth);
        this.vh.set(window.innerHeight);
      }, { passive: true });
    }

    // Auto-focus the next button or card when step changes for accessibility
    effect(() => {
      if (this.isActive() && this.currentStep()) {
        setTimeout(() => {
          const nextBtn = this.popoverCardRef?.nativeElement?.querySelector('.btn-tour-next') as HTMLElement;
          nextBtn?.focus();
        }, 100);
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isActive()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.skipTour();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (!this.isLastStep()) {
        this.nextStep();
      } else {
        this.completeTour();
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!this.isFirstStep()) {
        this.prevStep();
      }
    }
  }

  nextStep(): void {
    this.tourService.nextStep();
  }

  prevStep(): void {
    this.tourService.prevStep();
  }

  skipTour(): void {
    this.tourService.skipTour();
  }

  skipRest(): void {
    this.tourService.skipRest();
  }

  completeTour(): void {
    this.tourService.completeTour();
  }
}
