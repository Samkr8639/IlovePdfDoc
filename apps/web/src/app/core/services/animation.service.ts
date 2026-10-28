import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  gsap.registerPlugin(ScrollTrigger);
}

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
   * Modern SaaS Hero Entrance Animation with GSAP Timeline, Stagger, and ScrollTrigger.
   * Scoped via gsap.context for easy cleanup on ngOnDestroy.
   */
  animateHero(container: HTMLElement): gsap.Context | null {
    if (!this.isBrowser || this.prefersReducedMotion || !container) {
      return null;
    }

    const ctx = gsap.context(() => {
      // Kicker badge drop-in
      gsap.from('.hero-kicker-badge', {
        opacity: 0,
        y: -14,
        scale: 0.95,
        duration: 0.5,
        ease: 'power2.out',
        clearProps: 'all'
      });

      // Main headline smooth rise
      gsap.from('.hero-headline', {
        opacity: 0,
        y: 22,
        duration: 0.6,
        delay: 0.08,
        ease: 'power2.out',
        clearProps: 'all'
      });

      // Subtitle fade & rise
      gsap.from('.hero-subhead', {
        opacity: 0,
        y: 18,
        duration: 0.55,
        delay: 0.15,
        ease: 'power2.out',
        clearProps: 'all'
      });

      // Trust highlights stagger
      gsap.from('.trust-chip', {
        opacity: 0,
        y: 12,
        duration: 0.45,
        stagger: 0.04,
        delay: 0.2,
        ease: 'power2.out',
        clearProps: 'all'
      });

      // Quick action tool links
      gsap.from('.quick-tool-link', {
        opacity: 0,
        y: 10,
        duration: 0.45,
        stagger: 0.03,
        delay: 0.25,
        ease: 'power2.out',
        clearProps: 'all'
      });

      // Category filter pills row
      gsap.from('.cat-pill', {
        opacity: 0,
        y: 14,
        duration: 0.45,
        stagger: 0.03,
        delay: 0.3,
        ease: 'power2.out',
        clearProps: 'all'
      });

      // Floating decorative document cards
      gsap.from('.hero-float-card', {
        opacity: 0,
        scale: 0.88,
        duration: 0.7,
        delay: 0.25,
        ease: 'back.out(1.5)',
        clearProps: 'opacity,scale'
      });

      // Infinite subtle organic float for cards
      const cardLeft = container.querySelector('.card-left');
      if (cardLeft) {
        gsap.to(cardLeft, {
          y: -12,
          rotation: 1,
          duration: 3.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        });
      }

      const cardRight = container.querySelector('.card-right');
      if (cardRight) {
        gsap.to(cardRight, {
          y: 12,
          rotation: -1,
          duration: 3.6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.3
        });
      }
    }, container);

    return ctx;
  }

  /**
   * Interactive mouse-parallax on floating hero elements.
   */
  updateHeroMouseParallax(
    container: HTMLElement,
    normX: number,
    normY: number
  ): void {
    if (!this.isBrowser || this.prefersReducedMotion || !container) {
      return;
    }

    const cardLeft = container.querySelector('.card-left') as HTMLElement | null;
    const cardRight = container.querySelector('.card-right') as HTMLElement | null;
    const glow1 = container.querySelector('.glow-1') as HTMLElement | null;

    if (cardLeft) {
      gsap.to(cardLeft, {
        x: -normX * 16,
        y: -normY * 16,
        rotationY: normX * 6,
        duration: 0.8,
        ease: 'power1.out',
        overwrite: 'auto'
      });
    }

    if (cardRight) {
      gsap.to(cardRight, {
        x: normX * 20,
        y: normY * 20,
        rotationY: -normX * 6,
        duration: 0.8,
        ease: 'power1.out',
        overwrite: 'auto'
      });
    }

    if (glow1) {
      gsap.to(glow1, {
        x: normX * 25,
        y: normY * 25,
        duration: 1.2,
        ease: 'power1.out',
        overwrite: 'auto'
      });
    }
  }

  /**
   * Reset floating cards to rest position on mouse leave.
   */
  resetHeroMouseParallax(container: HTMLElement): void {
    if (!this.isBrowser || !container) {
      return;
    }

    const targets = container.querySelectorAll('.card-left, .card-right, .glow-1');
    if (targets.length > 0) {
      gsap.to(targets, {
        x: 0,
        y: 0,
        rotationY: 0,
        duration: 1,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    }
  }

  /**
   * Grid tool cards staggered entrance animation.
   */
  animateToolCards(container: HTMLElement, selector = '.tool-card-item'): gsap.Context | null {
    if (!this.isBrowser || this.prefersReducedMotion || !container) {
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
    if (!this.isBrowser || this.prefersReducedMotion || !element) {
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
