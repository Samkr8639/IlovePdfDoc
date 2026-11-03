import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LowConfidenceWord } from '../../../models/document-model';
import { TessdataLanguage } from '@paperflow/contracts';

@Component({
  selector: 'app-ocr-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="section-badge-title">OCR RECOGNITION</div>
    <div class="ocr-properties-panel">
      <!-- Page Range -->
      <div class="property-group">
        <label class="property-label">Pages to process</label>
        <div class="page-range-selector">
          <label class="radio-option">
            <input
              type="radio"
              name="ocrPageRange"
              value="current"
              [checked]="pageRange() === 'current'"
              (change)="pageRangeChange.emit('current'); validatePageRange.emit()" />
            <span>Current page ({{ currentPageIndex() + 1 }})</span>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              name="ocrPageRange"
              value="all"
              [checked]="pageRange() === 'all'"
              (change)="pageRangeChange.emit('all'); validatePageRange.emit()" />
            <span>All pages ({{ totalPages() }})</span>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              name="ocrPageRange"
              value="custom"
              [checked]="pageRange() === 'custom'"
              (change)="pageRangeChange.emit('custom'); validatePageRange.emit()" />
            <span>Custom range</span>
          </label>
        </div>

        @if (pageRange() === 'custom') {
          <input
            type="text"
            class="custom-range-input"
            placeholder="e.g. 1-3, 5"
            [ngModel]="customRange()"
            (ngModelChange)="customRangeChange.emit($event); validatePageRange.emit()" />
          @if (rangeError()) {
            <span class="range-error-text">{{ rangeError() }}</span>
          }
        }
      </div>

      <!-- Languages Multi-Select -->
      <div class="property-group">
        <label class="property-label">Languages (max 3)</label>
        <div class="language-chips-grid">
          @for (lang of availableLanguages(); track lang.code) {
            <button
              type="button"
              class="lang-chip"
              [class.selected]="selectedLanguages().includes(lang.code)"
              (click)="toggleLanguage.emit(lang.code)">
              {{ lang.name }}
              @if (lang.nativeName) {
                <span class="native-name">({{ lang.nativeName }})</span>
              }
            </button>
          }
        </div>
      </div>

      <!-- Deskew Option -->
      <div class="property-group">
        <label class="checkbox-option">
          <input
            type="checkbox"
            [checked]="deskew()"
            (change)="deskewChange.emit(!deskew())" />
          <span>Straighten skewed pages</span>
        </label>
      </div>

      <!-- Result Mode Radio Cards -->
      <div class="property-group">
        <label class="property-label">Result mode</label>
        <div class="result-mode-cards">
          <label class="mode-card" [class.active]="mode() === 'searchable'">
            <input
              type="radio"
              name="ocrResultMode"
              value="searchable"
              [checked]="mode() === 'searchable'"
              (change)="modeChange.emit('searchable')" />
            <div class="mode-card-text">
              <span class="mode-card-title">Searchable text</span>
              <span class="mode-card-desc">Keeps page looking identical with invisible selectable text.</span>
            </div>
          </label>

          <label class="mode-card" [class.active]="mode() === 'editable'">
            <input
              type="radio"
              name="ocrResultMode"
              value="editable"
              [checked]="mode() === 'editable'"
              (change)="modeChange.emit('editable')" />
            <div class="mode-card-text">
              <span class="mode-card-title">Editable text boxes</span>
              <span class="mode-card-desc">Replaces lines with text boxes you can edit and change.</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Recognize Button -->
      <button
        type="button"
        class="btn-recognize"
        [disabled]="isRunning() || rangeError() !== null"
        (click)="startRecognition.emit()">
        <svg
          class="lucide-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
        <span>Recognise text</span>
      </button>

      <!-- Low Confidence Review List -->
      @if (lowConfidenceReviewWords().length > 0) {
        <div class="review-box">
          <div class="review-header">
            <span class="review-title">Review Flagged Words</span>
            <span class="review-badge">{{ lowConfidenceReviewWords().length }}</span>
          </div>
          <div class="review-list">
            @for (w of lowConfidenceReviewWords(); track w.text) {
              <button
                type="button"
                class="review-item-btn"
                (click)="jumpToWord.emit(w)">
                <span class="review-word-text">"{{ w.text }}"</span>
                <span class="review-page-tag">p. {{ w.pageIndex + 1 }} ({{ w.confidence }}%)</span>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class OcrPanelComponent {
  readonly pageRange = input<'current' | 'all' | 'custom'>('current');
  readonly customRange = input<string>('');
  readonly rangeError = input<string | null>(null);
  readonly currentPageIndex = input<number>(0);
  readonly totalPages = input<number>(1);
  readonly availableLanguages = input<readonly TessdataLanguage[] | readonly { code: string; name: string; nativeName?: string }[]>([]);
  readonly selectedLanguages = input<string[]>(['eng']);
  readonly deskew = input<boolean>(false);
  readonly mode = input<'searchable' | 'editable'>('searchable');
  readonly isRunning = input<boolean>(false);
  readonly lowConfidenceReviewWords = input<LowConfidenceWord[]>([]);

  readonly pageRangeChange = output<'current' | 'all' | 'custom'>();
  readonly customRangeChange = output<string>();
  readonly validatePageRange = output<void>();
  readonly toggleLanguage = output<string>();
  readonly deskewChange = output<boolean>();
  readonly modeChange = output<'searchable' | 'editable'>();
  readonly startRecognition = output<void>();
  readonly jumpToWord = output<LowConfidenceWord>();
}
