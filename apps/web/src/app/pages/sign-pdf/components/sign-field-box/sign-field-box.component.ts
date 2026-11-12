import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="sign-field-object"
      [class.is-selected]="selected()"
      [class.is-locked-type]="isAspectLocked()"
      [class.is-editing]="isEditingText() || isEditingLabel()"
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
      (mousedown)="onMouseDown($event)"
      (touchstart)="touchDragStart.emit({ event: $event, field: field() })"
      (click)="$event.stopPropagation(); selectedField.emit(field().id)"
      (dblclick)="onDoubleClick($event)"
      (keydown)="onKeyDown($event)">

      <!-- Assignee Chip (for Multi-recipient) -->
      @if (assigneeLabel()) {
        <span
          class="assignee-pill"
          [style.background]="assigneeColor() || accentColor()">
          {{ assigneeLabel() }}
        </span>
      }

      <div class="field-visual-inner">
        <!-- 1. Signature / Initials / Stamp Images -->
        @if ((field().type === 'signature' || field().type === 'initials' || field().type === 'stamp') && field().imageDataUrl) {
          <img [src]="field().imageDataUrl!" [alt]="field().type" draggable="false" class="field-img-preview" />
        }

        <!-- 2. Composite Checkbox (Box + Label) -->
        @else if (field().type === 'checkbox') {
          <div
            class="composite-checkbox-row"
            [class.label-left]="field().checkboxConfig?.labelPosition === 'left'">

            @if (field().checkboxConfig?.labelPosition === 'left') {
              <div class="checkbox-label-cell" (dblclick)="startLabelEdit($event)">
                @if (isEditingLabel()) {
                  <input
                    #labelInputRef
                    type="text"
                    class="inline-label-input"
                    [ngModel]="labelDraft()"
                    (ngModelChange)="labelDraft.set($event)"
                    (keydown)="onLabelKeyDown($event)"
                    (blur)="commitLabelDraft()"
                    placeholder="Add label…" />
                } @else {
                  <span
                    class="checkbox-label-text"
                    [class.empty-hint]="!field().checkboxConfig?.label?.content"
                    [style.font-size.px]="(field().checkboxConfig?.label?.fontSize || 12) * zoom()"
                    [style.color]="field().checkboxConfig?.label?.color || 'var(--pt-navy)'">
                    {{ field().checkboxConfig?.label?.content || (selected() ? 'Add label…' : '') }}
                  </span>
                }
              </div>
            }

            <button
              type="button"
              class="checkbox-visual-box"
              [class.checked]="field().checked !== false"
              [style.width.px]="checkboxBoxSizePx()"
              [style.height.px]="checkboxBoxSizePx()"
              [style.border-color]="field().color || 'var(--pt-teal-700)'"
              [style.color]="field().color || 'var(--pt-teal-700)'"
              (click)="$event.stopPropagation(); toggleCheckbox.emit(field().id)"
              (mousedown)="$event.stopPropagation()"
              [attr.aria-label]="checkboxAriaText()">
              @if (field().checked !== false) {
                @if (checkboxMark() === 'tick') {
                  <svg width="70%" height="70%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                } @else if (checkboxMark() === 'cross') {
                  <svg width="70%" height="70%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                } @else if (checkboxMark() === 'dot') {
                  <div class="checkbox-dot" [style.background]="field().color || 'var(--pt-teal-700)'"></div>
                }
              }
            </button>

            @if (field().checkboxConfig?.labelPosition !== 'left') {
              <div class="checkbox-label-cell" (dblclick)="startLabelEdit($event)">
                @if (isEditingLabel()) {
                  <input
                    #labelInputRef
                    type="text"
                    class="inline-label-input"
                    [ngModel]="labelDraft()"
                    (ngModelChange)="labelDraft.set($event)"
                    (keydown)="onLabelKeyDown($event)"
                    (blur)="commitLabelDraft()"
                    placeholder="Add label…" />
                } @else {
                  <span
                    class="checkbox-label-text"
                    [class.empty-hint]="!field().checkboxConfig?.label?.content"
                    [style.font-size.px]="(field().checkboxConfig?.label?.fontSize || 12) * zoom()"
                    [style.color]="field().checkboxConfig?.label?.color || 'var(--pt-navy)'">
                    {{ field().checkboxConfig?.label?.content || (selected() ? 'Add label…' : '') }}
                  </span>
                }
              </div>
            }
          </div>
        }

        <!-- 3. Real Editable Text Field -->
        @else if (field().type === 'text') {
          @if (isEditingText()) {
            <textarea
              #textInputRef
              class="inline-text-textarea"
              [style.font-family]="resolvedFontCss()"
              [style.font-size.px]="textFontSizePx()"
              [style.color]="textStyle().color"
              [style.font-weight]="textStyle().fontWeight"
              [style.font-style]="textStyle().fontStyle"
              [style.text-decoration]="textStyle().textDecoration"
              [style.text-align]="textStyle().textAlign"
              [style.line-height]="textStyle().lineHeight"
              [ngModel]="textDraft()"
              (ngModelChange)="textDraft.set($event)"
              (keydown)="onTextKeyDown($event)"
              (blur)="commitTextDraft()"
              placeholder="Type text…"></textarea>
          } @else {
            <div
              class="field-text-preview"
              [style.font-family]="resolvedFontCss()"
              [style.font-size.px]="textFontSizePx()"
              [style.color]="textStyle().color"
              [style.font-weight]="textStyle().fontWeight"
              [style.font-style]="textStyle().fontStyle"
              [style.text-decoration]="textStyle().textDecoration"
              [style.text-align]="textStyle().textAlign"
              [style.line-height]="textStyle().lineHeight"
              [style.opacity]="textStyle().opacity">
              {{ fieldTextContent() || 'Click to add text, then type' }}
            </div>
          }
        }

        <!-- 4. Other Text Fields (Name / Date) -->
        @else {
          <span
            class="field-text-preview"
            [style.font-family]="resolvedFontCss()"
            [style.font-size.px]="(field().fontSizePt ?? 14) * zoom()"
            [style.color]="field().color || 'var(--pt-navy)'">
            {{ field().text || placeholderText() }}
          </span>
        }
      </div>

      <!-- Signing Details Caption (Under Signature) -->
      @if (field().type === 'signature' && field().showSigningDetailsLine && field().signingDetailsText) {
        <div class="signing-details-caption" [style.font-size.px]="Math.max(7, 8 * zoom())">
          {{ field().signingDetailsText }}
        </div>
      }

      <!-- Quick Action / Add Option Handle for Checkbox -->
      @if (selected() && field().type === 'checkbox') {
        <button
          type="button"
          class="add-option-handle"
          title="Add another checkbox below"
          aria-label="Add another option"
          (click)="$event.stopPropagation(); addOption.emit(field().id)"
          (mousedown)="$event.stopPropagation()">
          + Add option
        </button>
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
          <!-- Edit button for stamp or text -->
          @if (field().type === 'stamp') {
            <button
              type="button"
              class="quick-btn"
              title="Edit stamp"
              aria-label="Edit company stamp"
              (click)="editStamp.emit(field()); $event.stopPropagation()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          } @else if (field().type === 'text') {
            <button
              type="button"
              class="quick-btn"
              title="Edit text"
              aria-label="Edit text"
              (click)="startTextEdit(); $event.stopPropagation()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          }

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
    .sign-field-object.is-editing {
      border-style: solid;
      background: var(--pt-surface-white);
      cursor: default;
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
      width: 100%;
      overflow: hidden;
      word-break: break-word;
      user-select: none;
    }
    .inline-text-textarea {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      background: transparent;
      resize: none;
      padding: 0;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      box-sizing: border-box;
      font-family: inherit;
    }
    /* Composite Checkbox */
    .composite-checkbox-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      height: 100%;
      padding: 1px;
    }
    .composite-checkbox-row.label-left {
      flex-direction: row-reverse;
      justify-content: flex-end;
    }
    .checkbox-visual-box {
      border: 2px solid var(--pt-teal-700);
      border-radius: var(--pt-radius-xs);
      background: var(--pt-surface-white);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      cursor: pointer;
      flex-shrink: 0;
    }
    .checkbox-visual-box.checked { background: var(--pt-teal-50); }
    .checkbox-dot {
      width: 50%;
      height: 50%;
      border-radius: var(--pt-radius-pill);
    }
    .checkbox-label-cell {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
    }
    .checkbox-label-text {
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.25;
      cursor: text;
    }
    .checkbox-label-text.empty-hint {
      color: var(--pt-muted);
      font-style: italic;
    }
    .inline-label-input {
      width: 100%;
      border: none;
      outline: 1px solid var(--pt-teal-700);
      border-radius: 2px;
      padding: 2px 4px;
      font-size: 12px;
      background: var(--pt-surface-white);
      color: var(--pt-navy);
      box-sizing: border-box;
    }
    .add-option-handle {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      font-size: 11px;
      font-weight: 700;
      color: var(--pt-teal-700);
      background: var(--pt-surface-white);
      border: 1px solid var(--pt-teal-700);
      border-radius: var(--pt-radius-pill);
      padding: 2px 8px;
      cursor: pointer;
      box-shadow: var(--pt-shadow-sm);
      white-space: nowrap;
      z-index: 25;
    }
    .add-option-handle:hover {
      background: var(--pt-teal-50);
    }
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
    .assignee-pill {
      position: absolute;
      bottom: -19px;
      left: 0;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 1px 6px;
      border-radius: var(--pt-radius-xs);
      color: var(--pt-surface-white);
      font-size: 10px;
      font-weight: 700;
      line-height: 1.4;
      pointer-events: none;
      box-shadow: var(--pt-shadow-sm);
    }
  `]
})
export class SignFieldBoxComponent {
  readonly Math = Math;

  readonly field = input.required<SignFieldElement>();
  readonly page = input.required<PdfPageBoxMetrics>();
  readonly zoom = input<number>(1.0);
  readonly selected = input<boolean>(false);
  readonly accentColor = input<string>('var(--pt-teal-700)');
  readonly assigneeLabel = input<string>('');
  readonly assigneeColor = input<string | null>(null);
  readonly autoFocusEdit = input<boolean>(false);

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
  readonly editStamp = output<SignFieldElement>();
  readonly textChanged = output<{ id: string; content: string }>();
  readonly labelChanged = output<{ id: string; content: string }>();
  readonly addOption = output<string>();

  @ViewChild('textInputRef') textInputRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('labelInputRef') labelInputRef?: ElementRef<HTMLInputElement>;

  readonly isEditingText = signal<boolean>(false);
  readonly textDraft = signal<string>('');
  readonly isEditingLabel = signal<boolean>(false);
  readonly labelDraft = signal<string>('');

  constructor() {
    effect(() => {
      if (this.autoFocusEdit()) {
        setTimeout(() => {
          if (this.field().type === 'text') {
            this.startTextEdit();
          } else if (this.field().type === 'checkbox') {
            this.startLabelEdit();
          }
        }, 30);
      }
    });
  }

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
    const textCfg = this.field().textConfig;
    const fid = textCfg?.fontFamily || this.field().fontId;
    const found = SIGN_SCRIPT_FONTS.find(f => f.id === fid);
    return found ? found.cssFamily : "'SignNotoSans', var(--pt-font-body)";
  });

  readonly textFontSizePx = computed(() => {
    const cfg = this.field().textConfig;
    return ((cfg?.fontSize ?? this.field().fontSizePt) ?? 14) * this.zoom();
  });

  readonly textStyle = computed(() => {
    const cfg = this.field().textConfig;
    return {
      color: cfg?.color || this.field().color || 'var(--pt-navy)',
      fontWeight: cfg?.bold ? '700' : '400',
      fontStyle: cfg?.italic ? 'italic' : 'normal',
      textDecoration: cfg?.underline ? 'underline' : 'none',
      textAlign: cfg?.align || 'left',
      lineHeight: cfg?.lineHeight || 1.25,
      opacity: typeof cfg?.opacity === 'number' ? cfg.opacity : 1
    };
  });

  readonly fieldTextContent = computed(() => {
    return this.field().textConfig?.content ?? this.field().text ?? '';
  });

  readonly checkboxBoxSizePx = computed(() => {
    const boxPt = this.field().checkboxConfig?.boxSize || 18;
    return Math.max(12, boxPt * this.zoom());
  });

  readonly checkboxMark = computed(() => {
    return this.field().checkboxConfig?.mark || 'tick';
  });

  readonly checkboxAriaText = computed(() => {
    const checked = this.field().checked !== false;
    const label = this.field().checkboxConfig?.label?.content || '';
    return `Checkbox ${label ? label + ' ' : ''}${checked ? 'checked' : 'unchecked'}`;
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

  onMouseDown(ev: MouseEvent): void {
    if (this.isEditingText() || this.isEditingLabel()) return;
    this.dragStart.emit({ event: ev, field: this.field() });
  }

  onDoubleClick(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.field().type === 'stamp') {
      this.editStamp.emit(this.field());
    } else if (this.field().type === 'text') {
      this.startTextEdit();
    } else if (this.field().type === 'checkbox') {
      this.toggleCheckbox.emit(this.field().id);
    }
  }

  startTextEdit(): void {
    this.textDraft.set(this.fieldTextContent());
    this.isEditingText.set(true);
    setTimeout(() => {
      const el = this.textInputRef?.nativeElement;
      if (el) {
        el.focus();
        el.select();
      }
    }, 20);
  }

  commitTextDraft(): void {
    if (!this.isEditingText()) return;
    this.isEditingText.set(false);
    const content = this.textDraft().trim();
    if (!content) {
      this.removed.emit(this.field().id);
    } else if (content !== this.fieldTextContent()) {
      this.textChanged.emit({ id: this.field().id, content });
    }
  }

  onTextKeyDown(ev: KeyboardEvent): void {
    ev.stopPropagation();
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      this.commitTextDraft();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.isEditingText.set(false);
    }
  }

  startLabelEdit(ev?: MouseEvent): void {
    if (ev) ev.stopPropagation();
    this.labelDraft.set(this.field().checkboxConfig?.label?.content || '');
    this.isEditingLabel.set(true);
    setTimeout(() => {
      const el = this.labelInputRef?.nativeElement;
      if (el) {
        el.focus();
        el.select();
      }
    }, 20);
  }

  commitLabelDraft(): void {
    if (!this.isEditingLabel()) return;
    this.isEditingLabel.set(false);
    const content = this.labelDraft().trim();
    const cur = this.field().checkboxConfig?.label?.content || '';
    if (content !== cur) {
      this.labelChanged.emit({ id: this.field().id, content });
    }
  }

  onLabelKeyDown(ev: KeyboardEvent): void {
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      this.commitLabelDraft();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.isEditingLabel.set(false);
    }
  }

  onResize(corner: ResizeCorner, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.resizeStart.emit({ event, field: this.field(), corner });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.isEditingText() || this.isEditingLabel()) return;

    const step = event.shiftKey ? 10 : 2;
    switch (event.key) {
      case 'Enter':
      case 'F2':
        event.preventDefault();
        if (this.field().type === 'stamp') {
          this.editStamp.emit(this.field());
        } else if (this.field().type === 'text') {
          this.startTextEdit();
        } else if (this.field().type === 'checkbox') {
          this.startLabelEdit();
        }
        break;
      case ' ':
        if (this.field().type === 'checkbox') {
          event.preventDefault();
          this.toggleCheckbox.emit(this.field().id);
        }
        break;
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
