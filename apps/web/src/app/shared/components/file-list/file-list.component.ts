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
              <!-- Red PDF Badge Icon in Circular Chip (Exact Dribbble video) -->
              <div class="file-chip">
                <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
                  <path d="M3 2C1.89543 2 1 2.89543 1 4V20C1 21.1046 1.89543 22 3 22H19C20.1046 22 21 21.1046 21 20V7.5L15.5 2H3Z" fill="#E53935"/>
                  <path d="M15.5 2V7.5H21L15.5 2Z" fill="#B71C1C" opacity="0.8"/>
                  <text x="11" y="16.5" font-size="6.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Space Grotesk', sans-serif" letter-spacing="-0.3px">PDF</text>
                </svg>
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
    .file-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #f3f4f6;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      flex-shrink: 0;
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
