import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { MergeResult } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-result-view',
  imports: [RouterLink],
  template: `
    <div class="ilove-result-page">
      <!-- HEADER TITLE -->
      <div class="result-header">
        <h1 class="result-title">PDFs have been merged!</h1>
        <p class="result-subtitle">
          Your files have been combined into a single PDF document in your browser memory.
        </p>
      </div>

      <!-- MAIN DOWNLOAD CENTERPIECE (Exact iLovePDF signature download row) -->
      <div class="download-centerpiece-row">
        <!-- Back / Start Over Button -->
        <button
          type="button"
          class="circle-action-btn back-circle-btn"
          (click)="reset.emit()"
          title="Merge more files / Start over"
          aria-label="Start over"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>

        <!-- Giant Red Download Button (Includes download-btn class for tests) -->
        <a
          [href]="safeUrl()"
          [download]="result().filename"
          (click)="downloadFile($event)"
          class="main-download-btn download-btn"
          role="button"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span class="btn-text">Download merged PDF</span>
        </a>

        <!-- Circular Action Buttons Stack (Drive, Dropbox, Share, Delete) -->
        <div class="circle-tools-cluster">
          <!-- Google Drive -->
          <button
            type="button"
            class="circle-action-btn red-tool-btn"
            title="Save to Google Drive"
            aria-label="Google Drive"
            (click)="openGoogleDrive($event)"
          >
            <svg width="18" height="16" viewBox="0 0 24 21" fill="none">
              <path d="M8.04 13.8L12.04 20.73H23.54L19.54 13.8H8.04Z" fill="#ffffff"/>
              <path d="M15.96 0.27H4.46L0.46 7.2L6.21 17.16L10.21 10.23L15.96 0.27Z" fill="#ffffff" opacity="0.85"/>
              <path d="M15.96 0.27L10.21 10.23L14.21 17.16L23.54 20.73L19.96 7.2L15.96 0.27Z" fill="#ffffff" opacity="0.7"/>
            </svg>
          </button>

          <!-- Dropbox -->
          <button
            type="button"
            class="circle-action-btn red-tool-btn"
            title="Save to Dropbox"
            aria-label="Dropbox"
            (click)="openDropbox($event)"
          >
            <svg width="16" height="16" viewBox="0 0 24 22" fill="#ffffff">
              <path d="M6 1.8L0 5.7L6 9.6L12 5.7L6 1.8ZM18 1.8L12 5.7L18 9.6L24 5.7L18 1.8ZM0 13.5L6 17.4L12 13.5L6 9.6L0 13.5ZM24 13.5L18 9.6L12 13.5L18 17.4L24 13.5ZM6 18.7L12 22.6L18 18.7L12 14.8L6 18.7Z"/>
            </svg>
          </button>

          <!-- Copy Link / Share -->
          <button
            type="button"
            class="circle-action-btn red-tool-btn"
            title="Share download link"
            aria-label="Share download link"
            (click)="copyShareLink()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>

          <!-- Delete / Start Over -->
          <button
            type="button"
            class="circle-action-btn red-tool-btn delete-btn"
            title="Delete from memory & start over"
            aria-label="Delete and start over"
            (click)="reset.emit()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- FILE META INFO & PREVIEW TOGGLE -->
      <div class="result-meta-bar">
        <span class="file-summary-chip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E53238" stroke-width="2.2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <strong class="meta-fname">{{ result().filename }}</strong>
          <span class="meta-dot">•</span>
          <span>{{ result().formattedSize }}</span>
          <span class="meta-dot">•</span>
          <span>{{ result().pageCount }} {{ result().pageCount === 1 ? 'Page' : 'Pages' }}</span>
        </span>

        <button
          type="button"
          class="preview-toggle-btn"
          (click)="showPreview.set(!showPreview())"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>{{ showPreview() ? 'Hide Document Preview' : 'Preview Merged PDF' }}</span>
        </button>
      </div>

      <!-- COPIED TOAST -->
      @if (copied()) {
        <div class="toast-notice">
          <span>✓ Download URL copied to clipboard!</span>
        </div>
      }

      <!-- EXPANDABLE IN-BROWSER PREVIEW IFRAME -->
      @if (showPreview()) {
        <div class="preview-expand-box">
          <div class="preview-box-header">
            <span class="preview-header-tag">Live In-Browser PDF Preview</span>
            <span class="preview-header-sub">Rendered locally with zero server upload</span>
            <button type="button" class="close-preview-btn" (click)="showPreview.set(false)">✕</button>
          </div>
          <iframe
            [src]="previewUrl()"
            class="document-iframe"
            title="Merged PDF Preview"
          ></iframe>
        </div>
      }

      <!-- CONTINUE TO... CARD (Exact iLovePDF signature cross-tool card) -->
      <div class="continue-to-card">
        <h3 class="continue-heading">Continue to...</h3>
        <div class="continue-tools-grid">
          <!-- Compress PDF -->
          <a routerLink="/compress-pdf" class="continue-tool-item">
            <div class="continue-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="18" height="18" rx="4" fill="#10B981" />
                <polyline points="10 16 16 16 16 10" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="26" y="4" width="18" height="18" rx="4" fill="#10B981" />
                <polyline points="38 16 32 16 32 10" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="4" y="26" width="18" height="18" rx="4" fill="#10B981" />
                <polyline points="10 32 16 32 16 38" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="26" y="26" width="18" height="18" rx="4" fill="#10B981" />
                <polyline points="38 32 32 32 32 38" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="continue-tool-name">Compress PDF</span>
            <span class="continue-arrow">›</span>
          </a>

          <!-- Split PDF -->
          <a routerLink="/split-pdf" class="continue-tool-item">
            <div class="continue-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="22" height="22" rx="5" fill="#E53238" />
                <line x1="19" y1="19" x2="9" y2="9" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <polyline points="16 9 9 9 9 16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                <line x1="29" y1="29" x2="39" y2="39" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <polyline points="32 39 39 39 39 32" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="continue-tool-name">Split PDF</span>
            <span class="continue-arrow">›</span>
          </a>

          <!-- PDF to Word -->
          <a routerLink="/pdf-to-word" class="continue-tool-item">
            <div class="continue-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="18" y="16" width="26" height="26" rx="6" fill="#2B579A" />
                <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
              </svg>
            </div>
            <span class="continue-tool-name">PDF to Word</span>
            <span class="continue-arrow">›</span>
          </a>

          <!-- Rotate PDF -->
          <a routerLink="/rotate-pdf" class="continue-tool-item">
            <div class="continue-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#7C3AED" />
                <rect x="19" y="17" width="10" height="14" rx="2" fill="white" opacity="0.35"/>
                <path d="M24 13a11 11 0 1 1-7.8 3.2M16 11v6h6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
            </div>
            <span class="continue-tool-name">Rotate PDF</span>
            <span class="continue-arrow">›</span>
          </a>

          <!-- Protect PDF -->
          <a routerLink="/protect-pdf" class="continue-tool-item">
            <div class="continue-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E3A8A" />
                <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white"/>
                <circle cx="24" cy="23" r="2.5" fill="#1E3A8A"/>
              </svg>
            </div>
            <span class="continue-tool-name">Protect PDF</span>
            <span class="continue-arrow">›</span>
          </a>

          <!-- Watermark PDF -->
          <a routerLink="/watermark-pdf" class="continue-tool-item">
            <div class="continue-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#9D174D" />
                <path d="M24 13c-2 0-3 1.5-3 3v4h6v-4c0-1.5-1-3-3-3z" fill="white"/>
                <rect x="15" y="20" width="18" height="5" rx="1.5" fill="white"/>
                <rect x="12" y="26" width="24" height="4" rx="1.5" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <span class="continue-tool-name">Add watermark</span>
            <span class="continue-arrow">›</span>
          </a>
        </div>
      </div>

      <!-- DEDICATED ADSENSE ADVERTISEMENT SLOT -->
      <div class="adsense-banner-container">
        <span class="adsense-tag">Advertisement</span>
        <div class="adsense-slot-box">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.4">
            <rect x="2" y="3" width="20" height="14" rx="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>Google AdSense Slot • Responsive Leaderboard (728 × 90 / 970 × 90)</span>
        </div>
      </div>

      <!-- TRUST & SPREAD THE WORD FOOTER -->
      <div class="spread-word-box">
        <p class="spread-heading">How can you thank us? Spread the word!</p>
        <p class="spread-sub">Please share the tool to inspire more productive people!</p>
        <div class="social-share-row">
          <button type="button" class="share-btn-pill" (click)="copyShareLink()">
            ⭐ Rate 5 Stars
          </button>
          <a href="https://twitter.com/intent/tweet?text=Just%20merged%20my%20PDFs%20instantly%20and%20privately%20with%20PDF%20flow!" target="_blank" rel="noopener noreferrer" class="share-btn-pill">
            𝕏 Twitter
          </a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://github.com/Samkr8639/IlovePdfDoc" target="_blank" rel="noopener noreferrer" class="share-btn-pill">
            in LinkedIn
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ilove-result-page {
      width: 100%;
      max-width: 960px;
      margin: 40px auto 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      padding: 0 16px;
    }

    /* HEADER */
    .result-header {
      text-align: center;
      margin-bottom: 8px;
    }
    .result-title {
      font-size: clamp(32px, 4vw, 42px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #0f172a;
      margin: 0 0 10px;
    }
    .result-subtitle {
      font-size: 16.5px;
      color: #64748b;
      margin: 0;
      max-width: 580px;
    }

    /* SIGNATURE DOWNLOAD ROW */
    .download-centerpiece-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
      margin: 8px 0;
    }

    /* CIRCLE ACTION BUTTONS */
    .circle-action-btn {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .back-circle-btn {
      background: #1e293b;
      color: #ffffff;
      border-color: #1e293b;
    }
    .back-circle-btn:hover {
      background: #0f172a;
      transform: scale(1.08);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
    }

    /* GIANT RED DOWNLOAD BUTTON (Exact iLovePDF signature button) */
    .main-download-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      background: #E53238;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.015em;
      height: 72px;
      padding: 0 44px;
      min-width: 330px;
      border-radius: 14px;
      text-decoration: none;
      box-shadow: 0 8px 24px -2px rgba(229, 50, 56, 0.45);
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }
    .main-download-btn:hover {
      background: #d3282e;
      transform: translateY(-2px);
      box-shadow: 0 12px 30px -2px rgba(229, 50, 56, 0.55);
    }
    .main-download-btn:active {
      transform: translateY(0);
    }

    /* CLUSTER OF 4 RED TOOL BUTTONS */
    .circle-tools-cluster {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .red-tool-btn {
      background: #E53238;
      color: #ffffff;
      border-color: #E53238;
    }
    .red-tool-btn:hover {
      background: #d3282e;
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(229, 50, 56, 0.35);
    }
    .red-tool-btn.delete-btn:hover {
      background: #b91c1c;
    }

    /* FILE META BAR & PREVIEW TOGGLE */
    .result-meta-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .file-summary-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      font-size: 13.5px;
      color: #475569;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .meta-fname {
      color: #0f172a;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta-dot {
      color: #cbd5e1;
    }
    .preview-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      color: #0284c7;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .preview-toggle-btn:hover {
      background: #f0f9ff;
      border-color: #38bdf8;
    }

    /* TOAST */
    .toast-notice {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* EXPANDABLE PREVIEW BOX */
    .preview-expand-box {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
    }
    .preview-box-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .preview-header-tag {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .preview-header-sub {
      font-size: 12px;
      color: #10b981;
      font-weight: 600;
    }
    .close-preview-btn {
      background: none;
      border: none;
      font-size: 16px;
      color: #64748b;
      cursor: pointer;
    }
    .document-iframe {
      width: 100%;
      height: 580px;
      border: none;
      display: block;
      background: #525659;
    }

    /* CONTINUE TO... CARD (Exact iLovePDF signature card) */
    .continue-to-card {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 28px 32px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    }
    .continue-heading {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 20px;
    }
    .continue-tools-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .continue-tool-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
      background: #f8fafc;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .continue-tool-item:hover {
      background: #ffffff;
      border-color: #fca5a5;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(229, 50, 56, 0.08);
    }
    .continue-icon-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .continue-tool-name {
      font-size: 14.5px;
      font-weight: 700;
      color: #1e293b;
      flex: 1;
    }
    .continue-arrow {
      font-size: 18px;
      color: #94a3b8;
      font-weight: 700;
    }

    /* ADSENSE PLACEHOLDER */
    .adsense-banner-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 8px 0;
    }
    .adsense-tag {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .adsense-slot-box {
      width: 100%;
      min-height: 90px;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
      padding: 16px;
    }

    /* SPREAD THE WORD */
    .spread-word-box {
      text-align: center;
      margin-top: 8px;
    }
    .spread-heading {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px;
    }
    .spread-sub {
      font-size: 13.5px;
      color: #64748b;
      margin: 0 0 16px;
    }
    .social-share-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .share-btn-pill {
      display: inline-flex;
      align-items: center;
      padding: 8px 18px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: all 0.15s ease;
    }
    .share-btn-pill:hover {
      border-color: #E53238;
      color: #E53238;
      transform: translateY(-1px);
    }

    @media (max-width: 860px) {
      .continue-tools-grid {
        grid-template-columns: 1fr;
      }
      .main-download-btn {
        width: 100%;
        min-width: auto;
      }
      .download-centerpiece-row {
        flex-direction: column;
      }
    }
  `]
})
export class ResultViewComponent {
  private sanitizer = inject(DomSanitizer);

  readonly result = input.required<MergeResult>();
  readonly reset = output<void>();

  showPreview = signal<boolean>(false);
  copied = signal<boolean>(false);

  /** Sanitised blob URL for the download link */
  readonly safeUrl = computed<SafeUrl>(() => {
    return this.sanitizer.bypassSecurityTrustUrl(this.result().url);
  });

  /** Sanitised blob URL for the iframe src (SafeResourceUrl required for iframe) */
  readonly previewUrl = computed<SafeResourceUrl>(() => {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.result().url);
  });

  openGoogleDrive(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.open('https://drive.google.com/', '_blank', 'noopener,noreferrer');
  }

  openDropbox(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.open('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');
  }

  async copyShareLink(): Promise<void> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(this.result().url);
      }
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 3000);
    } catch {
      // noop
    }
  }

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
