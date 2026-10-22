import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { MergeResult } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-result-view',
  imports: [RouterLink],
  template: `
    <div class="result-card card-clean">
      <div class="success-icon-wrapper">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>

      <div class="result-header">
        <h3 class="result-title">PDFs Merged Successfully!</h3>
        <p class="result-subtitle">Your document is ready. It was created completely on your device.</p>
      </div>

      <div class="meta-box">
        <div class="meta-item">
          <span class="meta-label">Total Pages</span>
          <span class="meta-val">{{ result().pageCount }}</span>
        </div>
        <div class="meta-divider"></div>
        <div class="meta-item">
          <span class="meta-label">File Size</span>
          <span class="meta-val">{{ result().formattedSize }}</span>
        </div>
        <div class="meta-divider"></div>
        <div class="meta-item">
          <span class="meta-label">Privacy</span>
          <span class="meta-val text-emerald">100% Client-side</span>
        </div>
      </div>

      <!-- PDF PREVIEW SECTION -->
      <div class="preview-section">
        <div class="preview-toolbar">
          <div class="preview-toolbar-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Document Preview</span>
          </div>
          <div class="preview-toolbar-right">
            <button type="button" class="preview-toggle-btn" (click)="togglePreview()">
              {{ showPreview() ? 'Hide Preview' : 'Show Preview' }}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                @if (showPreview()) {
                  <polyline points="18 15 12 9 6 15"></polyline>
                } @else {
                  <polyline points="6 9 12 15 18 9"></polyline>
                }
              </svg>
            </button>
          </div>
        </div>

        @if (showPreview()) {
          <div class="preview-frame-wrapper">
            <iframe
              [src]="previewUrl()"
              class="preview-iframe"
              title="Merged PDF Preview"
            ></iframe>
          </div>
        }
      </div>

      <div class="actions-group">
        <a
          [href]="safeUrl()"
          [download]="result().filename"
          (click)="downloadFile($event)"
          class="btn-primary download-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Merged PDF</span>
        </a>

        <button type="button" class="btn-secondary" (click)="reset.emit()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          <span>Merge Another Document</span>
        </button>
      </div>

      <div class="next-tools">
        <span class="next-tools-label">Next steps:</span>
        <div class="next-tools-links">
          <a routerLink="/split-pdf" class="tool-chip">Split PDF</a>
          <a routerLink="/rotate-pdf" class="tool-chip">Rotate Pages</a>
          <a routerLink="/compress-pdf" class="tool-chip">Compress PDF</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .result-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 48px 32px;
      gap: 24px;
      max-width: 820px;
      margin: 32px auto;
    }
    .success-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--emerald-50);
      color: var(--emerald-600);
      box-shadow: 0 4px 16px rgba(5, 150, 105, 0.2);
    }
    .result-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-main);
    }
    .result-subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .meta-box {
      display: flex;
      align-items: center;
      background: var(--surface-bg);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      padding: 12px 24px;
      gap: 20px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .meta-val {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-main);
    }
    .text-emerald {
      color: var(--emerald-600);
    }
    .meta-divider {
      width: 1px;
      height: 28px;
      background: var(--surface-border);
    }

    /* PREVIEW SECTION */
    .preview-section {
      width: 100%;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--surface-bg);
    }
    .preview-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-bottom: 1px solid var(--surface-border);
      background: #ffffff;
    }
    .preview-toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
    }
    .preview-toolbar-right {
      display: flex;
      align-items: center;
    }
    .preview-toggle-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: var(--primary-600);
      background: var(--primary-50);
      border: 1px solid var(--primary-200);
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .preview-toggle-btn:hover {
      background: var(--primary-100);
      border-color: var(--primary-300);
    }
    .preview-frame-wrapper {
      position: relative;
      width: 100%;
      height: 520px;
      background: #f3f4f6;
    }
    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    .actions-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 320px;
    }
    .download-btn {
      width: 100%;
      padding: 14px 24px;
      font-size: 16px;
    }
    .next-tools {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .next-tools-links {
      display: flex;
      gap: 8px;
    }
    .tool-chip {
      padding: 4px 12px;
      background: var(--surface-bg);
      border: 1px solid var(--surface-border);
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-main);
      transition: all 0.15s ease;
    }
    .tool-chip:hover {
      background: var(--primary-50);
      border-color: var(--primary-200);
      color: var(--primary-600);
    }

    @media (max-width: 640px) {
      .preview-frame-wrapper {
        height: 360px;
      }
      .meta-box {
        flex-direction: column;
        gap: 12px;
        padding: 16px;
      }
      .meta-divider {
        width: 60%;
        height: 1px;
      }
    }
  `]
})
export class ResultViewComponent {
  private sanitizer = inject(DomSanitizer);

  readonly result = input.required<MergeResult>();
  readonly reset = output<void>();

  readonly showPreview = signal<boolean>(true);

  /** Sanitised blob URL for the download link */
  readonly safeUrl = computed<SafeUrl>(() => {
    return this.sanitizer.bypassSecurityTrustUrl(this.result().url);
  });

  /** Sanitised blob URL for the iframe src (SafeResourceUrl required for iframe) */
  readonly previewUrl = computed<SafeResourceUrl>(() => {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.result().url);
  });

  togglePreview(): void {
    this.showPreview.update((v) => !v);
  }

  async downloadFile(event?: Event): Promise<void> {
    const res = this.result();
    if (!res?.blob) return;

    const filename = res.filename.endsWith('.pdf') ? res.filename : `${res.filename}.pdf`;

    // 1. Modern Chromium File System Access API: Native "Save As" file picker
    // Allows user to choose folder and guarantees the .pdf extension
    if ('showSaveFilePicker' in window) {
      if (event) {
        event.preventDefault();
      }
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'PDF Document (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(res.blob);
        await writable.close();
        return;
      } catch (err: unknown) {
        // User clicked Cancel in the Save dialog
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // If permission error or failure, fall through to native anchor download
      }
    }

    // 2. Standard HTML5 anchor download fallback
    // When called from code (no event), trigger the anchor cleanly using persistent res.url
    if (!event) {
      const link = document.createElement('a');
      link.href = res.url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 2000);
    }
    // If event is present on <a>, letting default proceed downloads with res.url and download="filename"
  }
}
