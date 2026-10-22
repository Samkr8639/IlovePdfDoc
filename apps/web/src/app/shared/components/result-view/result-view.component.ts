import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { MergeResult } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-result-view',
  imports: [RouterLink],
  template: `
    <div class="dribbble-result-container">
      <!-- TOP NAVIGATION BAR (Exact Dribbble video Screen 4) -->
      <div class="result-nav-bar">
        <a routerLink="/" class="nav-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Back to main page</span>
        </a>

        <button type="button" class="nav-restart-btn" (click)="reset.emit()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Start over</span>
        </button>
      </div>

      <!-- MAIN DOCUMENT CARDS DUAL VIEW -->
      <div class="result-dual-view">
        <!-- 1. LEFT INTERACTIVE ACTION CARD (Dribbble Dark/Hover Card) -->
        <div class="doc-card action-card">
          <div class="doc-card-header">
            <div class="doc-meta-left">
              <span class="doc-filename" [title]="result().filename">{{ result().filename }}</span>
              <span class="doc-filesize">{{ result().formattedSize }} • {{ result().pageCount }} Pages</span>
            </div>

            <!-- External Link: Open in New Tab -->
            <a [href]="safeUrl()" target="_blank" rel="noopener noreferrer" class="doc-external-link" title="Open in New Tab">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </div>

          <!-- Document Mini Summary -->
          <div class="action-card-body">
            <div class="completion-icon-ring">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h4 class="action-card-title">Document Ready</h4>
            <p class="action-card-subtitle">
              Merged directly in browser memory with zero server uploads.
            </p>
          </div>

          <!-- DOWNLOAD BUTTON (Exact Dribbble Red Download file Button) -->
          <div class="action-card-footer">
            <a
              [href]="safeUrl()"
              [download]="result().filename"
              (click)="downloadFile($event)"
              class="dribbble-download-btn download-btn"
            >
              <span>Download file</span>
            </a>
          </div>
        </div>

        <!-- 2. RIGHT PREVIEW CARD (Interactive PDF Canvas) -->
        <div class="doc-card preview-card">
          <div class="preview-card-header">
            <span class="preview-tag">Live Preview</span>
            <span class="preview-sub">100% In-Browser Render</span>
          </div>

          <div class="preview-iframe-box">
            <iframe
              [src]="previewUrl()"
              class="preview-iframe"
              title="Merged PDF Preview"
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dribbble-result-container {
      width: 100%;
      max-width: 1040px;
      margin: 32px auto 64px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* TOP NAV BAR */
    .result-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
    }
    .nav-back-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-main);
      text-decoration: underline;
      text-underline-offset: 4px;
      transition: color 0.15s ease;
    }
    .nav-back-link:hover {
      color: var(--coral-600);
    }
    .nav-restart-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.15s ease;
    }
    .nav-restart-btn:hover {
      color: var(--text-main);
    }

    /* DUAL VIEW GRID */
    .result-dual-view {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 24px;
      align-items: stretch;
    }

    .doc-card {
      border-radius: var(--radius-2xl);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* LEFT ACTION CARD */
    .action-card {
      background: #1e293b;
      color: #ffffff;
      padding: 28px;
      justify-content: space-between;
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.25);
      min-height: 480px;
    }
    .doc-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .doc-meta-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: hidden;
    }
    .doc-filename {
      font-size: 17px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .doc-filesize {
      font-size: 13px;
      color: #94a3b8;
    }
    .doc-external-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    .doc-external-link:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .action-card-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      margin: 32px 0;
    }
    .completion-icon-ring {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .action-card-title {
      font-size: 20px;
      font-weight: 800;
      margin: 0;
    }
    .action-card-subtitle {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      max-width: 260px;
      margin: 0;
    }

    /* DRIBBLE DOWNLOAD BUTTON */
    .action-card-footer {
      width: 100%;
    }
    .dribbble-download-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 15px;
      background: var(--coral-600);
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
      border-radius: var(--radius-lg);
      box-shadow: 0 8px 20px rgba(229, 57, 53, 0.4);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }
    .dribbble-download-btn:hover {
      background: var(--coral-700);
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(229, 57, 53, 0.5);
    }

    /* RIGHT PREVIEW CARD */
    .preview-card {
      background: #ffffff;
      border: 1px solid var(--surface-border);
      box-shadow: var(--shadow-sm);
    }
    .preview-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--surface-border);
      background: #fafafa;
    }
    .preview-tag {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-main);
    }
    .preview-sub {
      font-size: 12px;
      font-weight: 600;
      color: var(--emerald-600);
    }
    .preview-iframe-box {
      width: 100%;
      height: 540px;
      background: #f1f3f5;
    }
    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    @media (max-width: 860px) {
      .result-dual-view {
        grid-template-columns: 1fr;
      }
      .action-card {
        min-height: auto;
      }
      .preview-iframe-box {
        height: 380px;
      }
    }
  `]
})
export class ResultViewComponent {
  private sanitizer = inject(DomSanitizer);

  readonly result = input.required<MergeResult>();
  readonly reset = output<void>();

  /** Sanitised blob URL for the download link */
  readonly safeUrl = computed<SafeUrl>(() => {
    return this.sanitizer.bypassSecurityTrustUrl(this.result().url);
  });

  /** Sanitised blob URL for the iframe src (SafeResourceUrl required for iframe) */
  readonly previewUrl = computed<SafeResourceUrl>(() => {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.result().url);
  });

  async downloadFile(event?: Event): Promise<void> {
    const res = this.result();
    if (!res?.blob) return;

    const filename = res.filename.endsWith('.pdf') ? res.filename : `${res.filename}.pdf`;

    // Modern Chromium File System Access API
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
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback: standard anchor download using persistent res.url
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
  }
}
