import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-shape-panel',
  standalone: true,
  template: `
    <div class="section-badge-title">SHAPES</div>
    <div class="property-panel-card">
      <label class="property-sublabel">Select Shape</label>
      <div class="shape-type-grid">
        <button type="button" class="shape-choice-btn" [class.active]="shapeType() === 'rectangle'"
          (click)="shapeTypeChange.emit('rectangle')" title="Rectangle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          <span>Rectangle</span>
        </button>

        <button type="button" class="shape-choice-btn" [class.active]="shapeType() === 'circle'"
          (click)="shapeTypeChange.emit('circle')" title="Circle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" />
          </svg>
          <span>Circle</span>
        </button>

        <button type="button" class="shape-choice-btn" [class.active]="shapeType() === 'line'"
          (click)="shapeTypeChange.emit('line')" title="Line">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="19" x2="19" y2="5" />
          </svg>
          <span>Line</span>
        </button>

        <button type="button" class="shape-choice-btn" [class.active]="shapeType() === 'arrow'"
          (click)="shapeTypeChange.emit('arrow')" title="Arrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="19" x2="19" y2="5" />
            <polyline points="10 5 19 5 19 14" />
          </svg>
          <span>Arrow</span>
        </button>

        <button type="button" class="shape-choice-btn" [class.active]="shapeType() === 'star'"
          (click)="shapeTypeChange.emit('star')" title="Star">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>Star</span>
        </button>

        <button type="button" class="shape-choice-btn" [class.active]="shapeType() === 'polygon'"
          (click)="shapeTypeChange.emit('polygon')" title="Custom Polygon Shape (Point to Point)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5" />
            <circle cx="12" cy="3" r="1.5" fill="currentColor" />
            <circle cx="20" cy="7.5" r="1.5" fill="currentColor" />
            <circle cx="20" cy="16.5" r="1.5" fill="currentColor" />
            <circle cx="12" cy="21" r="1.5" fill="currentColor" />
            <circle cx="4" cy="16.5" r="1.5" fill="currentColor" />
            <circle cx="4" cy="7.5" r="1.5" fill="currentColor" />
          </svg>
          <span>Custom</span>
        </button>
      </div>

      @if (shapeType() === 'polygon') {
        <div class="custom-shape-guide-box">
          @if (draftPolygonPointCount() > 0) {
            <div class="guide-text">
              <strong>{{ draftPolygonPointCount() }} points plotted.</strong> Click the start point or double-click to close shape.
            </div>
            <div class="draft-action-btns">
              <button type="button" class="btn-sm-finish" (click)="completeCustomShape.emit()" [disabled]="draftPolygonPointCount() < 3">
                ✓ Close Shape
              </button>
              <button type="button" class="btn-sm-cancel" (click)="cancelCustomShape.emit()">
                ✕ Cancel
              </button>
            </div>
          } @else {
            <div class="guide-text">
              ✨ <strong>Custom Shape Maker:</strong> Click anywhere on the PDF page to start plotting points. Connect back to the start point (or double-click) to close the shape.
            </div>
          }
        </div>
      }

      <label class="property-sublabel">Border Thickness</label>
      <div class="thickness-btn-group">
        <button type="button" class="thickness-btn" [class.active]="strokeWidth() === 1"
          (click)="strokeWidthChange.emit(1)">1px</button>
        <button type="button" class="thickness-btn" [class.active]="strokeWidth() === 2"
          (click)="strokeWidthChange.emit(2)">2px</button>
        <button type="button" class="thickness-btn" [class.active]="strokeWidth() === 4"
          (click)="strokeWidthChange.emit(4)">4px</button>
        <button type="button" class="thickness-btn" [class.active]="strokeWidth() === 6"
          (click)="strokeWidthChange.emit(6)">6px</button>
      </div>

      <label class="property-sublabel">Border Color</label>
      <div class="color-swatches-group">
        <button type="button" class="color-dot navy" [class.active]="strokeColor() === 'var(--pt-navy)'"
          (click)="strokeColorChange.emit('var(--pt-navy)')" title="Navy"></button>
        <button type="button" class="color-dot teal" [class.active]="strokeColor() === 'var(--pt-teal-700)'"
          (click)="strokeColorChange.emit('var(--pt-teal-700)')" title="Teal"></button>
        <button type="button" class="color-dot coral" [class.active]="strokeColor() === 'var(--pt-coral)'"
          (click)="strokeColorChange.emit('var(--pt-coral)')" title="Coral"></button>
        <button type="button" class="color-dot amber" [class.active]="strokeColor() === 'var(--pt-amber)'"
          (click)="strokeColorChange.emit('var(--pt-amber)')" title="Amber"></button>
        <button type="button" class="color-dot black" [class.active]="strokeColor() === 'var(--pt-navy-deep)'"
          (click)="strokeColorChange.emit('var(--pt-navy-deep)')" title="Dark"></button>
      </div>

      <label class="property-sublabel">Fill Color</label>
      <div class="color-swatches-group">
        <button type="button" class="color-dot transparent" [class.active]="fillColor() === 'transparent'"
          (click)="fillColorChange.emit('transparent')" title="Transparent"></button>
        <button type="button" class="color-dot white" [class.active]="fillColor() === 'var(--pt-surface-white)'"
          (click)="fillColorChange.emit('var(--pt-surface-white)')" title="White"></button>
        <button type="button" class="color-dot teal-tint" [class.active]="fillColor() === 'var(--pt-teal-50)'"
          (click)="fillColorChange.emit('var(--pt-teal-50)')" title="Teal Tint"></button>
        <button type="button" class="color-dot amber-tint"
          [class.active]="fillColor() === 'rgba(245, 158, 11, 0.15)'"
          (click)="fillColorChange.emit('rgba(245, 158, 11, 0.15)')" title="Amber Tint"></button>
        <button type="button" class="color-dot coral-tint"
          [class.active]="fillColor() === 'rgba(244, 63, 94, 0.15)'"
          (click)="fillColorChange.emit('rgba(244, 63, 94, 0.15)')" title="Coral Tint"></button>
      </div>

      @if (isElementSelected()) {
        <div class="selected-element-actions-divider">
          <div class="element-action-buttons">
            <button type="button" class="el-action-btn" (click)="rotate.emit()" title="Rotate 90°">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Rotate</span>
            </button>
            <button type="button" class="el-action-btn" (click)="duplicate.emit()" title="Duplicate Shape">
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
            <button type="button" class="el-action-btn danger" (click)="delete.emit()" title="Delete Shape">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      } @else {
        <button type="button" class="btn-action-primary" (click)="addShape.emit()">
          <span>+ Place Shape on Page</span>
        </button>
      }
    </div>
  `
})
export class ShapePanelComponent {
  readonly shapeType = input.required<'rectangle' | 'circle' | 'line' | 'arrow' | 'star' | 'polygon'>();
  readonly strokeColor = input.required<string>();
  readonly fillColor = input.required<string>();
  readonly strokeWidth = input.required<number>();
  readonly isElementSelected = input<boolean>(false);
  readonly draftPolygonPointCount = input<number>(0);

  readonly shapeTypeChange = output<'rectangle' | 'circle' | 'line' | 'arrow' | 'star' | 'polygon'>();
  readonly strokeColorChange = output<string>();
  readonly fillColorChange = output<string>();
  readonly strokeWidthChange = output<number>();
  readonly addShape = output<void>();
  readonly rotate = output<void>();
  readonly duplicate = output<void>();
  readonly bringForward = output<void>();
  readonly delete = output<void>();
  readonly completeCustomShape = output<void>();
  readonly cancelCustomShape = output<void>();
}

