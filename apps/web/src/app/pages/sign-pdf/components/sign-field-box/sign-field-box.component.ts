import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PdfPageBoxMetrics,
  SIGN_SCRIPT_FONTS,
  SignFieldElement,
  pdfRectToScreenRectCoords
} from '@paperflow/contracts';

export type ResizeCorner = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

@Component({
  selector: 'app-sign-field-box',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="sign-field-object"
      [class.is-selected]="selected()"
      [class.is-locked-type]="isAspectLocked()"
      [style.left.px]="screenRect().x"
      [style.top.px]="screenRect().y"
      [style.width.px]="screenRect().width"
      [style.height.px]="screenRect().height"
      [style.border-color]="accentColor()"
      [style.transform]="field().rotation ? 'rotate(' + field().rotation + 'deg)' : 'none'"
      [style.z-index]="(field().zIndex ?? 1) + (selected() ? 50 : 10)"
      tabindex="0"
      role="button"
      [attr.aria-label]="ariaFieldLabel()"
      [attr.aria-pressed]="selected()"
      (mousedown)="dragStart.emit({ event: $event, field: field() })"
      (touchstart)="touchDragStart.emit({ event: $event, field: field() })"
      (click)="$event.stopPropagation(); selectedField.emit(field().id)"
      (keydown)="onKeyDown($event)">

      <!-- Content Render -->
      <div class="field-visual-inner">
        @if ((field().type === 'signature' || field().type === 'initials' || field().type === 'stamp') && field().imageDataUrl) {
          <img [src]="field().imageDataUrl!" [alt]="field().type" draggable="false" class="field-img-preview" />
        } @else if (field().type === 'checkbox') {
          <button
            type="button"
            class="checkbox-visual-box"
            [class.checked]="field().checked !== false"
            [style.border-color]="field().color || 'var(--pt-teal-700)'"
            (click)="$event.stopPropagation(); toggleCheckbox.emit(field().id)"
            (mousedown)="$event.stopPropagation()"
            [attr.aria-label]="'Toggle checkbox'">
            @if (field().checked !== false) {
              <svg width="75%" height="75%" viewBox="0 0 24 24" fill="none" [attr.stroke]="field().color || 'var(--pt-teal-700)'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          </button>
        } @else {
          <span
            class="field-text-preview"
            [style.font-family]="resolvedFontCss()"
            [style.font-size.px]="(field().fontSizePt ?? 14) * zoom()"
            [style.color]="field().color || 'var(--pt-navy)'">
            {{ field().text || placeholderText() }}
          </span>
        }
      </div>

      @if (field().type === 'signature' && field().showSigningDetailsLine && field().signingDetailsText) {
        <div class="signing-details-caption" [style.font-size.px]="Math.max(7, 8 * zoom())">
          {{ field().signingDetailsText }}
        </div>
      }

      <!-- Selected Chrome: 8 Resize Handles, Rotate, Quick Actions -->
      @if (selected()) {
        <div class="resize-handle handle-nw" (mousedown)="onResize('nw', $event)"></div>
        <div class="resize-handle handle-n" (mousedown)="onResize('n', $event)"></div>
        <div class="resize-handle handle-ne" (mousedown)="onResize('ne', $event)"></div>
        <div class="resize-handle handle-e" (mousedown)="onResize('e', $event)"></div>
        <div class="resize-handle handle-se" (mousedown)="onResize('se', $event)"></div>
        <div class="resize-handle handle-s" (mousedown)="onResize('s', $event)"></div>
        <div class="resize-handle handle-sw" (mousedown)="onResize('sw', $event)"></div>
        <div class="resize-handle handle-w" (mousedown)="onResize('w', $event)"></div>

        <button
          type="button"
          class="field-ctrl-btn rotate-btn"
          title="Drag to rotate"
          aria-label="Rotate field"
          (mousedown)="rotateStart.emit({ event: $event, field: field() })"
          (click)="$event.stopPropagation()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>

        <div class="field-quick-toolbar" (mousedown)="$event.stopPropagation()">
          <button type="button" class="quick-btn" title="Duplicate (Ctrl+D)" aria-label="Duplicate field" (click)="duplicate.emit(field().id); $event.stopPropagation()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="quick-btn" title="Bring forward" aria-label="Bring forward" (click)="bringForward.emit(field().id); $event.stopPropagation()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button type="button" class="quick-btn" title="Send backward" aria-label="Send backward" (click)="sendBackward.emit(field().id); $event.stopPropagation()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button type="button" class="quick-btn danger" title="Delete (Del)" aria-label="Delete field" (click)="removed.emit(field().id); $event.stopPropagation()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .sign-field-object {
      position: absolute;
      border: 1.5px dashed var(--pt-teal-700);
      border-radius: var(--pt-radius-xs);
      background: rgba(230, 245, 243, 0.25);
      cursor: move;
      user-select: none;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sign-field-object:focus-visible,
    .sign-field-object.is-selected {
      outline: none;
      box-shadow: 0 0 0 2px var(--pt-teal-700);
      background: rgba(230, 245, 243, 0.4);
    }
    .field-visual-inner {
      width: 100%;
      height: 100%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
    }
    .field-img-preview {
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
    .field-text-preview {
      white-space: pre-wrap;
      line-height: 1.2;
      width: 100%;
      text-align: left;
      overflow: hidden;
      pointer-events: none;
    }
    .checkbox-visual-box {
      width: 100%;
      height: 100%;
      border: 2px solid var(--pt-teal-700);
      border-radius: var(--pt-radius-xs);
      background: var(--pt-surface-white);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      cursor: pointer;
    }
    .checkbox-visual-box.checked { background: var(--pt-teal-50); }
    .signing-details-caption {
      position: absolute;
      left: 0;
      top: calc(100% + 2px);
      white-space: nowrap;
      color: var(--pt-muted);
      pointer-events: none;
    }
    .resize-handle {
      position: absolute;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--pt-surface-white);
      border: 2px solid var(--pt-teal-700);
      z-index: 5;
    }
    .handle-nw { top: -5px; left: -5px; cursor: nwse-resize; }
    .handle-n { top: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
    .handle-ne { top: -5px; right: -5px; cursor: nesw-resize; }
    .handle-e { top: calc(50% - 4.5px); right: -5px; cursor: ew-resize; }
    .handle-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
    .handle-s { bottom: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
    .handle-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .handle-w { top: calc(50% - 4.5px); left: -5px; cursor: ew-resize; }
    .rotate-btn {
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%);
      width: 22px;
      height: 22px;
      border-radius: var(--pt-radius-pill);
      border: 1px solid var(--pt-teal-700);
      background: var(--pt-surface-white);
      color: var(--pt-teal-700);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      box-shadow: var(--pt-shadow-sm);
    }
    .field-quick-toolbar {
      position: absolute;
      bottom: calc(100% + 6px);
      right: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      border-radius: var(--pt-radius-sm);
      background: var(--pt-navy);
      box-shadow: var(--pt-shadow-md);
      z-index: 20;
    }
    .quick-btn {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: var(--pt-radius-xs);
      background: transparent;
      color: var(--pt-surface-white);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .quick-btn:hover { background: rgba(255, 255, 255, 0.18); }
    .quick-btn.danger:hover { background: var(--pt-coral); }
  `]
})
export class SignFieldBoxComponent {
  readonly Math = Math;

  readonly field = input.required<SignFieldElement>();
  readonly page = input.required<PdfPageBoxMetrics>();
  readonly zoom = input<number>(1.0);
  readonly selected = input<boolean>(false);
  readonly accentColor = input<string>('var(--pt-teal-700)');

  readonly selectedField = output<string>();
  readonly dragStart = output<{ event: MouseEvent; field: SignFieldElement }>();
  readonly touchDragStart = output<{ event: TouchEvent; field: SignFieldElement }>();
  readonly resizeStart = output<{ event: MouseEvent; field: SignFieldElement; corner: ResizeCorner }>();
  readonly rotateStart = output<{ event: MouseEvent; field: SignFieldElement }>();
  readonly removed = output<string>();
  readonly duplicate = output<string>();
  readonly bringForward = output<string>();
  readonly sendBackward = output<string>();
  readonly nudge = output<{ id: string; dxPx: number; dyPx: number }>();
  readonly toggleCheckbox = output<string>();

  readonly isAspectLocked = computed(() => {
    const t = this.field().type;
    return t === 'signature' || t === 'initials' || t === 'stamp';
  });

  readonly screenRect = computed(() =>
    pdfRectToScreenRectCoords(
      {
        xPt: this.field().xPt,
        yPt: this.field().yPt,
        widthPt: this.field().widthPt,
        heightPt: this.field().heightPt
      },
      this.page(),
      this.zoom(),
      1.0
    )
  );

  readonly resolvedFontCss = computed(() => {
    const fid = this.field().fontId;
    const found = SIGN_SCRIPT_FONTS.find(f => f.id === fid);
    return found ? found.cssFamily : "'SignNotoSans', var(--pt-font-body)";
  });

  readonly placeholderText = computed(() => {
    switch (this.field().type) {
      case 'name': return 'Full Name';
      case 'date': return 'Date';
      case 'text': return 'Text';
      default: return this.field().type;
    }
  });

  readonly ariaFieldLabel = computed(() =>
    `${this.field().type} field on page ${this.field().pageIndex + 1}`
  );

  onResize(corner: ResizeCorner, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.resizeStart.emit({ event, field: this.field(), corner });
  }

  onKeyDown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 10 : 2;
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.nudge.emit({ id: this.field().id, dxPx: -step, dyPx: 0 });
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nudge.emit({ id: this.field().id, dxPx: step, dyPx: 0 });
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.nudge.emit({ id: this.field().id, dxPx: 0, dyPx: -step });
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.nudge.emit({ id: this.field().id, dxPx: 0, dyPx: step });
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.removed.emit(this.field().id);
        break;
      case 'd':
      case 'D':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.duplicate.emit(this.field().id);
        }
        break;
    }
  }
}

