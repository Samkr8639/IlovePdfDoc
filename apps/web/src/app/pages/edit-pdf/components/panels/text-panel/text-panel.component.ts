import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ColorPalettePickerComponent,
  ColorPreset
} from '../../../shared/color-palette-picker/color-palette-picker.component';

@Component({
  selector: 'app-text-panel',
  standalone: true,
  imports: [FormsModule, ColorPalettePickerComponent],
  template: `
    <div class="section-badge-title">TEXT STYLES</div>
    <div class="property-panel-card text-styles-card">
      <!-- Row 1: Font Family and Size -->
      <div class="property-row font-size-row">
        <select class="font-select" [ngModel]="textFont()" (ngModelChange)="textFontChange.emit($event)">
          <option value="Inter">Inter</option>
          <option value="Calibri">Calibri</option>
          <option value="Roboto">Roboto</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Sora">Sora</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
        </select>
        <div class="size-stepper-wrap">
          <input type="number" class="font-size-input" [ngModel]="textSize()"
            (ngModelChange)="textSizeChange.emit($event)" min="6" max="120" />
          <span class="size-unit">pt</span>
        </div>
      </div>

      <!-- Row 2: Formatting B / I / U & Alignments -->
      <div class="formatting-actions-row">
        <div class="style-toggle-group">
          <button type="button" class="style-toggle-btn" [class.active]="isTextBold()"
            (mousedown)="$event.preventDefault()" (click)="toggleBold.emit()" title="Bold">
            B
          </button>
          <button type="button" class="style-toggle-btn" [class.active]="isTextItalic()"
            (mousedown)="$event.preventDefault()" (click)="toggleItalic.emit()" title="Italic">
            I
          </button>
          <button type="button" class="style-toggle-btn underline-btn" [class.active]="isTextUnderline()"
            (mousedown)="$event.preventDefault()" (click)="toggleUnderline.emit()" title="Underline">
            U
          </button>
          <button type="button" class="style-toggle-btn link-btn"
            [class.active]="showTextLinkInput() || isTextLinked()"
            (mousedown)="$event.preventDefault()" (click)="toggleLinkInput.emit()" title="Embed Link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        </div>

        <div class="style-toggle-group align-group">
          <button type="button" class="style-toggle-btn" [class.active]="textAlign() === 'left'"
            (mousedown)="$event.preventDefault()" (click)="textAlignChange.emit('left')" title="Align Left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="17" y1="10" x2="3" y2="10" />
              <line x1="21" y1="6" x2="3" y2="6" />
              <line x1="21" y1="14" x2="3" y2="14" />
              <line x1="17" y1="18" x2="3" y2="18" />
            </svg>
          </button>
          <button type="button" class="style-toggle-btn" [class.active]="textAlign() === 'center'"
            (mousedown)="$event.preventDefault()" (click)="textAlignChange.emit('center')" title="Align Center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="10" x2="6" y2="10" />
              <line x1="21" y1="6" x2="3" y2="6" />
              <line x1="21" y1="14" x2="3" y2="14" />
              <line x1="18" y1="18" x2="6" y2="18" />
            </svg>
          </button>
          <button type="button" class="style-toggle-btn" [class.active]="textAlign() === 'right'"
            (mousedown)="$event.preventDefault()" (click)="textAlignChange.emit('right')" title="Align Right">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="21" y1="10" x2="7" y2="10" />
              <line x1="21" y1="6" x2="3" y2="6" />
              <line x1="21" y1="14" x2="3" y2="14" />
              <line x1="21" y1="18" x2="7" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Embed Link Input Popover Bar -->
      @if (showTextLinkInput()) {
      <div class="text-link-embed-bar">
        <div class="text-link-input-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="link-icon">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <input type="url" class="text-link-url-input" placeholder="https://example.com"
            [ngModel]="textLinkUrl()" (ngModelChange)="linkUrlModel = $event"
            (keydown.enter)="applyLink.emit(linkUrlModel || textLinkUrl())"
            (keydown.escape)="closeLinkInput.emit()" />
        </div>
        <div class="text-link-actions">
          <button type="button" class="btn-link-action apply"
            (click)="applyLink.emit(linkUrlModel || textLinkUrl())" title="Apply Link">
            Link
          </button>
          @if (isTextLinked()) {
          <button type="button" class="btn-link-action remove" (click)="removeLink.emit()" title="Remove Link">
            Unlink
          </button>
          }
          <button type="button" class="btn-link-action cancel" (click)="closeLinkInput.emit()" title="Close">
            ✕
          </button>
        </div>
      </div>
      }

      <!-- Row 3: Colors & Custom Color Picker -->
      <label class="property-sublabel">Current Color</label>
      <app-color-palette-picker
        [currentColor]="textColor()"
        [presets]="textColorPresets"
        (colorChange)="textColorChange.emit($event)" />

      <!-- Action Button -->
      <button type="button" class="btn-action-primary" (click)="addTextElement.emit()">
        <span>+ Add New Text Box</span>
      </button>
    </div>
  `
})
export class TextPanelComponent {
  readonly textFont = input.required<string>();
  readonly textSize = input.required<number>();
  readonly textColor = input.required<string>();
  readonly isTextBold = input.required<boolean>();
  readonly isTextItalic = input.required<boolean>();
  readonly isTextUnderline = input.required<boolean>();
  readonly textAlign = input.required<'left' | 'center' | 'right'>();
  readonly showTextLinkInput = input.required<boolean>();
  readonly textLinkUrl = input.required<string>();
  readonly isTextLinked = input.required<boolean>();

  readonly textFontChange = output<string>();
  readonly textSizeChange = output<number>();
  readonly textColorChange = output<string>();
  readonly toggleBold = output<void>();
  readonly toggleItalic = output<void>();
  readonly toggleUnderline = output<void>();
  readonly textAlignChange = output<'left' | 'center' | 'right'>();
  readonly toggleLinkInput = output<void>();
  readonly applyLink = output<string>();
  readonly removeLink = output<void>();
  readonly closeLinkInput = output<void>();
  readonly addTextElement = output<void>();

  linkUrlModel = '';

  readonly textColorPresets: ColorPreset[] = [
    { value: 'var(--pt-navy)', cssClass: 'navy', title: 'Navy' },
    { value: 'var(--pt-teal-700)', cssClass: 'teal', title: 'Teal' },
    { value: 'var(--pt-coral)', cssClass: 'coral', title: 'Coral' },
    { value: 'var(--pt-navy-deep)', cssClass: 'black', title: 'Deep Navy' }
  ];
}
