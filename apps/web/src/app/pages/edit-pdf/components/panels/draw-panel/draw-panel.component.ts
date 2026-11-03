import { Component, input, output } from '@angular/core';
import {
  ColorPalettePickerComponent,
  ColorPreset
} from '../../../shared/color-palette-picker/color-palette-picker.component';

@Component({
  selector: 'app-draw-panel',
  standalone: true,
  imports: [ColorPalettePickerComponent],
  template: `
    <div class="section-badge-title">FREEHAND DRAW</div>
    <div class="property-panel-card">
      <label class="property-sublabel">Brush Size</label>
      <div class="thickness-btn-group">
        @for (size of strokeWidths; track size) {
          <button
            type="button"
            class="thickness-btn"
            [class.active]="strokeWidth() === size"
            (click)="strokeWidthChange.emit(size)">
            {{ size }}px
          </button>
        }
      </div>

      <label class="property-sublabel">Brush Color</label>
      <app-color-palette-picker
        [currentColor]="color()"
        [presets]="colorPresets"
        (colorChange)="colorChange.emit($event)" />

      <p class="property-tip">Click and drag directly on the canvas to draw freely.</p>
    </div>
  `
})
export class DrawPanelComponent {
  readonly strokeWidth = input.required<number>();
  readonly color = input.required<string>();

  readonly strokeWidthChange = output<number>();
  readonly colorChange = output<string>();

  readonly strokeWidths = [2, 4, 6, 8];

  readonly colorPresets: ColorPreset[] = [
    { value: 'var(--pt-teal-700)', cssClass: 'teal', title: 'Teal' },
    { value: 'var(--pt-navy)', cssClass: 'navy', title: 'Navy' },
    { value: 'var(--pt-coral)', cssClass: 'coral', title: 'Coral' },
    { value: 'var(--pt-navy-deep)', cssClass: 'black', title: 'Deep Navy' }
  ];
}

