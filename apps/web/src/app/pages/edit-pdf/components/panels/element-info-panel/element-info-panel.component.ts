import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditElement } from '../../../models/document-model';

@Component({
  selector: 'app-element-info-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (selectedElement(); as el) {
      <div class="section-badge-title">ELEMENT PROPERTIES</div>
      <div class="property-panel-card">
        <div class="selected-meta-row">
          <span class="selected-type-tag">{{ el.type | uppercase }}</span>
          <span class="selected-id-tag">Page {{ (el.pageIndex || 0) + 1 }}</span>
        </div>

        <div class="element-action-buttons">
          <button type="button" class="el-action-btn" (click)="duplicate.emit()" title="Duplicate">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Duplicate</span>
          </button>

          <button type="button" class="el-action-btn" (click)="bringForward.emit()" title="Bring to Front">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>Forward</span>
          </button>

          <button type="button" class="el-action-btn danger" (click)="delete.emit()" title="Delete Element">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>
        </div>
      </div>
    } @else {
      <div class="section-badge-title">DOCUMENT INFO</div>
      <div class="property-panel-card">
        <div class="doc-stats-grid">
          <div class="stat-item">
            <span class="stat-label">Current Page</span>
            <span class="stat-value">{{ currentPageIndex() + 1 }} of {{ totalPages() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Elements on Page</span>
            <span class="stat-value">{{ elementsOnPage() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Zoom Level</span>
            <span class="stat-value">{{ (zoom() * 100) | number:'1.0-0' }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Page Dimensions</span>
            <span class="stat-value">{{ pageDimensionsText() }}</span>
          </div>
        </div>

        <p class="property-tip">Select a tool above to annotate, draw, place shapes, or run OCR.</p>
      </div>
    }
  `
})
export class ElementInfoPanelComponent {
  readonly selectedElement = input<EditElement | null>(null);
  readonly currentPageIndex = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly elementsOnPage = input.required<number>();
  readonly zoom = input.required<number>();
  readonly pageDimensionsText = input.required<string>();

  readonly duplicate = output<void>();
  readonly bringForward = output<void>();
  readonly delete = output<void>();
}
