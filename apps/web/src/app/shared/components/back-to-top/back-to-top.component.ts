import { Component, HostListener, signal } from '@angular/core';

@Component({
  selector: 'app-back-to-top',
  standalone: true,
  template: `
    @if (isVisible()) {
      <button
        type="button"
        class="global-back-to-top"
        (click)="scrollToTop()"
        aria-label="Scroll back to top of page"
        title="Back to top"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
    }
  `,
  styles: [`
    .global-back-to-top {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background-color: var(--surface-card, #ffffff);
      color: var(--text-main, #111827);
      border: 1px solid var(--surface-border, #e5e7eb);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08), 0 10px 28px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      outline: none;
    }

    .global-back-to-top:hover {
      background-color: var(--coral-600, #e53935);
      color: #ffffff;
      border-color: var(--coral-600, #e53935);
      transform: translateY(-4px) scale(1.05);
      box-shadow: 0 8px 20px rgba(229, 57, 53, 0.3), 0 16px 32px rgba(229, 57, 53, 0.15);
    }

    .global-back-to-top:active {
      transform: translateY(-1px) scale(0.98);
    }

    .global-back-to-top:focus-visible {
      box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.35);
    }

    @media (max-width: 640px) {
      .global-back-to-top {
        bottom: 20px;
        right: 20px;
        width: 42px;
        height: 42px;
      }
    }

    @media print {
      .global-back-to-top {
        display: none !important;
      }
    }
  `]
})
export class BackToTopComponent {
  readonly isVisible = signal<boolean>(false);

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    this.isVisible.set(scrollY > 350);
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}
