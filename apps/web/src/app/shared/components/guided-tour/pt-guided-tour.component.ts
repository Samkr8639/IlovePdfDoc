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

export type ArrowPlacement = 'left' | 'right' | 'top' | 'bottom' | null;

export interface TourLayoutInfo {
  popoverStyle: PopoverStyle;
  arrowPlacement: ArrowPlacement;
  arrowStyle: Record<string, string | undefined>;
  connectorPath: string | null;
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

  // Dynamic Layout Calculation (Popover Position, Caret Arrow & SVG Connector)
  readonly layoutCalculation = computed<TourLayoutInfo>(() => {
    const s = this.spotlight();
    const vw = this.vw();
    const vh = this.vh();

    // Mobile layout (<= 640px)
    if (vw <= 640) {
      const popoverStyle: PopoverStyle = {
        top: 'auto',
        bottom: '20px',
        left: '16px',
        right: '16px',
        width: 'auto'
      };

      let connectorPath: string | null = null;
      if (s) {
        const cardY = vh - 220;
        const cardCenterX = vw / 2;
        const targetCenterX = Math.max(20, Math.min(vw - 20, s.x + s.width / 2));
        const targetBottomY = Math.min(cardY - 14, s.y + s.height + 4);
        if (targetBottomY < cardY - 18) {
          connectorPath = `M ${cardCenterX} ${cardY} C ${cardCenterX} ${(cardY + targetBottomY) / 2}, ${targetCenterX} ${(cardY + targetBottomY) / 2}, ${targetCenterX} ${targetBottomY}`;
        }
      }

      return {
        popoverStyle,
        arrowPlacement: 'bottom',
        arrowStyle: {
          top: '-7px',
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)'
        },
        connectorPath
      };
    }

    if (!s) {
      return {
        popoverStyle: {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '360px'
        },
        arrowPlacement: null,
        arrowStyle: {},
        connectorPath: null
      };
    }

    const cardWidth = 360;
    const cardHeight = 220; // approximate height for placement calculation
    const step = this.currentStep();
    const desiredPlacement = step?.placement || 'bottom';

    let actualPlacement: 'left' | 'right' | 'top' | 'bottom' = 'bottom';
    let left = s.x + (s.width - cardWidth) / 2;
    let top = s.y + s.height + 16;

    if (desiredPlacement === 'bottom') {
      actualPlacement = 'bottom';
      top = s.y + s.height + 16;
      if (top + cardHeight > vh - 20 && s.y - cardHeight - 16 >= 20) {
        actualPlacement = 'top';
        top = s.y - cardHeight - 16;
      }
    } else if (desiredPlacement === 'top') {
      actualPlacement = 'top';
      top = s.y - cardHeight - 16;
      if (top < 20 && s.y + s.height + cardHeight + 16 <= vh - 20) {
        actualPlacement = 'bottom';
        top = s.y + s.height + 16;
      }
    } else if (desiredPlacement === 'left') {
      actualPlacement = 'left';
      left = s.x - cardWidth - 16;
      top = s.y + (s.height - cardHeight) / 2;
      if (left < 20 && s.x + s.width + cardWidth + 16 <= vw - 20) {
        actualPlacement = 'right';
        left = s.x + s.width + 16;
      }
    } else if (desiredPlacement === 'right') {
      actualPlacement = 'right';
      left = s.x + s.width + 16;
      top = s.y + (s.height - cardHeight) / 2;
      if (left + cardWidth > vw - 20 && s.x - cardWidth - 16 >= 20) {
        actualPlacement = 'left';
        left = s.x - cardWidth - 16;
      }
    }

    // Viewport bounds clamping
    left = Math.max(16, Math.min(vw - cardWidth - 16, left));
    top = Math.max(16, Math.min(vh - cardHeight - 16, top));

    // Calculate Arrow Coordinates & SVG Connector Path
    const targetCenterX = s.x + s.width / 2;
    const targetCenterY = s.y + s.height / 2;

    const arrowStyle: { [key: string]: string } = {};
    let connectorPath: string | null = null;

    if (actualPlacement === 'left') {
      // Card is to LEFT of target -> caret arrow on RIGHT edge of card
      const arrowTopClamped = Math.max(24, Math.min(cardHeight - 32, targetCenterY - top - 7));
      arrowStyle['top'] = `${arrowTopClamped}px`;
      arrowStyle['right'] = '-7px';

      const startX = left + cardWidth;
      const startY = top + arrowTopClamped + 7;
      const endX = Math.max(startX + 6, s.x - 4);
      const endY = targetCenterY;

      connectorPath = `M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`;
    } else if (actualPlacement === 'right') {
      // Card is to RIGHT of target -> caret arrow on LEFT edge of card
      const arrowTopClamped = Math.max(24, Math.min(cardHeight - 32, targetCenterY - top - 7));
      arrowStyle['top'] = `${arrowTopClamped}px`;
      arrowStyle['left'] = '-7px';

      const startX = left;
      const startY = top + arrowTopClamped + 7;
      const endX = Math.min(startX - 6, s.x + s.width + 4);
      const endY = targetCenterY;

      connectorPath = `M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`;
    } else if (actualPlacement === 'top') {
      // Card is ABOVE target -> caret arrow on BOTTOM edge of card
      const arrowLeftClamped = Math.max(24, Math.min(cardWidth - 32, targetCenterX - left - 7));
      arrowStyle['left'] = `${arrowLeftClamped}px`;
      arrowStyle['bottom'] = '-7px';

      const startX = left + arrowLeftClamped + 7;
      const startY = top + cardHeight;
      const endX = targetCenterX;
      const endY = Math.max(startY + 6, s.y - 4);

      connectorPath = `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`;
    } else {
      // Card is BELOW target -> caret arrow on TOP edge of card
      const arrowLeftClamped = Math.max(24, Math.min(cardWidth - 32, targetCenterX - left - 7));
      arrowStyle['left'] = `${arrowLeftClamped}px`;
      arrowStyle['top'] = '-7px';

      const startX = left + arrowLeftClamped + 7;
      const startY = top;
      const endX = targetCenterX;
      const endY = Math.min(startY - 6, s.y + s.height + 4);

      connectorPath = `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`;
    }

    return {
      popoverStyle: {
        top: `${top}px`,
        left: `${left}px`,
        width: `${cardWidth}px`
      },
      arrowPlacement: actualPlacement,
      arrowStyle,
      connectorPath
    };
  });

  readonly popoverStyle = computed<PopoverStyle>(() => this.layoutCalculation().popoverStyle);
  readonly arrowPlacement = computed<ArrowPlacement>(() => this.layoutCalculation().arrowPlacement);
  readonly arrowStyle = computed<Record<string, string | undefined>>(() => this.layoutCalculation().arrowStyle);
  readonly connectorPath = computed<string | null>(() => this.layoutCalculation().connectorPath);

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
