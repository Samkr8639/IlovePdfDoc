import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignStampShape } from '@paperflow/contracts';
import { SignatureImageService } from '../../../../core/services/sign-pdf/signature-image.service';

export interface StampApplyResult {
  imageDataUrl: string;
  label: string;
  shape: SignStampShape;
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
            <h2 id="stamp-dialog-title">Company Stamp</h2>
            <p>Build a crisp seal or upload an existing stamp PNG/JPG.</p>
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
                <input type="text" class="pt-input" maxlength="28" [ngModel]="line1()" (ngModelChange)="line1.set($event)" />
              </label>
              <label class="field-group">
                <span>Secondary line (optional)</span>
                <input type="text" class="pt-input" maxlength="32" placeholder="e.g. Authorized Signatory" [ngModel]="line2()" (ngModelChange)="line2.set($event)" />
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
            <div class="upload-row">
              <input
                #uploadInput
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                class="sr-hidden"
                (change)="onFileSelected($event)" />
              <button type="button" class="btn-outline" (click)="uploadInput.click()">Select Stamp Image</button>
              <label class="inline-check">
                <input type="checkbox" [ngModel]="removeBg()" (ngModelChange)="onBgOptionChange($event, tolerance())" />
                <span>Remove white background</span>
              </label>
              @if (removeBg()) {
                <input type="range" min="5" max="95" [ngModel]="tolerance()" (ngModelChange)="onBgOptionChange(true, $event)" aria-label="Background removal tolerance" />
              }
            </div>
          }

          <div class="checkerboard-box">
            @if (previewDataUrl()) {
              <img [src]="previewDataUrl()!" alt="Stamp preview" />
            } @else {
              <span class="empty-hint">Upload an image to preview your transparent stamp.</span>
            }
          </div>
        </div>

        <div class="stamp-footer">
          <button type="button" class="btn-outline" (click)="cancelled.emit()">Cancel</button>
          <button type="button" class="btn-primary" [disabled]="!previewDataUrl()" (click)="applyStamp()">Use Stamp</button>
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
      max-width: 540px;
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
    .close-btn { border: none; background: transparent; font-size: 20px; color: var(--pt-muted); cursor: pointer; }
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
    .stamp-body { padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }
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
    }
    .stamp-controls, .upload-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
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
    .inline-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--pt-navy); }
    .inline-check input { accent-color: var(--pt-teal-700); }
    .checkerboard-box {
      min-height: 150px;
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
    .checkerboard-box img { max-height: 130px; max-width: 100%; object-fit: contain; }
    .empty-hint { font-size: 13px; color: var(--pt-muted); }
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
    .btn-primary:disabled { background: var(--pt-outline); cursor: not-allowed; }
    .sr-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  `]
})
export class SignStampDialogComponent implements AfterViewInit, OnDestroy {
  readonly applied = output<StampApplyResult>();
  readonly cancelled = output<void>();

  private readonly imageService = inject(SignatureImageService);

  @ViewChild('dialogContainer') dialogContainer?: ElementRef<HTMLDivElement>;

  readonly mode = signal<'build' | 'upload'>('build');
  readonly line1 = signal<string>('APPROVED');
  readonly line2 = signal<string>('');
  readonly shape = signal<SignStampShape>('rounded');
  readonly color = signal<string>('#0F766E');
  readonly removeBg = signal<boolean>(true);
  readonly tolerance = signal<number>(32);
  readonly uploadedDataUrl = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  readonly shapes: Array<{ value: SignStampShape; label: string }> = [
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'rounded', label: 'Rounded' },
    { value: 'circle', label: 'Circle Seal' }
  ];
  readonly presetColors = ['#0F766E', '#14213D', '#E05D44'];

  private lastValidated: { format: 'png' | 'jpeg' | 'webp'; bytes: Uint8Array } | null = null;
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
    await this.reprocessUpload();
  }

  async onBgOptionChange(remove: boolean, tol: number): Promise<void> {
    this.removeBg.set(remove);
    this.tolerance.set(tol);
    if (this.lastValidated) await this.reprocessUpload();
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

  applyStamp(): void {
    const url = this.previewDataUrl();
    if (!url) return;
    this.applied.emit({
      imageDataUrl: url,
      label: this.mode() === 'build' ? this.line1().trim() : 'Uploaded Stamp',
      shape: this.shape()
    });
  }
}

