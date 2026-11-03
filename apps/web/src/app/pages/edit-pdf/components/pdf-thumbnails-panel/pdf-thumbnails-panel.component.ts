import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageDimensions } from '../../models/document-model';

@Component({
  selector: 'app-pdf-thumbnails-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="left-thumbnails-panel"
      [class.collapsed]="isCollapsed()"
      aria-label="Pages thumbnail list">
      <div class="thumbnails-header">
        <span class="thumbnails-count-title">{{ pages().length }} Pages</span>
        <button
          type="button"
          class="collapse-toggle-btn"
          (click)="toggleCollapse.emit()"
          [title]="isCollapsed() ? 'Expand Thumbnails' : 'Collapse Thumbnails'">
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
        @for (page of pages(); track page.pageIndex; let i = $index) {
          <div
            class="thumbnail-card"
            [id]="'thumb-page-' + i"
            [class.active]="currentPageIndex() === i"
            (click)="selectPage.emit(i)">
            <!-- Card Header Overlay Buttons -->
            <div class="card-overlay-actions">
              <button
                type="button"
                class="card-action-btn"
                (click)="rotatePage.emit(i); $event.stopPropagation()"
                title="Rotate page">
                <svg class="lucide-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
              <button
                type="button"
                class="card-action-btn danger"
                (click)="deletePage.emit(i); $event.stopPropagation()"
                title="Delete page">
                <svg class="lucide-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>

            <!-- Page Preview Mini Sheet -->
            <div class="page-mini-sheet">
              @if (pageThumbnails().has(i)) {
                <img [src]="pageThumbnails().get(i)" alt="Page {{ i + 1 }}" class="page-thumb-img" />
              } @else {
                <div class="mini-doc-lines">
                  <span class="mini-line header"></span>
                  <span class="mini-line accent"></span>
                  <span class="mini-line body"></span>
                  <span class="mini-line body short"></span>
                </div>
              }
            </div>

            <div class="page-number-label">{{ i + 1 }}</div>
          </div>
        }
      </div>
    </aside>
  `
})
export class PdfThumbnailsPanelComponent {
  readonly pages = input<PageDimensions[]>([]);
  readonly currentPageIndex = input<number>(0);
  readonly pageThumbnails = input<Map<number, string>>(new Map());
  readonly isCollapsed = input<boolean>(false);

  readonly toggleCollapse = output<void>();
  readonly selectPage = output<number>();
  readonly rotatePage = output<number>();
  readonly deletePage = output<number>();
}

