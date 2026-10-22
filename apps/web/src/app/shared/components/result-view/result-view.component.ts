import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
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
      max-width: 620px;
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
  `]
})
export class ResultViewComponent {
  private sanitizer = inject(DomSanitizer);

  readonly result = input.required<MergeResult>();
  readonly reset = output<void>();

  readonly safeUrl = computed<SafeUrl>(() => {
    return this.sanitizer.bypassSecurityTrustUrl(this.result().url);
  });

  downloadFile(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    const res = this.result();
    if (!res?.url) return;

    // Use native DOM anchor to enforce exact filename and .pdf extension in Chromium
    const link = document.createElement('a');
    link.href = res.url;
    link.download = res.filename.endsWith('.pdf') ? res.filename : `${res.filename}.pdf`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 150);
  }
}
