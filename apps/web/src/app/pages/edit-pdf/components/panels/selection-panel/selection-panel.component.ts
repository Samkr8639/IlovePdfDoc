import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AreaSelectionState } from '../../../models/document-model';

@Component({
  selector: 'app-selection-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="section-badge-title">SELECTION</div>
    <div class="property-panel-card">
      @if (selection(); as sel) {
        <div class="selected-meta-row" style="margin-bottom: 12px;">
          <span class="selected-type-tag" style="background: rgba(13, 148, 136, 0.12); color: var(--pt-teal-700, #0d9488); border-color: rgba(13, 148, 136, 0.25);">
            AREA
          </span>
          <span class="selected-id-tag">Page {{ sel.pageIndex + 1 }}</span>
        </div>

        <div class="selection-dimensions-info" style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--pt-slate-600, #475569); margin-bottom: 14px; padding: 6px 10px; background: var(--pt-slate-50, #f8fafc); border-radius: 6px; border: 1px solid var(--pt-slate-200, #e2e8f0);">
          <span>Size: {{ Math.round(sel.widthPt) }} × {{ Math.round(sel.heightPt) }} pt</span>
          <span>Pos: {{ Math.round(sel.xPt) }}, {{ Math.round(sel.yPt) }}</span>
        </div>

        <!-- 6 PRIMARY ACTION BUTTONS: COPY, PASTE, CUT, DUPLICATE, FORWARD, DELETE -->
        <div class="element-action-buttons selection-actions-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
          <!-- COPY -->
          <button
            type="button"
            class="el-action-btn"
            (click)="copy.emit()"
            title="Copy selection (Ctrl/Cmd+C)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy</span>
          </button>

          <!-- PASTE -->
          <button
            type="button"
            class="el-action-btn"
            [disabled]="!canPaste()"
            (click)="paste.emit()"
            title="Paste copied area (Ctrl/Cmd+V)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <span>Paste</span>
          </button>

          <!-- CUT -->
          <button
            type="button"
            class="el-action-btn"
            (click)="cut.emit()"
            title="Cut area and whiteout original (Ctrl/Cmd+X)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
            <span>Cut</span>
          </button>

          <!-- DUPLICATE -->
          <button
            type="button"
            class="el-action-btn"
            (click)="duplicate.emit()"
            title="Duplicate selection right next to original (Ctrl/Cmd+D)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Duplicate</span>
          </button>

          <!-- BRING FORWARD -->
          <button
            type="button"
            class="el-action-btn"
            (click)="bringForward.emit()"
            title="Bring Forward">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>Forward</span>
          </button>

          <!-- DELETE -->
          <button
            type="button"
            class="el-action-btn danger"
            (click)="delete.emit()"
            title="Whiteout & delete selected area (Delete key)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>
        </div>

        <p class="property-tip" style="margin-top: 14px; font-size: 11px; line-height: 1.4; color: var(--pt-slate-500, #64748b);">
          Tip: Drag the area to move it to any location or page. Use arrow keys to nudge by 1px (Shift for 10px). Press Esc to deselect.
        </p>
      } @else {
        <p class="property-tip">
          Click and drag a rectangle on the PDF to capture an area. You can move, copy, cut, or delete any content.
        </p>
        @if (canPaste()) {
          <button
            type="button"
            class="btn-action-primary"
            style="margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;"
            (click)="paste.emit()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <span>Paste Copied Area</span>
          </button>
        }
      }
    </div>
  `
})
export class SelectionPanelComponent {
  readonly selection = input<AreaSelectionState | null>(null);
  readonly canPaste = input<boolean>(false);

  readonly copy = output<void>();
  readonly paste = output<void>();
  readonly cut = output<void>();
  readonly duplicate = output<void>();
  readonly bringForward = output<void>();
  readonly delete = output<void>();

  readonly Math = Math;
}
