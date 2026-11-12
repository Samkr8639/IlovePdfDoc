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
import { SignStampShape, SignStampSource } from '@paperflow/contracts';
import { SignatureImageService } from '../../../../core/services/sign-pdf/signature-image.service';
import { SavedStampRecord, SignatureStorageService } from '../../../../core/services/sign-pdf/signature-storage.service';

export interface StampApplyResult {
  imageDataUrl: string;
  source: SignStampSource;
  label: string;
  shape: SignStampShape;
  scope: 'single' | 'all';
  saveAsDefault?: boolean;
}

@Component({
  selector: 'app-sign-stamp-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stamp-backdrop" role="presentation" (click)="onBackdropClick($event)">
      <div #dialogContainer class="stamp-card" role="dialog" aria-modal="true" aria-labelledby="stamp-dialog-title">
        <div class="stamp-header">
          <div>
            <h2 id="stamp-dialog-title">
              @if (isDefaultEdit()) {
                Edit Default Company Stamp
              } @else if (isEditing()) {
                Edit Company Stamp
              } @else {
                Company Stamp
              }
            </h2>
            <p>
              @if (isDefaultEdit()) {
                Configure the default stamp used when clicking to place on documents.
              } @else if (isEditing()) {
                Modify this placed stamp's content, shape, or appearance.
              } @else {
                Build a crisp seal or upload an existing stamp PNG/JPG.
              }
            </p>
          </div>
          <button type="button" class="close-btn" (click)="cancelled.emit()" aria-label="Close stamp dialog">×</button>
        </div>

        <div class="stamp-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="tab-btn"
            [class.active]="mode() === 'build'"
            [attr.aria-selected]="mode() === 'build'"
            (click)="mode.set('build')">
            Build text stamp
          </button>
          <button
            type="button"
            role="tab"
            class="tab-btn"
            [class.active]="mode() === 'upload'"
            [attr.aria-selected]="mode() === 'upload'"
            (click)="mode.set('upload')">
            Upload stamp image
          </button>
        </div>

        @if (errorMsg()) {
          <div class="stamp-error" role="alert">{{ errorMsg() }}</div>
        }

        <div class="stamp-body">
          @if (mode() === 'build') {
            <div class="stamp-grid">
              <label class="field-group">
                <span>Primary line</span>
                <input
                  type="text"
                  class="pt-input"
                  maxlength="28"
                  [ngModel]="line1()"
                  (ngModelChange)="line1.set($event)"
                  placeholder="e.g. APPROVED" />
              </label>
              <label class="field-group">
                <span>Secondary line (optional)</span>
                <input
                  type="text"
                  class="pt-input"
                  maxlength="32"
                  placeholder="e.g. Authorized Signatory"
                  [ngModel]="line2()"
                  (ngModelChange)="line2.set($event)" />
              </label>
            </div>

            <div class="stamp-controls">
              <div class="shape-group" role="radiogroup" aria-label="Stamp border shape">
                @for (sh of shapes; track sh.value) {
                  <button
                    type="button"
                    class="pill-btn"
                    [class.active]="shape() === sh.value"
                    (click)="shape.set(sh.value)">
                    {{ sh.label }}
                  </button>
                }
              </div>

              <div class="color-group" role="group" aria-label="Stamp color">
                @for (c of presetColors; track c) {
                  <button
                    type="button"
                    class="color-dot"
                    [class.active]="color() === c"
                    [style.background-color]="c"
                    [attr.aria-label]="'Color ' + c"
                    (click)="color.set(c)">
                  </button>
                }
                <input type="color" [ngModel]="color()" (ngModelChange)="color.set($event)" aria-label="Custom stamp color" />
              </div>
            </div>
          } @else {
            <div class="upload-section">
              <div class="upload-row">
                <input
                  #uploadInput
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  class="sr-hidden"
                  (change)="onFileSelected($event)" />

                @if (!uploadedDataUrl()) {
                  <button type="button" class="btn-outline" (click)="uploadInput.click()">
                    Select Stamp Image
                  </button>
                } @else {
                  <div class="upload-action-buttons">
                    <button type="button" class="btn-outline btn-sm" (click)="uploadInput.click()">
                      Replace Image
                    </button>
                    <button type="button" class="btn-danger-outline btn-sm" (click)="clearImage()">
                      Remove Image
                    </button>
                  </div>
                }

                <label class="inline-check">
                  <input type="checkbox" [ngModel]="removeBg()" (ngModelChange)="onBgOptionChange($event, tolerance())" />
                  <span>Remove white background</span>
                </label>
              </div>

              @if (removeBg() && (lastValidated || originalDataUrl())) {
                <div class="tolerance-row">
                  <span class="tolerance-label">Tolerance: {{ tolerance() }}%</span>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    [ngModel]="tolerance()"
                    (ngModelChange)="onBgOptionChange(true, $event)"
                    aria-label="Background removal tolerance" />
                </div>
              }
            </div>
          }

          <div class="checkerboard-box">
            @if (previewDataUrl()) {
              <img [src]="previewDataUrl()!" alt="Stamp preview" />
            } @else {
              <span class="empty-hint">
                @if (mode() === 'build') {
                  Enter stamp text to generate preview.
                } @else {
                  Upload an image to preview your transparent stamp.
                }
              </span>
            }
          </div>

          <!-- Scope selector when stamp has copies across pages -->
          @if (isEditing() && hasMultipleCopies()) {
            <div class="scope-group" role="radiogroup" aria-label="Update scope">
              <span class="scope-title">Update scope:</span>
              <label class="scope-option">
                <input
                  type="radio"
                  name="stampUpdateScope"
                  value="all"
                  [checked]="updateScope() === 'all'"
                  (change)="updateScope.set('all')" />
                <span>Update all copies (Recommended)</span>
              </label>
              <label class="scope-option">
                <input
                  type="radio"
                  name="stampUpdateScope"
                  value="single"
                  [checked]="updateScope() === 'single'"
                  (change)="updateScope.set('single')" />
                <span>Update this stamp only</span>
              </label>
            </div>
          }

          <div class="dialog-options-row">
            <label class="inline-check">
              <input type="checkbox" [ngModel]="saveAsDefault()" (ngModelChange)="saveAsDefault.set($event)" />
              <span>Save as default stamp on this device</span>
            </label>
          </div>

          <!-- Saved stamps drawer -->
          @if (savedStamps().length > 0) {
            <div class="saved-stamps-section">
              <div class="saved-stamps-header">
                <span>Saved Stamps ({{ savedStamps().length }})</span>
              </div>
              <div class="saved-stamps-list">
                @for (s of savedStamps(); track s.id) {
                  <div class="saved-stamp-item" [class.selected]="isCurrentStampSaved(s)">
                    <button type="button" class="saved-stamp-preview" (click)="loadSavedStamp(s)" [attr.aria-label]="'Load stamp ' + (s.label || 'Stamp')">
                      <img [src]="s.imageDataUrl" [alt]="s.label || 'Saved stamp'" />
                    </button>
                    <span class="saved-stamp-name">{{ s.label || 'Company stamp' }}</span>
                    <button type="button" class="delete-stamp-btn" (click)="deleteSavedStamp(s.id, $event)" title="Delete saved stamp" aria-label="Delete saved stamp">
                      ✕
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div class="stamp-footer">
          <button type="button" class="btn-outline" (click)="cancelled.emit()">Cancel</button>
          <button
            type="button"
            class="btn-primary"
            [disabled]="!previewDataUrl()"
            (click)="applyStamp()">
            @if (isDefaultEdit()) {
              Save Default Stamp
            } @else if (isEditing()) {
              Update Stamp
            } @else {
              Use Stamp
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stamp-backdrop {
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
    .stamp-card {
      width: 100%;
      max-width: 560px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: var(--pt-surface-white);
      border-radius: var(--pt-radius-xl);
      border: 1px solid var(--pt-soft-outline);
      box-shadow: var(--pt-shadow-float);
      overflow: hidden;
      font-family: var(--pt-font-body);
    }
    .stamp-header {
      padding: 16px 22px;
      background: var(--pt-subtle-bg);
      border-bottom: 1px solid var(--pt-soft-outline);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .stamp-header h2 {
      font-family: var(--pt-font-heading);
      font-size: 18px;
      font-weight: 800;
      color: var(--pt-navy);
      margin: 0 0 2px;
    }
    .stamp-header p { margin: 0; font-size: 13px; color: var(--pt-muted); }
    .close-btn {
      border: none;
      background: transparent;
      font-size: 22px;
      line-height: 1;
      color: var(--pt-muted);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: var(--pt-radius-sm);
    }
    .close-btn:hover { color: var(--pt-navy); background: var(--pt-hover-bg); }
    .stamp-tabs { display: flex; border-bottom: 1px solid var(--pt-soft-outline); padding: 0 22px; gap: 10px; }
    .tab-btn {
      padding: 11px 12px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      font-family: var(--pt-font-body);
      font-size: 13.5px;
      font-weight: 600;
      color: var(--pt-muted);
      cursor: pointer;
    }
    .tab-btn.active { color: var(--pt-teal-700); border-bottom-color: var(--pt-teal-700); }
    .stamp-error {
      margin: 12px 22px 0;
      padding: 10px 12px;
      border-radius: var(--pt-radius-sm);
      background: var(--pt-coral-subtle);
      color: var(--pt-coral-hover);
      font-size: 13px;
    }
    .stamp-body {
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      overflow-y: auto;
      max-height: calc(90vh - 140px);
    }
    .stamp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 520px) { .stamp-grid { grid-template-columns: 1fr; } }
    .field-group { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: var(--pt-muted); }
    .pt-input {
      height: 38px;
      padding: 0 10px;
      border-radius: var(--pt-radius-sm);
      border: 1px solid var(--pt-outline);
      font-family: var(--pt-font-body);
      color: var(--pt-navy);
      outline: none;
    }
    .pt-input:focus { border-color: var(--pt-teal-700); }
    .stamp-controls, .upload-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .upload-section { display: flex; flex-direction: column; gap: 8px; }
    .upload-action-buttons { display: flex; align-items: center; gap: 8px; }
    .tolerance-row { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--pt-muted); }
    .tolerance-row input[type="range"] { flex: 1; accent-color: var(--pt-teal-700); }
    .shape-group, .color-group { display: flex; align-items: center; gap: 6px; }
    .pill-btn {
      padding: 5px 10px;
      border-radius: var(--pt-radius-pill);
      border: 1px solid var(--pt-outline);
      background: var(--pt-surface-white);
      font-family: var(--pt-font-body);
      font-size: 12px;
      font-weight: 600;
      color: var(--pt-text-body);
      cursor: pointer;
    }
    .pill-btn.active { border-color: var(--pt-teal-700); background: var(--pt-teal-50); color: var(--pt-teal-800); }
    .color-dot { width: 22px; height: 22px; border-radius: var(--pt-radius-pill); border: 2px solid var(--pt-soft-outline); cursor: pointer; }
    .color-dot.active { box-shadow: 0 0 0 2px var(--pt-surface-white), 0 0 0 4px var(--pt-teal-700); }
    .inline-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--pt-navy); cursor: pointer; }
    .inline-check input { accent-color: var(--pt-teal-700); }
    .checkerboard-box {
      min-height: 140px;
      padding: 14px;
      border-radius: var(--pt-radius-md);
      border: 1px solid var(--pt-soft-outline);
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
    .checkerboard-box img { max-height: 120px; max-width: 100%; object-fit: contain; }
    .empty-hint { font-size: 13px; color: var(--pt-muted); }
    .scope-group {
      padding: 10px 12px;
      background: var(--pt-teal-50);
      border: 1px solid var(--pt-teal-100);
      border-radius: var(--pt-radius-md);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .scope-title { font-size: 12px; font-weight: 700; color: var(--pt-teal-800); }
    .scope-option { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--pt-navy); cursor: pointer; }
    .scope-option input { accent-color: var(--pt-teal-700); }
    .dialog-options-row { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
    .saved-stamps-section {
      border-top: 1px solid var(--pt-soft-outline);
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .saved-stamps-header { font-size: 12px; font-weight: 700; color: var(--pt-muted); }
    .saved-stamps-list { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
    .saved-stamp-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 76px;
      padding: 6px;
      border: 1px solid var(--pt-outline);
      border-radius: var(--pt-radius-sm);
      background: var(--pt-surface-white);
    }
    .saved-stamp-item.selected { border-color: var(--pt-teal-700); background: var(--pt-teal-50); }
    .saved-stamp-preview {
      border: none;
      background: transparent;
      width: 56px;
      height: 44px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .saved-stamp-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .saved-stamp-name { font-size: 10px; color: var(--pt-navy); max-width: 68px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
    .delete-stamp-btn {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      border-radius: var(--pt-radius-pill);
      background: var(--pt-navy);
      color: white;
      border: none;
      font-size: 10px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0.7;
    }
    .delete-stamp-btn:hover { opacity: 1; background: var(--pt-coral); }
    .stamp-footer {
      padding: 14px 22px;
      border-top: 1px solid var(--pt-soft-outline);
      background: var(--pt-subtle-bg);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-outline {
      height: 38px;
      padding: 0 14px;
      border-radius: var(--pt-radius-sm);
      border: 1px solid var(--pt-outline);
      background: var(--pt-surface-white);
      color: var(--pt-navy);
      font-family: var(--pt-font-body);
      font-weight: 600;
      cursor: pointer;
    }
    .btn-outline:hover { background: var(--pt-hover-bg); }
    .btn-sm { height: 32px; padding: 0 10px; font-size: 12px; }
    .btn-danger-outline {
      height: 32px;
      padding: 0 10px;
      font-size: 12px;
      border-radius: var(--pt-radius-sm);
      border: 1px solid var(--pt-coral);
      background: var(--pt-surface-white);
      color: var(--pt-coral);
      font-weight: 600;
      cursor: pointer;
    }
    .btn-danger-outline:hover { background: var(--pt-coral-subtle); }
    .btn-primary {
      height: 38px;
      padding: 0 18px;
      border-radius: var(--pt-radius-sm);
      border: none;
      background: var(--pt-teal-700);
      color: var(--pt-surface-white);
      font-family: var(--pt-font-heading);
      font-weight: 700;
      cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: var(--pt-teal-800); }
    .btn-primary:disabled { background: var(--pt-outline); cursor: not-allowed; }
    .sr-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  `]
})
export class SignStampDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly initialStamp = input<SignStampSource | null>(null);
  readonly isEditing = input<boolean>(false);
  readonly hasMultipleCopies = input<boolean>(false);
  readonly isDefaultEdit = input<boolean>(false);

  readonly applied = output<StampApplyResult>();
  readonly cancelled = output<void>();

  private readonly imageService = inject(SignatureImageService);
  private readonly storageService = inject(SignatureStorageService);

  @ViewChild('dialogContainer') dialogContainer?: ElementRef<HTMLDivElement>;

  readonly mode = signal<'build' | 'upload'>('build');
  readonly line1 = signal<string>('APPROVED');
  readonly line2 = signal<string>('');
  readonly shape = signal<SignStampShape>('rounded');
  readonly color = signal<string>('#0F766E');
  readonly removeBg = signal<boolean>(true);
  readonly tolerance = signal<number>(32);
  readonly uploadedDataUrl = signal<string | null>(null);
  readonly originalDataUrl = signal<string | null>(null);
  readonly updateScope = signal<'single' | 'all'>('all');
  readonly saveAsDefault = signal<boolean>(false);
  readonly savedStamps = signal<SavedStampRecord[]>([]);
  readonly errorMsg = signal<string | null>(null);

  readonly shapes: Array<{ value: SignStampShape; label: string }> = [
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'rounded', label: 'Rounded' },
    { value: 'circle', label: 'Circle Seal' }
  ];
  readonly presetColors = ['#0F766E', '#14213D', '#E05D44', '#0284C7', '#D97706'];

  lastValidated: { format: 'png' | 'jpeg' | 'webp'; bytes: Uint8Array } | null = null;
  private prevFocused: HTMLElement | null = null;

  readonly previewDataUrl = computed<string | null>(() => {
    if (this.mode() === 'upload') return this.uploadedDataUrl();
    if (!this.line1().trim()) return null;
    return this.imageService.renderStampToPngDataUrl({
      line1: this.line1(),
      line2: this.line2(),
      shape: this.shape(),
      color: this.color()
    });
  });

  ngOnInit(): void {
    const init = this.initialStamp();
    if (init) {
      if (init.kind === 'text') {
        this.mode.set('build');
        this.line1.set(init.lines?.[0] || 'APPROVED');
        this.line2.set(init.lines?.[1] || '');
        this.shape.set((init.shape === 'rect' ? 'rectangle' : init.shape) || 'rounded');
        this.color.set(init.color || '#0F766E');
      } else if (init.kind === 'image') {
        this.mode.set('upload');
        const img = init.processedDataUrl || init.originalDataUrl || null;
        this.uploadedDataUrl.set(img);
        this.originalDataUrl.set(init.originalDataUrl || img);
        this.removeBg.set(init.removeBackground ?? true);
        this.tolerance.set(init.tolerance ?? 32);
      }
    }

    this.loadSavedStampsList();
  }

  private async loadSavedStampsList(): Promise<void> {
    try {
      const list = await this.storageService.listStamps();
      this.savedStamps.set(list);
    } catch {
      // Ignore
    }
  }

  isCurrentStampSaved(record: SavedStampRecord): boolean {
    return this.previewDataUrl() === record.imageDataUrl;
  }

  loadSavedStamp(record: SavedStampRecord): void {
    if (record.source.kind === 'text') {
      this.mode.set('build');
      this.line1.set(record.source.lines?.[0] || 'APPROVED');
      this.line2.set(record.source.lines?.[1] || '');
      this.shape.set((record.source.shape === 'rect' ? 'rectangle' : record.source.shape) || 'rounded');
      this.color.set(record.source.color || '#0F766E');
    } else if (record.source.kind === 'image') {
      this.mode.set('upload');
      this.uploadedDataUrl.set(record.imageDataUrl);
      this.originalDataUrl.set(record.source.originalDataUrl || record.imageDataUrl);
      this.removeBg.set(record.source.removeBackground ?? true);
      this.tolerance.set(record.source.tolerance ?? 32);
    }
  }

  async deleteSavedStamp(id: string, ev: MouseEvent): Promise<void> {
    ev.stopPropagation();
    await this.storageService.deleteStamp(id);
    await this.loadSavedStampsList();
  }

  ngAfterViewInit(): void {
    this.prevFocused = (document.activeElement as HTMLElement) || null;
    setTimeout(() => this.dialogContainer?.nativeElement.querySelector<HTMLElement>('input, button')?.focus(), 20);
  }

  ngOnDestroy(): void {
    this.prevFocused?.focus();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(e: Event): void {
    e.preventDefault();
    this.cancelled.emit();
  }

  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.cancelled.emit();
  }

  clearImage(): void {
    this.uploadedDataUrl.set(null);
    this.originalDataUrl.set(null);
    this.lastValidated = null;
  }

  async onFileSelected(ev: Event): Promise<void> {
    this.errorMsg.set(null);
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const val = await this.imageService.validateUploadedImage(f);
    if (!val.valid || !val.image) {
      this.errorMsg.set(val.error || 'Invalid stamp image.');
      return;
    }
    this.lastValidated = val.image;

    // Convert to original data URL for storage
    const mime = val.image.format === 'png' ? 'image/png' : val.image.format === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = new Blob([val.image.bytes.slice(0).buffer], { type: mime });
    const reader = new FileReader();
    reader.onload = () => this.originalDataUrl.set(reader.result as string);
    reader.readAsDataURL(blob);

    await this.reprocessUpload();
  }

  async onBgOptionChange(remove: boolean, tol: number): Promise<void> {
    this.removeBg.set(remove);
    this.tolerance.set(tol);
    if (this.lastValidated) {
      await this.reprocessUpload();
    } else if (this.originalDataUrl()) {
      await this.reprocessExistingDataUrl();
    }
  }

  private async reprocessUpload(): Promise<void> {
    if (!this.lastValidated) return;
    try {
      const processed = await this.imageService.processUploadedImageToPng(this.lastValidated, {
        removeWhiteBg: this.removeBg(),
        tolerance: this.tolerance()
      });
      this.uploadedDataUrl.set(processed.dataUrl);
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Failed to decode uploaded stamp image.');
    }
  }

  private async reprocessExistingDataUrl(): Promise<void> {
    const rawUrl = this.originalDataUrl();
    if (!rawUrl) return;
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('Image decode error'));
        img.src = rawUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      if (this.removeBg()) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.imageService.stripNearWhiteBackground(imgData, this.tolerance());
        ctx.putImageData(imgData, 0, 0);
      }

      this.uploadedDataUrl.set(canvas.toDataURL('image/png'));
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Failed to update image background.');
    }
  }

  applyStamp(): void {
    const url = this.previewDataUrl();
    if (!url) return;

    let source: SignStampSource;
    let label: string;

    if (this.mode() === 'build') {
      const lines = [this.line1().trim()];
      if (this.line2().trim()) lines.push(this.line2().trim());
      source = {
        kind: 'text',
        lines,
        shape: this.shape(),
        color: this.color()
      };
      label = this.line1().trim();
    } else {
      source = {
        kind: 'image',
        originalDataUrl: this.originalDataUrl() || url,
        processedDataUrl: url,
        removeBackground: this.removeBg(),
        tolerance: this.tolerance()
      };
      label = 'Uploaded Stamp';
    }

    if (this.saveAsDefault()) {
      this.storageService.saveStamp({
        id: `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source,
        imageDataUrl: url,
        label,
        isDefault: true,
        created: Date.now()
      });
    }

    this.applied.emit({
      imageDataUrl: url,
      source,
      label,
      shape: this.shape(),
      scope: this.updateScope(),
      saveAsDefault: this.saveAsDefault()
    });
  }
}
