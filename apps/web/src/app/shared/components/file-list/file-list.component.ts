import { Component, input, output } from '@angular/core';
import { ValidatedPdfFile } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-file-list',
  template: `
    <div class="file-list-container">
      <div class="files-stack">
        @for (file of files(); track file.id; let idx = $index; let first = $first; let last = $last) {
          <div class="dribbble-file-row" [class.file-error]="!file.isValid">
            <div class="file-info-left">
              <!-- Red PDF Badge Icon -->
              <div class="pdf-file-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span class="pdf-badge-text">PDF</span>
              </div>

              <div class="file-text-col">
                <span class="file-title" [title]="file.name">{{ file.name }}</span>
                <span class="file-size-sub">{{ file.formattedSize }} • {{ file.pageCount }} {{ file.pageCount === 1 ? 'page' : 'pages' }}</span>
              </div>
            </div>

            <div class="file-actions-right">
              <!-- Reorder Up -->
              <button
                type="button"
                class="icon-action-btn"
                [disabled]="first"
                (click)="moveUp.emit(idx)"
                title="Move Up"
                aria-label="Move Up"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </button>

              <!-- Reorder Down -->
              <button
                type="button"
                class="icon-action-btn"
                [disabled]="last"
                (click)="moveDown.emit(idx)"
                title="Move Down"
                aria-label="Move Down"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <!-- Delete / Trash (Dribbble icon) -->
              <button
                type="button"
                class="icon-action-btn delete-btn"
                (click)="removeFile.emit(idx)"
                title="Remove Document"
                aria-label="Remove Document"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .file-list-container {
      margin-top: 20px;
      width: 100%;
    }
    .files-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    /* DRIBBLE FILE ROW */
    .dribbble-file-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }
    .dribbble-file-row:hover {
      border-color: var(--coral-300);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    }
    .file-info-left {
      display: flex;
      align-items: center;
      gap: 14px;
      overflow: hidden;
    }
    .pdf-file-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--coral-50);
      color: var(--coral-600);
      position: relative;
      flex-shrink: 0;
    }
    .pdf-badge-text {
      position: absolute;
      bottom: 4px;
      font-size: 8px;
      font-weight: 800;
      line-height: 1;
    }
    .file-text-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }
    .file-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-size-sub {
      font-size: 12px;
      color: var(--text-muted);
    }

    .file-actions-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .icon-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #f8f9fa;
      color: var(--text-muted);
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .icon-action-btn:hover:not(:disabled) {
      background: #ffffff;
      border-color: var(--surface-border);
      color: var(--text-main);
    }
    .icon-action-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .delete-btn:hover:not(:disabled) {
      color: var(--coral-600);
      background: var(--coral-50);
      border-color: var(--coral-200);
    }
  `]
})
export class FileListComponent {
  readonly files = input.required<ValidatedPdfFile[]>();
  readonly moveUp = output<number>();
  readonly moveDown = output<number>();
  readonly removeFile = output<number>();
}
