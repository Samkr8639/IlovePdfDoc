import { Component, input, output } from '@angular/core';
import { ValidatedPdfFile } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-file-list',
  template: `
    <div class="file-list-container">
      <div class="list-header">
        <h4 class="list-title">Selected Documents ({{ files().length }})</h4>
        <p class="list-hint">Files will be merged in the order shown below. Use controls to reorder.</p>
      </div>

      <div class="files-grid">
        @for (file of files(); track file.id; let idx = $index; let first = $first; let last = $last) {
          <div class="file-card" [class.file-error]="!file.isValid">
            <div class="file-order-badge">{{ idx + 1 }}</div>

            <div class="file-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </div>

            <div class="file-details">
              <span class="file-name" [title]="file.name">{{ file.name }}</span>
              <div class="file-meta">
                <span class="meta-tag">{{ file.formattedSize }}</span>
                @if (file.isValid) {
                  <span class="meta-tag meta-pages">{{ file.pageCount }} {{ file.pageCount === 1 ? 'page' : 'pages' }}</span>
                } @else {
                  <span class="meta-error">{{ file.error || 'Invalid file' }}</span>
                }
              </div>
            </div>

            <div class="file-actions">
              <button
                type="button"
                class="action-btn"
                [disabled]="first"
                (click)="moveUp.emit(idx)"
                title="Move Up"
                aria-label="Move document up"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </button>

              <button
                type="button"
                class="action-btn"
                [disabled]="last"
                (click)="moveDown.emit(idx)"
                title="Move Down"
                aria-label="Move document down"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <button
                type="button"
                class="action-btn remove-btn"
                (click)="removeFile.emit(idx)"
                title="Remove Document"
                aria-label="Remove document"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      margin-top: 24px;
    }
    .list-header {
      margin-bottom: 16px;
    }
    .list-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
    }
    .list-hint {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .files-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .file-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 14px 18px;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }
    .file-card:hover {
      border-color: #cbd5e1;
      box-shadow: var(--shadow-md);
    }
    .file-card.file-error {
      border-color: #fecdd3;
      background-color: var(--rose-50);
    }
    .file-order-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background-color: var(--surface-card-hover);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
    }
    .file-icon {
      color: var(--primary-600);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .file-details {
      flex: 1;
      min-width: 0;
    }
    .file-name {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .meta-tag {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--surface-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .meta-pages {
      color: var(--primary-700);
      background: var(--primary-50);
    }
    .meta-error {
      font-size: 11px;
      color: var(--rose-600);
      font-weight: 600;
    }
    .file-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      color: var(--text-muted);
      transition: all 0.15s ease;
    }
    .action-btn:hover:not(:disabled) {
      background: var(--surface-card-hover);
      color: var(--text-main);
    }
    .action-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .remove-btn:hover:not(:disabled) {
      background: var(--rose-50);
      color: var(--rose-600);
    }
  `]
})
export class FileListComponent {
  readonly files = input<ValidatedPdfFile[]>([]);

  readonly moveUp = output<number>();
  readonly moveDown = output<number>();
  readonly removeFile = output<number>();
}
