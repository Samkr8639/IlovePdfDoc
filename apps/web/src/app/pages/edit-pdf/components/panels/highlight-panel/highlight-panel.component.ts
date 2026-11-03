import { Component, input, output } from '@angular/core';
import {
  ColorPalettePickerComponent,
  ColorPreset
} from '../../../shared/color-palette-picker/color-palette-picker.component';

@Component({
  selector: 'app-highlight-panel',
  standalone: true,
  imports: [ColorPalettePickerComponent],
  template: `
    <div class="section-badge-title">HIGHLIGHT</div>
    <div class="property-panel-card">
      <label class="property-sublabel">Color</label>
      <app-color-palette-picker
        [currentColor]="color()"
        [presets]="highlightPresets"
        (colorChange)="colorChange.emit($event)" />

      <label class="property-sublabel">Opacity</label>
      <div class="thickness-btn-group">
        @for (op of opacityOptions; track op) {
          <button
            type="button"
            class="thickness-btn"
            [class.active]="opacity() === op"
            (click)="opacityChange.emit(op)">
            {{ op * 100 }}%
          </button>
        }
      </div>

      @if (isElementSelected()) {
        <div class="selected-element-actions-divider">
          <div class="element-action-buttons">
            <button type="button" class="el-action-btn" (click)="duplicate.emit()" title="Duplicate Highlight">
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
            <button type="button" class="el-action-btn danger" (click)="delete.emit()" title="Delete Highlight">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      } @else {
        <button type="button" class="btn-action-primary" (click)="placeBox.emit()">
          <span>+ Place Highlight Box</span>
        </button>
      }
    </div>
  `
})
export class HighlightPanelComponent {
  readonly color = input.required<string>();
  readonly opacity = input.required<number>();
  readonly isElementSelected = input<boolean>(false);

  readonly colorChange = output<string>();
  readonly opacityChange = output<number>();
  readonly placeBox = output<void>();
  readonly duplicate = output<void>();
  readonly bringForward = output<void>();
  readonly delete = output<void>();

  readonly opacityOptions = [0.25, 0.35, 0.5];
  readonly highlightPresets: ColorPreset[] = [
    { value: 'var(--pt-amber)', cssClass: 'amber', title: 'Yellow' },
    { value: 'var(--pt-teal-700)', cssClass: 'teal', title: 'Teal' },
    { value: 'var(--pt-coral)', cssClass: 'coral', title: 'Pink' }
  ];
}
