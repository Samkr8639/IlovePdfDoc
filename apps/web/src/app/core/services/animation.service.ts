import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import gsap from 'gsap';

@Injectable({
  providedIn: 'root'
})
export class AnimationService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Returns true if user has enabled reduced motion preferences.
   */
  get prefersReducedMotion(): boolean {
    if (!this.isBrowser || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Hero entrance animation: softly fades and rises header badges, headline, and subtext.
   * Scoped via gsap.context for easy cleanup on ngOnDestroy.
   */
  animateHero(container: HTMLElement): gsap.Context | null {
    if (!this.isBrowser || this.prefersReducedMotion) {
      return null;
    }

    const ctx = gsap.context(() => {
      gsap.from('.hero-badge, .editorial-headline, .editorial-subhead', {
        opacity: 0,
        y: 20,
        duration: 0.65,
        stagger: 0.12,
        ease: 'power2.out',
        clearProps: 'all'
      });
    }, container);

    return ctx;
  }

  /**
   * Grid tool cards staggered entrance animation.
   */
  animateToolCards(container: HTMLElement, selector = '.tool-card-item'): gsap.Context | null {
    if (!this.isBrowser || this.prefersReducedMotion) {
      return null;
    }

    const ctx = gsap.context(() => {
      gsap.from(selector, {
        opacity: 0,
        y: 24,
        duration: 0.55,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'all'
      });
    }, container);

    return ctx;
  }

  /**
   * Subtle fade in for sections when brought into viewport or initialized.
   */
  fadeSlideIn(element: HTMLElement, y = 16, duration = 0.5, delay = 0): gsap.core.Tween | null {
    if (!this.isBrowser || this.prefersReducedMotion) {
      return null;
    }

    return gsap.from(element, {
      opacity: 0,
      y,
      duration,
      delay,
      ease: 'power2.out',
      clearProps: 'all'
    });
  }
}
