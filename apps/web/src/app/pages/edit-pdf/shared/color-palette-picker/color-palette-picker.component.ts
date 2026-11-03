import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ColorPreset {
  value: string;
  cssClass: string;
  title: string;
}

@Component({
  selector: 'app-color-palette-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="color-palette-row">
      <div class="color-swatches-group">
        @for (preset of presets(); track preset.value) {
          <button
            type="button"
            class="color-dot"
            [class]="preset.cssClass"
            [class.active]="currentColor() === preset.value"
            (mousedown)="$event.preventDefault()"
            (click)="colorChange.emit(preset.value)"
            [title]="preset.title">
          </button>
        }
      </div>

      <div class="custom-color-wrap">
        <label class="custom-color-btn" [class.active]="isCustomActive()" title="Choose custom color">
          <input
            type="color"
            class="custom-color-input"
            [ngModel]="customColorValue()"
            (ngModelChange)="colorChange.emit($event)" />
          <span>+ Custom</span>
        </label>
      </div>
    </div>
  `,
  styles: [`
    .color-palette-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .color-swatches-group {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .color-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.1s ease;
      box-sizing: border-box;
    }
    .color-dot:hover {
      transform: scale(1.15);
    }
    .color-dot.active {
      box-shadow: 0 0 0 2px var(--pt-surface-white, #ffffff), 0 0 0 4px var(--pt-teal-700, #0f766e);
    }
    .color-dot.navy { background: var(--pt-navy, #14213d); }
    .color-dot.black { background: var(--pt-navy-deep, #0d1629); }
    .color-dot.teal { background: var(--pt-teal-700, #0f766e); }
    .color-dot.coral { background: var(--pt-coral, #e05d44); }
    .color-dot.amber { background: var(--pt-amber, #d97706); }
    .color-dot.white { background: var(--pt-surface-white, #ffffff); border-color: var(--pt-outline, #cbd5e1); }

    .custom-color-wrap {
      display: flex;
      align-items: center;
    }
    .custom-color-btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      border: 1px dashed var(--pt-outline, #cbd5e1);
      border-radius: var(--pt-radius-xs, 4px);
      cursor: pointer;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--pt-navy, #14213d);
      transition: all 0.15s ease;
    }
    .custom-color-btn:hover,
    .custom-color-btn.active {
      border-color: var(--pt-teal-700, #0f766e);
      background: var(--pt-teal-50, #f0fdfa);
    }
    .custom-color-input {
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      padding: 0;
      cursor: pointer;
      border-radius: 50%;
    }
  `]
})
export class ColorPalettePickerComponent {
  readonly currentColor = input.required<string>();
  readonly presets = input.required<ColorPreset[]>();
  readonly colorChange = output<string>();

  readonly isCustomActive = computed(() => {
    const c = this.currentColor();
    return !!c && !c.startsWith('var(');
  });

  readonly customColorValue = computed(() => {
    return this.isCustomActive() ? this.currentColor() : '#14213D';
  });

  onCustomChange(hex: string): void {
    this.colorChange.emit(hex);
  }
}
