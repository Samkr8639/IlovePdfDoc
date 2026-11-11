import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { deriveInitials, SIGN_SCRIPT_FONTS } from '@paperflow/contracts';
import { SignatureImageService } from '../../../../core/services/sign-pdf/signature-image.service';
import { SignatureStorageService } from '../../../../core/services/sign-pdf/signature-storage.service';
import {
  SavedSignatureRecord,
  SignatureDialogKind,
  SignatureDialogTab
} from '../../../../core/services/sign-pdf/sign-pdf.models';

export interface SignatureApplyResult {
  imageDataUrl: string;
  mode: SignatureDialogTab;
  text?: string;
  fontId?: string;
  color: string;
}

interface StrokePath {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

@Component({
  selector: 'app-sign-signature-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="sign-modal-backdrop"
      role="presentation"
      (click)="onBackdropClick($event)">
      <div
        #dialogContainer
        class="sign-modal-card"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="'sig-dialog-title'">

        <!-- Header -->
        <div class="sign-modal-header">
          <div>
            <h2 id="sig-dialog-title" class="sign-modal-title">
              {{ kind() === 'initials' ? 'Create Your Initials' : 'Create Your Signature' }}
            </h2>
            <p class="sign-modal-subtitle">
              Draw, type with bundled calligraphy fonts, or upload a clean transparent PNG/JPG.
            </p>
          </div>
          <button
            type="button"
            class="sign-modal-close"
            (click)="cancelled.emit()"
            aria-label="Close signature dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="sign-tabs-bar" role="tablist" aria-label="Signature creation method">
          <button
            type="button"
            role="tab"
            class="sign-tab-btn"
            [class.active]="activeTab() === 'draw'"
            [attr.aria-selected]="activeTab() === 'draw'"
            (click)="switchTab('draw')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Draw</span>
          </button>

          <button
            type="button"
            role="tab"
            class="sign-tab-btn"
            [class.active]="activeTab() === 'type'"
            [attr.aria-selected]="activeTab() === 'type'"
            (click)="switchTab('type')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            <span>Type</span>
          </button>

          <button
            type="button"
            role="tab"
            class="sign-tab-btn"
            [class.active]="activeTab() === 'upload'"
            [attr.aria-selected]="activeTab() === 'upload'"
            (click)="switchTab('upload')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Upload</span>
          </button>
        </div>

        @if (dialogError()) {
          <div class="sign-inline-error" role="alert">
            <span>{{ dialogError() }}</span>
          </div>
        }

        <!-- Tab Body -->
        <div class="sign-modal-body">
          @if (activeTab() === 'draw') {
            <div class="draw-controls-bar">
              <div class="swatch-group" role="group" aria-label="Ink color">
                @for (sw of colorSwatches; track sw.hex) {
                  <button
                    type="button"
                    class="swatch-dot"
                    [class.active]="inkColor() === sw.hex"
                    [style.background-color]="sw.hex"
                    [attr.aria-label]="sw.label"
                    [attr.aria-pressed]="inkColor() === sw.hex"
                    (click)="inkColor.set(sw.hex)">
                  </button>
                }
                <label class="custom-color-wrap" title="Custom ink color">
                  <input
                    type="color"
                    [ngModel]="inkColor()"
                    (ngModelChange)="inkColor.set($event)"
                    aria-label="Custom ink color" />
                </label>
              </div>

              <div class="thickness-group" role="group" aria-label="Stroke thickness">
                @for (th of thicknesses; track th.px) {
                  <button
                    type="button"
                    class="pill-toggle-sm"
                    [class.active]="strokeWidth() === th.px"
                    (click)="strokeWidth.set(th.px)">
                    {{ th.label }}
                  </button>
                }
              </div>

              <div class="pad-utility-btns">
                <button
                  type="button"
                  class="btn-text-sm"
                  [disabled]="strokes().length === 0"
                  (click)="undoStroke()">
                  Undo
                </button>
                <button
                  type="button"
                  class="btn-text-sm danger"
                  [disabled]="strokes().length === 0"
                  (click)="clearCanvas()">
                  Clear
                </button>
              </div>
            </div>

            <div class="draw-canvas-shell">
              <canvas
                #drawCanvas
                class="draw-pad-canvas"
                width="560"
                height="180"
                [attr.aria-label]="kind() === 'initials' ? 'Draw your initials here' : 'Draw your signature here'"
                (pointerdown)="onPointerDown($event)"
                (pointermove)="onPointerMove($event)"
                (pointerup)="onPointerUp($event)"
                (pointercancel)="onPointerUp($event)">
              </canvas>
              @if (strokes().length === 0) {
                <span class="draw-placeholder-hint" aria-hidden="true">
                  {{ kind() === 'initials' ? 'Draw initials with mouse, touch, or stylus' : 'Sign smoothly inside the box' }}
                </span>
              }
            </div>
          }

          @if (activeTab() === 'type') {
            <div class="type-inputs-row">
              <div class="type-input-col">
                <label class="field-caption" for="sig-type-input">
                  {{ kind() === 'initials' ? 'Initials text' : 'Full name' }}
                </label>
                <input
                  id="sig-type-input"
                  #typeNameInput
                  type="text"
                  class="pt-text-input"
                  [maxlength]="kind() === 'initials' ? 12 : 80"
                  [placeholder]="kind() === 'initials' ? 'e.g. SK' : 'Enter your full name'"
                  [ngModel]="typedValue()"
                  (ngModelChange)="onTypedValueChange($event)" />
              </div>

              <div class="swatch-group" role="group" aria-label="Ink color">
                @for (sw of colorSwatches; track sw.hex) {
                  <button
                    type="button"
                    class="swatch-dot"
                    [class.active]="inkColor() === sw.hex"
                    [style.background-color]="sw.hex"
                    [attr.aria-label]="sw.label"
                    (click)="inkColor.set(sw.hex)">
                  </button>
                }
                <label class="custom-color-wrap" title="Custom color">
                  <input type="color" [ngModel]="inkColor()" (ngModelChange)="inkColor.set($event)" aria-label="Custom color" />
                </label>
              </div>
            </div>

            <div class="fonts-radio-grid" role="radiogroup" aria-label="Calligraphy font style">
              @for (f of scriptFonts; track f.id) {
                <label class="font-radio-card" [class.selected]="selectedFontId() === f.id">
                  <input
                    type="radio"
                    name="sigFontChoice"
                    [value]="f.id"
                    [checked]="selectedFontId() === f.id"
                    (change)="selectedFontId.set(f.id)" />
                  <span
                    class="font-card-sample"
                    [style.font-family]="f.cssFamily"
                    [style.color]="inkColor()">
                    {{ typedPreviewText() }}
                  </span>
                  <span class="font-card-meta">
                    {{ f.name }}
                    @if (f.supportsDevanagari) {
                      <span class="lang-chip">Devanagari</span>
                    }
                  </span>
                </label>
              }
            </div>
          }

          @if (activeTab() === 'upload') {
            <div class="upload-zone-row">
              <input
                #fileUploadInput
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                class="sr-hidden"
                (change)="onUploadFileChange($event)" />
              <button type="button" class="btn-outline-control" (click)="fileUploadInput.click()">
                Choose PNG / JPG / WebP (max 5 MB)
              </button>

              <label class="pt-inline-check">
                <input
                  type="checkbox"
                  [ngModel]="removeWhiteBg()"
                  (ngModelChange)="onBgOptionChange($event, bgTolerance())" />
                <span>Remove white background</span>
              </label>

              @if (removeWhiteBg()) {
                <div class="tolerance-wrap">
                  <label class="field-caption" for="bg-tol-range">Tolerance: {{ bgTolerance() }}</label>
                  <input
                    id="bg-tol-range"
                    type="range"
                    min="5"
                    max="95"
                    [ngModel]="bgTolerance()"
                    (ngModelChange)="onBgOptionChange(true, $event)" />
                </div>
              }
            </div>

            @if (uploadedPreviewUrl()) {
              <div class="checkerboard-preview">
                <img [src]="uploadedPreviewUrl()!" alt="Uploaded signature preview" />
              </div>
            } @else {
              <div class="checkerboard-preview empty">
                <span>Upload a scanned or photographed signature to auto-trim margins and strip paper background.</span>
              </div>
            }
          }

          <!-- Saved Signatures List & Storage Option -->
          <div class="storage-footer-block">
            <label class="pt-inline-check">
              <input
                type="checkbox"
                [ngModel]="saveOnDevice()"
                (ngModelChange)="saveOnDevice.set($event)" />
              <span>Save this {{ kind() === 'initials' ? 'initials image' : 'signature' }} on this device (IndexedDB only, never uploaded)</span>
            </label>

            @if (storageService.isUnavailable()) {
              <p class="storage-note">{{ storageService.unavailableReason() }}</p>
            }

            @if (savedRecords().length > 0) {
              <div class="saved-sigs-section">
                <div class="saved-header-row">
                  <span class="saved-label">Saved on this device ({{ savedRecords().length }})</span>
                  <button type="button" class="btn-text-sm danger" (click)="clearAllSaved()">Clear all</button>
                </div>
                <div class="saved-thumbs-row">
                  @for (rec of savedRecords(); track rec.id) {
                    <div class="saved-thumb-chip">
                      <button
                        type="button"
                        class="saved-select-btn"
                        (click)="applySavedRecord(rec)"
                        title="Use saved signature">
                        @if (rec.previewUrl) {
                          <img [src]="rec.previewUrl" alt="Saved signature" />
                        }
                      </button>
                      <button
                        type="button"
                        class="saved-delete-btn"
                        aria-label="Delete saved signature"
                        (click)="deleteSavedRecord(rec)">
                        ×
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="sign-modal-footer">
          <button type="button" class="btn-outline-control" (click)="cancelled.emit()">Cancel</button>
          <button
            #applyButton
            type="button"
            class="btn-primary-control"
            [disabled]="!canApply()"
            (click)="confirmApply()">
            Use {{ kind() === 'initials' ? 'Initials' : 'Signature' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sign-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(13, 22, 41, 0.65);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .sign-modal-card {
      width: 100%;
      max-width: 640px;
      max-height: 92vh;
      background: var(--pt-surface-white);
      border-radius: var(--pt-radius-xl);
      border: 1px solid var(--pt-soft-outline);
      box-shadow: var(--pt-shadow-float);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: var(--pt-font-body);
    }
    .sign-modal-header {
      padding: 18px 22px;
      background: var(--pt-subtle-bg);
      border-bottom: 1px solid var(--pt-soft-outline);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .sign-modal-title {
      font-family: var(--pt-font-heading);
      font-size: 18px;
      font-weight: 800;
      color: var(--pt-navy);
      margin: 0 0 2px;
    }
    .sign-modal-subtitle {
      font-size: 13px;
      color: var(--pt-muted);
      margin: 0;
    }
    .sign-modal-close {
      background: transparent;
      border: none;
      color: var(--pt-muted);
      padding: 6px;
      border-radius: var(--pt-radius-sm);
      cursor: pointer;
    }
    .sign-modal-close:hover { background: var(--pt-soft-outline); color: var(--pt-navy); }
    .sign-tabs-bar {
      display: flex;
      border-bottom: 1px solid var(--pt-soft-outline);
      background: var(--pt-surface-white);
      padding: 0 22px;
      gap: 8px;
    }
    .sign-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 12px 14px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      font-family: var(--pt-font-body);
      font-size: 13.5px;
      font-weight: 600;
      color: var(--pt-muted);
      cursor: pointer;
    }
    .sign-tab-btn.active {
      color: var(--pt-teal-700);
      border-bottom-color: var(--pt-teal-700);
    }
    .sign-inline-error {
      margin: 12px 22px 0;
      padding: 10px 14px;
      border-radius: var(--pt-radius-sm);
      background: var(--pt-coral-subtle);
      color: var(--pt-coral-hover);
      font-size: 13px;
      font-weight: 600;
    }
    .sign-modal-body {
      padding: 18px 22px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .draw-controls-bar, .type-inputs-row, .upload-zone-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .type-input-col { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 4px; }
    .field-caption { font-size: 12px; font-weight: 700; color: var(--pt-muted); }
    .pt-text-input {
      height: 40px;
      padding: 0 12px;
      border-radius: var(--pt-radius-sm);
      border: 1px solid var(--pt-outline);
      font-family: var(--pt-font-body);
      font-size: 14px;
      color: var(--pt-navy);
      width: 100%;
    }
    .swatch-group { display: inline-flex; align-items: center; gap: 8px; }
    .swatch-dot {
      width: 24px;
      height: 24px;
      border-radius: var(--pt-radius-pill);
      border: 2px solid var(--pt-soft-outline);
      cursor: pointer;
    }
    .swatch-dot.active { box-shadow: 0 0 0 2px var(--pt-surface-white), 0 0 0 4px var(--pt-teal-700); }
    .custom-color-wrap input {
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid var(--pt-outline);
      border-radius: var(--pt-radius-xs);
      cursor: pointer;
      background: transparent;
    }
    .thickness-group, .pad-utility-btns { display: inline-flex; align-items: center; gap: 6px; }
    .pill-toggle-sm {
      padding: 4px 10px;
      border-radius: var(--pt-radius-pill);
      border: 1px solid var(--pt-outline);
      background: var(--pt-surface-white);
      font-family: var(--pt-font-body);
      font-size: 12px;
      font-weight: 600;
      color: var(--pt-text-body);
      cursor: pointer;
    }
    .pill-toggle-sm.active {
      border-color: var(--pt-teal-700);
      background: var(--pt-teal-50);
      color: var(--pt-teal-800);
    }
    .btn-text-sm {
      background: none;
      border: none;
      font-family: var(--pt-font-body);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--pt-teal-700);
      cursor: pointer;
      padding: 4px 6px;
    }
    .btn-text-sm.danger { color: var(--pt-coral-hover); }
    .btn-text-sm:disabled { opacity: 0.4; cursor: not-allowed; }
    .draw-canvas-shell {
      position: relative;
      border: 1.5px dashed var(--pt-outline);
      border-radius: var(--pt-radius-md);
      background: var(--pt-subtle-bg);
      overflow: hidden;
    }
    .draw-pad-canvas {
      display: block;
      width: 100%;
      height: 180px;
      touch-action: none;
      cursor: crosshair;
    }
    .draw-placeholder-hint {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      color: var(--pt-muted-light);
      font-size: 13px;
    }
    .fonts-radio-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    @media (max-width: 560px) { .fonts-radio-grid { grid-template-columns: 1fr; } }
    .font-radio-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px;
      border: 1.5px solid var(--pt-soft-outline);
      border-radius: var(--pt-radius-md);
      background: var(--pt-surface-white);
      cursor: pointer;
    }
    .font-radio-card input { position: absolute; opacity: 0; }
    .font-radio-card.selected {
      border-color: var(--pt-teal-700);
      background: var(--pt-teal-50);
    }
    .font-card-sample {
      font-size: 24px;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .font-card-meta {
      font-size: 11.5px;
      color: var(--pt-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .lang-chip {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: var(--pt-radius-xs);
      background: var(--pt-teal-100);
      color: var(--pt-teal-800);
    }
    .checkerboard-preview {
      min-height: 130px;
      max-height: 180px;
      padding: 12px;
      border-radius: var(--pt-radius-md);
      border: 1px solid var(--pt-soft-outline);
      background-color: var(--pt-surface-white);
      background-image:
        linear-gradient(45deg, var(--pt-subtle-bg-alt) 25%, transparent 25%),
        linear-gradient(-45deg, var(--pt-subtle-bg-alt) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--pt-subtle-bg-alt) 75%),
        linear-gradient(-45deg, transparent 75%, var(--pt-subtle-bg-alt) 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .checkerboard-preview img { max-height: 140px; max-width: 100%; object-fit: contain; }
    .checkerboard-preview.empty { font-size: 13px; color: var(--pt-muted); text-align: center; }
    .pt-inline-check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--pt-navy);
      cursor: pointer;
    }
    .pt-inline-check input { width: 16px; height: 16px; accent-color: var(--pt-teal-700); }
    .tolerance-wrap { display: flex; align-items: center; gap: 8px; }
    .tolerance-wrap input[type="range"] { accent-color: var(--pt-teal-700); }
    .storage-footer-block {
      padding-top: 10px;
      border-top: 1px solid var(--pt-soft-outline);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .storage-note { font-size: 12px; color: var(--pt-amber); margin: 0; }
    .saved-header-row { display: flex; justify-content: space-between; align-items: center; }
    .saved-label { font-size: 12px; font-weight: 700; color: var(--pt-muted); }
    .saved-thumbs-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .saved-thumb-chip {
      position: relative;
      border: 1px solid var(--pt-soft-outline);
      border-radius: var(--pt-radius-sm);
      background: var(--pt-subtle-bg);
      padding: 4px;
    }
    .saved-select-btn {
      border: none;
      background: transparent;
      padding: 4px 16px 4px 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .saved-select-btn img { height: 32px; max-width: 96px; object-fit: contain; }
    .saved-delete-btn {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      border-radius: var(--pt-radius-pill);
      border: none;
      background: var(--pt-surface-white);
      color: var(--pt-muted);
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
    }
    .saved-delete-btn:hover { color: var(--pt-coral-hover); background: var(--pt-coral-subtle); }
    .sign-modal-footer {
      padding: 14px 22px;
      border-top: 1px solid var(--pt-soft-outline);
      background: var(--pt-subtle-bg);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-outline-control {
      height: 40px;
      padding: 0 16px;
      border-radius: var(--pt-radius-sm);
      border: 1px solid var(--pt-outline);
      background: var(--pt-surface-white);
      color: var(--pt-navy);
      font-family: var(--pt-font-body);
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary-control {
      height: 40px;
      padding: 0 20px;
      border-radius: var(--pt-radius-sm);
      border: none;
      background: var(--pt-teal-700);
      color: var(--pt-surface-white);
      font-family: var(--pt-font-heading);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-primary-control:hover:not(:disabled) { background: var(--pt-teal-800); }
    .btn-primary-control:disabled { background: var(--pt-outline); cursor: not-allowed; }
    .sr-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  `]
})
export class SignSignatureDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly kind = input<SignatureDialogKind>('signature');
  readonly initialName = input<string>('');
  readonly initialTab = input<SignatureDialogTab>('draw');

  readonly applied = output<SignatureApplyResult>();
  readonly cancelled = output<void>();

  readonly storageService = inject(SignatureStorageService);
  private readonly imageService = inject(SignatureImageService);

  @ViewChild('dialogContainer') dialogContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('drawCanvas') drawCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('applyButton') applyButton?: ElementRef<HTMLButtonElement>;

  readonly scriptFonts = SIGN_SCRIPT_FONTS;
  readonly colorSwatches = [
    { hex: '#111827', label: 'Black ink' },
    { hex: '#14213D', label: 'Navy ink' },
    { hex: '#1D4ED8', label: 'Blue ink' }
  ];
  readonly thicknesses = [
    { px: 2, label: 'Fine' },
    { px: 4, label: 'Medium' },
    { px: 7, label: 'Bold' }
  ];

  readonly activeTab = signal<SignatureDialogTab>('draw');
  readonly inkColor = signal<string>('#14213D');
  readonly strokeWidth = signal<number>(4);
  readonly strokes = signal<StrokePath[]>([]);
  readonly typedValue = signal<string>('');
  readonly selectedFontId = signal<string>(SIGN_SCRIPT_FONTS[1].id);
  readonly removeWhiteBg = signal<boolean>(true);
  readonly bgTolerance = signal<number>(32);
  readonly uploadedPreviewUrl = signal<string | null>(null);
  readonly saveOnDevice = signal<boolean>(false); // Default OFF per privacy spec
  readonly savedRecords = signal<SavedSignatureRecord[]>([]);
  readonly dialogError = signal<string | null>(null);

  private activeStroke: StrokePath | null = null;
  private isDrawing = false;
  private lastValidatedUpload: { format: 'png' | 'jpeg' | 'webp'; bytes: Uint8Array } | null = null;
  private prevFocusedEl: HTMLElement | null = null;

  readonly typedPreviewText = computed(() => {
    const val = this.typedValue().trim();
    if (val) return val;
    return this.kind() === 'initials' ? 'SK' : 'Your Signature';
  });

  readonly canApply = computed(() => {
    switch (this.activeTab()) {
      case 'draw':
        return this.strokes().length > 0;
      case 'type':
        return this.typedValue().trim().length > 0;
      case 'upload':
        return !!this.uploadedPreviewUrl();
    }
  });

  ngOnInit(): void {
    this.activeTab.set(this.initialTab());
    const init = (this.initialName() || this.storageService.getRememberedSignerName() || '').trim();
    this.typedValue.set(this.kind() === 'initials' ? deriveInitials(init) : init);
    void this.loadSavedRecords();
  }

  ngAfterViewInit(): void {
    this.prevFocusedEl = (document.activeElement as HTMLElement) || null;
    setTimeout(() => {
      this.dialogContainer?.nativeElement.querySelector<HTMLElement>('button, input')?.focus();
    }, 30);
  }

  ngOnDestroy(): void {
    this.revokeSavedUrls();
    if (this.prevFocusedEl && typeof this.prevFocusedEl.focus === 'function') {
      this.prevFocusedEl.focus();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    event.preventDefault();
    this.cancelled.emit();
  }

  @HostListener('keydown', ['$event'])
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.dialogContainer) return;
    const focusables = this.dialogContainer.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelled.emit();
    }
  }

  switchTab(tab: SignatureDialogTab): void {
    this.dialogError.set(null);
    this.activeTab.set(tab);
    if (tab === 'draw') {
      setTimeout(() => this.redrawCanvas(), 0);
    }
  }

  onTypedValueChange(val: string): void {
    this.typedValue.set(val);
    if (/[\u0900-\u097F]/.test(val)) {
      this.selectedFontId.set('kalam');
    }
  }

  onPointerDown(event: PointerEvent): void {
    const canvas = this.drawCanvas?.nativeElement;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);
    const pt = this.getCanvasPoint(canvas, event);
    this.activeStroke = {
      color: this.inkColor(),
      width: this.strokeWidth(),
      points: [pt]
    };
    this.isDrawing = true;
    this.strokes.update(list => [...list, this.activeStroke!]);
    this.redrawCanvas();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDrawing || !this.activeStroke) return;
    const canvas = this.drawCanvas?.nativeElement;
    if (!canvas) return;
    const pt = this.getCanvasPoint(canvas, event);
    this.activeStroke.points.push(pt);
    this.redrawCanvas();
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDrawing) return;
    const canvas = this.drawCanvas?.nativeElement;
    if (canvas) canvas.releasePointerCapture?.(event.pointerId);
    this.isDrawing = false;
    this.activeStroke = null;
  }

  undoStroke(): void {
    this.strokes.update(s => s.slice(0, -1));
    this.redrawCanvas();
  }

  clearCanvas(): void {
    this.strokes.set([]);
    this.redrawCanvas();
  }

  async onUploadFileChange(event: Event): Promise<void> {
    this.dialogError.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const val = await this.imageService.validateUploadedImage(file);
    if (!val.valid || !val.image) {
      this.dialogError.set(val.error || 'Invalid image file.');
      return;
    }
    this.lastValidatedUpload = val.image;
    await this.reprocessUploadedPreview();
  }

  async onBgOptionChange(removeBg: boolean, tolerance: number): Promise<void> {
    this.removeWhiteBg.set(removeBg);
    this.bgTolerance.set(tolerance);
    if (this.lastValidatedUpload) {
      await this.reprocessUploadedPreview();
    }
  }

  private async reprocessUploadedPreview(): Promise<void> {
    if (!this.lastValidatedUpload) return;
    try {
      const processed = await this.imageService.processUploadedImageToPng(this.lastValidatedUpload, {
        removeWhiteBg: this.removeWhiteBg(),
        tolerance: this.bgTolerance()
      });
      this.uploadedPreviewUrl.set(processed.dataUrl);
    } catch (err: any) {
      this.dialogError.set(err?.message || 'Failed to process uploaded signature.');
    }
  }

  async confirmApply(): Promise<void> {
    this.dialogError.set(null);
    let dataUrl: string | null = null;
    const tab = this.activeTab();

    if (tab === 'draw') {
      const canvas = this.drawCanvas?.nativeElement;
      if (canvas) {
        dataUrl = this.imageService.trimCanvasToPngDataUrl(canvas, 10) || canvas.toDataURL('image/png');
      }
    } else if (tab === 'type') {
      const font = this.scriptFonts.find(f => f.id === this.selectedFontId()) || this.scriptFonts[0];
      dataUrl = this.imageService.renderTypedSignatureToPngDataUrl(
        this.typedValue(),
        font.cssFamily,
        this.inkColor(),
        this.kind() === 'initials' ? 54 : 56
      );
    } else {
      dataUrl = this.uploadedPreviewUrl();
    }

    if (!dataUrl) {
      this.dialogError.set('Please draw, type, or upload a valid image first.');
      return;
    }

    if (this.saveOnDevice()) {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await this.storageService.save({
          id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: this.kind(),
          pngBlob: blob,
          label: tab === 'type' ? this.typedValue().trim() : undefined,
          created: Date.now()
        });
      } catch {
        // Storage failures degrade silently per spec
      }
    }

    this.applied.emit({
      imageDataUrl: dataUrl,
      mode: tab,
      text: tab === 'type' ? this.typedValue().trim() : undefined,
      fontId: tab === 'type' ? this.selectedFontId() : undefined,
      color: this.inkColor()
    });
  }

  async applySavedRecord(rec: SavedSignatureRecord): Promise<void> {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.applied.emit({
          imageDataUrl: reader.result,
          mode: 'upload',
          text: rec.label,
          color: this.inkColor()
        });
      }
    };
    reader.readAsDataURL(rec.pngBlob);
  }

  async deleteSavedRecord(rec: SavedSignatureRecord): Promise<void> {
    await this.storageService.delete(rec.id);
    if (rec.previewUrl) URL.revokeObjectURL(rec.previewUrl);
    this.savedRecords.update(list => list.filter(item => item.id !== rec.id));
  }

  async clearAllSaved(): Promise<void> {
    await this.storageService.clearAll();
    this.revokeSavedUrls();
    this.savedRecords.set([]);
  }

  private async loadSavedRecords(): Promise<void> {
    const rows = await this.storageService.list(this.kind());
    this.revokeSavedUrls();
    const withUrls = rows.map(r => ({
      ...r,
      previewUrl: URL.createObjectURL(r.pngBlob)
    }));
    this.savedRecords.set(withUrls);
  }

  private revokeSavedUrls(): void {
    for (const r of this.savedRecords()) {
      if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
    }
  }

  private getCanvasPoint(canvas: HTMLCanvasElement, ev: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY
    };
  }

  private redrawCanvas(): void {
    const canvas = this.drawCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of this.strokes()) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      if (stroke.points.length === 1) {
        ctx.lineTo(stroke.points[0].x + 0.5, stroke.points[0].y + 0.5);
      } else {
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
          const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x, last.y);
      }
      ctx.stroke();
    }
  }
}
