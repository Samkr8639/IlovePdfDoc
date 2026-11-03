import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-edit-pdf-top-nav',
  standalone: true,
  template: `
    <div class="top-toolbar-strip">
      <div class="top-toolbar-inner">

        <!-- Mode Toggle (Annotate / Edit Text) — sliding-pill style -->
        <div class="workspace-mode-capsule" role="tablist" aria-label="Editor modes"
          [class.is-transitioning]="isExtractingPageText()">
          <!-- Sliding background indicator: moves left (annotate) or right (edit) -->
          <div class="mode-slider-thumb" [class.at-edit]="editorMode() === 'edit'"
            [class.is-loading]="isExtractingPageText()" aria-hidden="true"></div>

          <button type="button" class="mode-pill-tab" [class.active]="editorMode() === 'annotate'"
            [disabled]="isExtractingPageText()" (click)="modeChange.emit('annotate')" role="tab"
            [attr.aria-selected]="editorMode() === 'annotate'">
            <svg class="lucide-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Annotate</span>
          </button>

          <button type="button" class="mode-pill-tab edit-mode-tab" [class.active]="editorMode() === 'edit'"
            [disabled]="isExtractingPageText()" (click)="modeChange.emit('edit')" role="tab"
            [attr.aria-selected]="editorMode() === 'edit'" title="Edit existing document text in-place">
            @if (isExtractingPageText()) {
            <svg class="mode-spinner-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <path
                d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            } @else {
            <svg class="lucide-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            }
            <span>Edit Text</span>
            @if (!isExtractingPageText()) {
            <span class="mode-pill-star" aria-hidden="true">★</span>
            }
          </button>
        </div>

        <!-- Divider between mode toggle and undo/redo -->
        <div class="toolbar-section-divider" aria-hidden="true"></div>

        <!-- History: Undo / Redo -->
        <div class="history-capsule">
          <button type="button" class="history-btn" [disabled]="!canUndo()" (click)="undo.emit()"
            title="Undo (Ctrl+Z / Cmd+Z)" aria-label="Undo">
            <svg class="lucide-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Undo</span>
          </button>

          <button type="button" class="history-btn" [disabled]="!canRedo()" (click)="redo.emit()"
            title="Redo (Ctrl+Y / Cmd+Y / Ctrl+Shift+Z)" aria-label="Redo">
            <svg class="lucide-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Redo</span>
          </button>
        </div>

      </div>
    </div>
  `
})
export class EditPdfTopNavComponent {
  readonly editorMode = input.required<'annotate' | 'edit'>();
  readonly isExtractingPageText = input<boolean>(false);
  readonly canUndo = input<boolean>(false);
  readonly canRedo = input<boolean>(false);

  readonly modeChange = output<'annotate' | 'edit'>();
  readonly undo = output<void>();
  readonly redo = output<void>();
}
