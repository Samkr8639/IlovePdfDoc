import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-route-progress-bar',
  standalone: true,
  template: `
    @if (isVisible()) {
      <div
        class="route-progress-container"
        role="progressbar"
        aria-label="Page loading progress"
        [attr.aria-valuenow]="progress()"
        aria-valuemin="0"
        aria-valuemax="100">
        <div
          class="route-progress-bar"
          [style.width.%]="progress()"
          [class.animating]="progress() > 0 && progress() < 100">
        </div>
      </div>
    }
  `,
  styles: [`
    .route-progress-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 10001;
      pointer-events: none;
      background: transparent;
    }
    .route-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--pt-teal-700, #0F766E), var(--pt-teal-600, #14B8A6));
      box-shadow: 0 0 8px rgba(20, 184, 166, 0.5);
      transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
    }
    .route-progress-bar.animating {
      opacity: 1;
    }
    @media (prefers-reduced-motion: reduce) {
      .route-progress-bar {
        transition: none;
      }
    }
  `]
})
export class RouteProgressBarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private sub?: Subscription;
  private debounceTimer: any = null;
  private incrementTimer: any = null;

  isVisible = signal<boolean>(false);
  progress = signal<number>(0);

  ngOnInit(): void {
    this.sub = this.router.events.pipe(
      filter(e =>
        e instanceof NavigationStart ||
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      )
    ).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.startProgress();
      } else {
        this.completeProgress();
      }
    });
  }

  private startProgress(): void {
    this.clearTimers();
    // 150ms debounce so instantaneous route switches never flicker
    this.debounceTimer = setTimeout(() => {
      this.isVisible.set(true);
      this.progress.set(25);

      this.incrementTimer = setInterval(() => {
        const current = this.progress();
        if (current < 85) {
          this.progress.set(current + Math.floor(Math.random() * 15) + 5);
        }
      }, 200);
    }, 150);
  }

  private completeProgress(): void {
    this.clearTimers();
    if (this.isVisible()) {
      this.progress.set(100);
      setTimeout(() => {
        this.isVisible.set(false);
        this.progress.set(0);
      }, 250);
    }
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.incrementTimer) {
      clearInterval(this.incrementTimer);
      this.incrementTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.sub?.unsubscribe();
  }
}

