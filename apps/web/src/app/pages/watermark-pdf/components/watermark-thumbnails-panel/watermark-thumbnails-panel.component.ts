/**
 * Watermark Thumbnails Panel Component
 * Displays a vertical strip of page preview thumbnails for the loaded PDF document.
 * Provides instant page jump/selection, page rotation (90 deg), and page deletion.
 * Fully collapsible to maximize workspace canvas space.
 * Follows PDFTailor Design System rules and tokens.
 */

import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-watermark-thumbnails-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="left-thumbnails-panel"
      [class.collapsed]="isCollapsed()"
      aria-label="Pages thumbnail list">
      <div class="thumbnails-header">
        <span class="thumbnails-count-title">{{ totalPages() }} {{ totalPages() === 1 ? 'Page' : 'Pages' }}</span>
        <button
          type="button"
          class="collapse-toggle-btn"
          (click)="toggleCollapse.emit()"
          [title]="isCollapsed() ? 'Expand Thumbnails' : 'Collapse Thumbnails'"
          [attr.aria-label]="isCollapsed() ? 'Expand Thumbnails' : 'Collapse Thumbnails'">
          <svg class="lucide-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            @if (isCollapsed()) {
              <polyline points="9 18 15 12 9 6" />
            } @else {
              <polyline points="15 18 9 12 15 6" />
            }
          </svg>
        </button>
      </div>

      <div class="thumbnails-scroll-list">
        @for (pageNum of pagesList(); track pageNum) {
          <div
            class="thumbnail-card"
            [id]="'thumb-page-' + pageNum"
            [class.active]="currentPage() === pageNum"
            tabindex="0"
            role="button"
            [attr.aria-label]="'Select page ' + pageNum"
            (keydown.enter)="selectPage.emit(pageNum)"
            (keydown.space)="selectPage.emit(pageNum); $event.preventDefault()"
            (click)="selectPage.emit(pageNum)">
            <!-- Card Header Overlay Buttons -->
            <div class="card-overlay-actions">
              <button
                type="button"
                class="card-action-btn"
                (click)="rotatePage.emit(pageNum); $event.stopPropagation()"
                title="Rotate page"
                [attr.aria-label]="'Rotate page ' + pageNum">
                <svg class="lucide-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
              <button
                type="button"
                class="card-action-btn danger"
                (click)="deletePage.emit(pageNum); $event.stopPropagation()"
                title="Delete page"
                [attr.aria-label]="'Delete page ' + pageNum">
                <svg class="lucide-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>

            <!-- Page Preview Mini Sheet -->
            <div class="page-mini-sheet">
              @if (thumbnails().has(pageNum)) {
                <img [src]="thumbnails().get(pageNum)" alt="Page {{ pageNum }}" class="page-thumb-img" />
              } @else {
                <div class="mini-doc-lines">
                  <span class="mini-line header"></span>
                  <span class="mini-line accent"></span>
                  <span class="mini-line body"></span>
                  <span class="mini-line body short"></span>
                </div>
              }
            </div>

            <div class="page-number-label">{{ pageNum }}</div>
          </div>
        }
      </div>
    </aside>
  `,
  styles: [`
    .left-thumbnails-panel {
      height: 100%;
      width: 130px;
      background: var(--pt-surface-white, #FFFFFF);
      border-right: 1px solid var(--pt-soft-outline, #E5E7EB);
      display: flex;
      flex-direction: column;
      transition: width 0.2s ease;
      z-index: 10;
      flex-shrink: 0;
    }

    .left-thumbnails-panel.collapsed {
      width: 44px;
    }

    .thumbnails-header {
      padding: 0.75rem;
      border-bottom: 1px solid var(--pt-soft-outline, #E5E7EB);
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 48px;
    }

    .thumbnails-count-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--pt-muted, #64748B);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
      font-family: var(--pt-font-body, 'Inter', sans-serif);
    }

    .left-thumbnails-panel.collapsed .thumbnails-count-title {
      display: none;
    }

    .collapse-toggle-btn {
      background: transparent;
      border: none;
      padding: 0.25rem;
      color: var(--pt-muted, #64748B);
      cursor: pointer;
      border-radius: var(--pt-radius-xs, 4px);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .collapse-toggle-btn:hover {
      background: var(--pt-subtle-bg, #F6F8FA);
      color: var(--pt-navy, #14213D);
    }

    .thumbnails-scroll-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      align-items: center;
    }

    .left-thumbnails-panel.collapsed .thumbnails-scroll-list {
      display: none;
    }

    .thumbnail-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: var(--pt-radius-sm, 6px);
      transition: all 0.15s ease;
      outline: none;
    }

    .thumbnail-card:hover {
      background: var(--pt-subtle-bg, #F6F8FA);
    }

    .thumbnail-card:focus-visible {
      box-shadow: 0 0 0 2px var(--pt-teal-700, #0F766E);
    }

    .thumbnail-card.active .page-mini-sheet {
      border-color: var(--pt-teal-700, #0F766E);
      box-shadow: 0 0 0 2px var(--pt-teal-100, #CCFBF1);
    }

    .card-overlay-actions {
      position: absolute;
      top: 0.375rem;
      right: 0.375rem;
      display: none;
      gap: 0.25rem;
      z-index: 5;
    }

    .thumbnail-card:hover .card-overlay-actions,
    .thumbnail-card:focus-within .card-overlay-actions {
      display: flex;
    }

    .card-action-btn {
      background: var(--pt-surface-white, #FFFFFF);
      border: 1px solid var(--pt-soft-outline, #E5E7EB);
      color: var(--pt-navy, #14213D);
      border-radius: var(--pt-radius-pill, 9999px);
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      padding: 0;
      transition: all 0.15s ease;
    }

    .card-action-btn:hover {
      background: var(--pt-teal-50, #F0FDFA);
      color: var(--pt-teal-700, #0F766E);
      border-color: var(--pt-teal-700, #0F766E);
    }

    .card-action-btn.danger:hover {
      background: #FEE2E2;
      color: #DC2626;
      border-color: #DC2626;
    }

    .page-mini-sheet {
      width: 80px;
      height: 110px;
      background: #FFFFFF;
      border: 1.5px solid var(--pt-soft-outline, #E5E7EB);
      border-radius: var(--pt-radius-xs, 4px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: all 0.15s ease;
    }

    .page-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #FFFFFF;
    }

    .mini-doc-lines {
      width: 75%;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .mini-line {
      height: 2px;
      background: var(--pt-soft-outline, #E5E7EB);
      border-radius: 1px;
    }

    .mini-line.header {
      width: 60%;
      height: 3px;
      background: var(--pt-navy, #14213D);
    }

    .mini-line.accent {
      width: 85%;
      background: var(--pt-teal-700, #0F766E);
    }

    .mini-line.body {
      width: 100%;
    }

    .mini-line.body.short {
      width: 45%;
    }

    .page-number-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--pt-muted, #64748B);
      margin-top: 0.35rem;
      font-family: var(--pt-font-body, 'Inter', sans-serif);
    }

    .thumbnail-card.active .page-number-label {
      color: var(--pt-teal-700, #0F766E);
      font-weight: 700;
    }

    @media (max-width: 1024px) {
      .left-thumbnails-panel {
        width: 90px;
      }
      .page-mini-sheet {
        width: 60px;
        height: 82px;
      }
    }

    @media (max-width: 768px) {
      .left-thumbnails-panel {
        display: none;
      }
    }
  `]
})
export class WatermarkThumbnailsPanelComponent {
  readonly totalPages = input<number>(1);
  readonly currentPage = input<number>(1);
  readonly thumbnails = input<Map<number, string>>(new Map());
  readonly isCollapsed = input<boolean>(false);

  readonly toggleCollapse = output<void>();
  readonly selectPage = output<number>();
  readonly rotatePage = output<number>();
  readonly deletePage = output<number>();

  readonly pagesList = computed(() =>
    Array.from({ length: Math.max(1, this.totalPages()) }, (_, i) => i + 1)
  );
}
