import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pdf-bottom-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bottom-floating-bar" aria-label="Page navigation and zoom controls">
      <button
        type="button"
        class="bar-icon-btn"
        [disabled]="currentPageIndex() <= 0"
        (click)="prevPage.emit()"
        title="Previous Page">
        <svg class="lucide-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      <button
        type="button"
        class="bar-icon-btn"
        [disabled]="currentPageIndex() >= totalPages() - 1"
        (click)="nextPage.emit()"
        title="Next Page">
        <svg class="lucide-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div class="page-indicator-wrap">
        <input
          type="number"
          class="page-number-input"
          [ngModel]="currentPageIndex() + 1"
          (ngModelChange)="goToPage.emit($event - 1)"
          min="1"
          [max]="totalPages()" />
        <span class="page-total">/ {{ totalPages() }}</span>
      </div>

      <div class="bar-divider"></div>

      <button
        type="button"
        class="bar-icon-btn"
        (click)="zoomOut.emit()"
        title="Zoom out">
        <svg class="lucide-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <button
        type="button"
        class="bar-icon-btn"
        (click)="zoomIn.emit()"
        title="Zoom in">
        <svg class="lucide-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <button
        type="button"
        class="bar-text-btn"
        (click)="resetZoom.emit()"
        title="Reset Zoom">
        {{ (zoom() * 100) | number:'1.0-0' }}%
      </button>

      <button
        type="button"
        class="bar-icon-btn"
        (click)="resetZoom.emit()"
        title="Fit to Screen">
        <svg class="lucide-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
    </div>
  `,
  styles: [`
    .page-indicator-wrap {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .page-total,
    .bar-text-btn {
      white-space: nowrap;
      flex-shrink: 0;
    }
  `]
})
export class PdfBottomBarComponent {
  readonly currentPageIndex = input<number>(0);
  readonly totalPages = input<number>(1);
  readonly zoom = input<number>(1.0);

  readonly prevPage = output<void>();
  readonly nextPage = output<void>();
  readonly goToPage = output<number>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly resetZoom = output<void>();
}

