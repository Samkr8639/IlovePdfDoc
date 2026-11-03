import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ColorPalettePickerComponent,
  ColorPreset,
} from '../../../shared/color-palette-picker/color-palette-picker.component';
import { EditElement } from '../../../models/document-model';

@Component({
  selector: 'app-sign-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ColorPalettePickerComponent],
  template: `
    <div class="section-badge-title">SIGNATURE STYLES</div>
    <div class="property-panel-card signature-studio-card">
      <!-- Signature Mode Tabs -->
      <div class="sig-mode-tabs" role="tablist">
        <button
          type="button"
          class="sig-mode-tab"
          [class.active]="signatureTab() === 'type'"
          (click)="setSignatureTab.emit('type')">
          ✍️ Type
        </button>
        <button
          type="button"
          class="sig-mode-tab"
          [class.active]="signatureTab() === 'draw'"
          (click)="setSignatureTab.emit('draw')">
          🖌️ Draw
        </button>
        <button
          type="button"
          class="sig-mode-tab"
          [class.active]="signatureTab() === 'upload'"
          (click)="setSignatureTab.emit('upload')">
          📁 Upload
        </button>
      </div>

      <!-- 1. TYPE SIGNATURE MODE -->
      @if (signatureTab() === 'type') {
        <label class="property-sublabel">Signer Name / Text</label>
        <input
          type="text"
          class="custom-range-input"
          placeholder="Enter signature name..."
          [ngModel]="signatureText()"
          (ngModelChange)="setSignatureText.emit($event)" />

        <label class="property-sublabel">Calligraphy Font Style</label>
        <div class="sig-fonts-grid">
          @for (font of calligraphyFonts; track font.name) {
            <button
              type="button"
              class="sig-font-card"
              [class.active]="signatureFont().includes(font.name)"
              (click)="setSignatureFont.emit(font.value)"
              [title]="font.name">
              <span
                class="font-preview"
                [style.color]="resolvedColor()"
                [style.font-family]="font.value">
                {{ signatureText() || 'Signature' }}
              </span>
              <small class="font-name-label">{{ font.name }}</small>
            </button>
          }
        </div>

        <label class="property-sublabel">Ink Color</label>
        <app-color-palette-picker
          [currentColor]="signatureColor()"
          [presets]="inkPresets"
          (colorChange)="setSignatureColor.emit($event)" />

        <label class="property-sublabel">Signature Size</label>
        <div class="thickness-btn-group">
          <button
            type="button"
            class="thickness-btn"
            [class.active]="signatureSize() === 18"
            (click)="setSignatureSize.emit(18)">
            Small
          </button>
          <button
            type="button"
            class="thickness-btn"
            [class.active]="signatureSize() === 26"
            (click)="setSignatureSize.emit(26)">
            Medium
          </button>
          <button
            type="button"
            class="thickness-btn"
            [class.active]="signatureSize() === 34"
            (click)="setSignatureSize.emit(34)">
            Large
          </button>
        </div>

        <button type="button" class="btn-action-primary" (click)="addSignatureElement.emit()">
          <span>+ Place Signature on Page</span>
        </button>
      }

      <!-- 2. DRAW SIGNATURE MODE -->
      @if (signatureTab() === 'draw') {
        <label class="property-sublabel">Ink Color</label>
        <app-color-palette-picker
          [currentColor]="signatureColor()"
          [presets]="inkPresets"
          (colorChange)="setSignatureColor.emit($event)" />

        <label class="property-sublabel">Draw with your mouse or finger</label>
        <div class="sig-pad-wrapper">
          <canvas
            #sigPad
            class="sig-pad-canvas"
            width="280"
            height="120"
            (mousedown)="onSigPadMouseDown($event)"
            (mousemove)="onSigPadMouseMove($event)"
            (mouseup)="onSigPadMouseUp()"
            (mouseleave)="onSigPadMouseUp()"
            (touchstart)="onSigPadTouchStart($event)"
            (touchmove)="onSigPadTouchMove($event)"
            (touchend)="onSigPadTouchEnd()"></canvas>
        </div>
        <div class="sig-pad-actions-row">
          <button type="button" class="btn-outline-sm" (click)="clearSigPad()">
            Clear Pad
          </button>
          <button type="button" class="btn-action-primary-sm" (click)="addSignatureElement.emit()">
            + Place Drawn Signature
          </button>
        </div>
      }

      <!-- 3. UPLOAD SIGNATURE MODE -->
      @if (signatureTab() === 'upload') {
        <label class="property-sublabel">Upload transparent signature</label>
        <input
          #fileInputSigUpload
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style="display: none"
          (change)="onSignatureFileSelected($event)" />
        @if (signatureDrawnDataUrl()) {
          <div class="sig-preview-box">
            <img [src]="signatureDrawnDataUrl()" alt="Signature Preview" class="sig-upload-preview" />
          </div>
        }
        <div class="sig-pad-actions-row">
          <button type="button" class="btn-outline-sm" (click)="fileInputSigUpload.click()">
            Select Image
          </button>
          <button
            type="button"
            class="btn-action-primary-sm"
            [disabled]="!signatureDrawnDataUrl()"
            (click)="addSignatureElement.emit()">
            + Place Signature
          </button>
        </div>
      }

      <!-- If signature on paper is currently selected, show action tools -->
      @if (isElementSelected()) {
        <div class="selected-element-actions-divider">
          <div class="element-action-buttons">
            <button type="button" class="el-action-btn" (click)="duplicate.emit()" title="Duplicate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Duplicate</span>
            </button>
            <button type="button" class="el-action-btn" (click)="bringForward.emit()" title="Bring to Front">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>Forward</span>
            </button>
            <button type="button" class="el-action-btn danger" (click)="delete.emit()" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class SignPanelComponent {
  readonly signatureTab = input<'type' | 'draw' | 'upload'>('type');
  readonly signatureText = input<string>('John Doe');
  readonly signatureFont = input<string>("'Dancing Script', cursive");
  readonly signatureColor = input<string>('var(--pt-navy)');
  readonly signatureSize = input<number>(26);
  readonly signatureDrawnDataUrl = input<string | null>(null);
  readonly isElementSelected = input<boolean>(false);

  readonly setSignatureTab = output<'type' | 'draw' | 'upload'>();
  readonly setSignatureText = output<string>();
  readonly setSignatureFont = output<string>();
  readonly setSignatureColor = output<string>();
  readonly setSignatureSize = output<number>();
  readonly addSignatureElement = output<void>();
  readonly drawnDataUrlChange = output<string | null>();
  readonly duplicate = output<void>();
  readonly bringForward = output<void>();
  readonly delete = output<void>();

  @ViewChild('sigPad') sigPadRef?: ElementRef<HTMLCanvasElement>;

  private isSigPadDrawing = false;
  private sigPadPoints: Array<{ x: number; y: number }> = [];

  readonly inkPresets: ColorPreset[] = [
    { value: 'var(--pt-navy)', cssClass: 'navy', title: 'Navy Ink' },
    { value: 'var(--pt-navy-deep)', cssClass: 'black', title: 'Black Ink' },
    { value: 'var(--pt-teal-700)', cssClass: 'teal', title: 'Teal Ink' },
    { value: 'var(--pt-coral)', cssClass: 'coral', title: 'Coral Ink' },
  ];

  readonly calligraphyFonts = [
    { name: 'Dancing Script', value: "'Dancing Script', cursive" },
    { name: 'Caveat', value: "'Caveat', cursive" },
    { name: 'Great Vibes', value: "'Great Vibes', cursive" },
    { name: 'Sacramento', value: "'Sacramento', cursive" },
  ];

  readonly resolvedColor = computed(() => {
    const color = this.signatureColor();
    if (!color) return '#14213d';
    if (color.startsWith('#') || color.startsWith('rgb')) return color;
    if (color.includes('navy-deep')) return '#0d1629';
    if (color.includes('navy')) return '#14213d';
    if (color.includes('teal')) return '#0f766e';
    if (color.includes('coral')) return '#fca311';
    return color;
  });

  onSigPadMouseDown(event: MouseEvent): void {
    this.startSigPadDrawing(event.offsetX, event.offsetY);
  }

  onSigPadMouseMove(event: MouseEvent): void {
    if (!this.isSigPadDrawing) return;
    this.moveSigPadDrawing(event.offsetX, event.offsetY);
  }

  onSigPadMouseUp(): void {
    this.endSigPadDrawing();
  }

  onSigPadTouchStart(event: TouchEvent): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas || event.touches.length === 0) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    this.startSigPadDrawing(x, y);
  }

  onSigPadTouchMove(event: TouchEvent): void {
    if (!this.isSigPadDrawing) return;
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas || event.touches.length === 0) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    this.moveSigPadDrawing(x, y);
  }

  onSigPadTouchEnd(): void {
    this.endSigPadDrawing();
  }

  private startSigPadDrawing(x: number, y: number): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.isSigPadDrawing = true;
    this.sigPadPoints = [{ x, y }];
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.resolvedColor();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  private moveSigPadDrawing(x: number, y: number): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.sigPadPoints.push({ x, y });
    const pts = this.sigPadPoints;
    if (pts.length < 3) {
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }

    const p0 = pts[pts.length - 2];
    const p1 = pts[pts.length - 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    ctx.stroke();
  }

  private endSigPadDrawing(): void {
    if (!this.isSigPadDrawing) return;
    this.isSigPadDrawing = false;
    const canvas = this.sigPadRef?.nativeElement;
    if (canvas) {
      this.drawnDataUrlChange.emit(canvas.toDataURL('image/png'));
    }
  }

  clearSigPad(): void {
    const canvas = this.sigPadRef?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    this.drawnDataUrlChange.emit(null);
    this.sigPadPoints = [];
  }

  onSignatureFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.drawnDataUrlChange.emit(reader.result as string);
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }
}
