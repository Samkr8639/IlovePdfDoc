import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { MergeResult } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-result-view',
  imports: [RouterLink],
  template: `
    <div class="result-experience">
      <!-- 1. CELEBRATORY SUCCESS HEADER -->
      <header class="result-hero-header">
        <div class="success-icon-badge" aria-hidden="true">
          <div class="success-ring-pulse"></div>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1 class="result-h1">PDFs Merged Successfully!</h1>
        <p class="result-lead">
          Your files have been combined into a high-quality PDF document directly in your browser memory.
        </p>
      </header>

      <!-- 2. SIGNATURE DOCUMENT SHOWCASE CARD -->
      <section class="document-showcase-card" aria-label="Merged PDF Download">
        <!-- Document Meta Header inside Card -->
        <div class="doc-card-top">
          <div class="doc-file-identity">
            <div class="pdf-file-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#FEE2E2" stroke="#E53238" stroke-width="2"/>
                <polyline points="14 2 14 8 20 8" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="7" y="18" font-size="6.5" font-weight="800" fill="#E53238" font-family="'Segoe UI', Roboto, sans-serif">PDF</text>
              </svg>
            </div>
            <div class="doc-file-info">
              <span class="doc-filename" [title]="result().filename">{{ result().filename }}</span>
              <div class="doc-badges-row">
                <span class="info-pill size-pill">{{ result().formattedSize }}</span>
                <span class="dot-divider">•</span>
                <span class="info-pill page-pill">{{ result().pageCount }} {{ result().pageCount === 1 ? 'Page' : 'Pages' }}</span>
                <span class="dot-divider">•</span>
                <span class="info-pill secure-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  100% In-Browser
                </span>
              </div>
            </div>
          </div>

          <!-- Quick Preview Toggle Pill -->
          <button
            type="button"
            class="preview-pill-btn"
            (click)="showPreview.set(!showPreview())"
            [attr.aria-expanded]="showPreview()"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>{{ showPreview() ? 'Hide Live Preview' : 'Quick Preview' }}</span>
          </button>
        </div>

        <!-- Primary Action Area: Giant Download CTA + Branded Cloud Actions -->
        <div class="doc-actions-cluster">
          <!-- PRIMARY DOWNLOAD CTA BUTTON (Includes download-btn class for tests) -->
          <a
            [href]="safeUrl()"
            [download]="result().filename"
            (click)="downloadFile($event)"
            class="prime-download-btn download-btn"
            role="button"
          >
            <div class="btn-icon-wrapper">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </div>
            <div class="btn-text-block">
              <span class="btn-title">Download Merged PDF</span>
              <span class="btn-subtext">Click to save to your device</span>
            </div>
          </a>

          <!-- SECONDARY ACTIONS TOOLBAR -->
          <div class="secondary-actions-bar">
            <!-- Save to Google Drive -->
            <button
              type="button"
              class="action-pill-btn drive-btn"
              (click)="openGoogleDrive($event)"
              title="Save to Google Drive"
            >
              <svg width="18" height="16" viewBox="0 0 24 21" fill="none">
                <path d="M8.04 13.8L12.04 20.73H23.54L19.54 13.8H8.04Z" fill="#2684FC"/>
                <path d="M15.96 0.27H4.46L0.46 7.2L6.21 17.16L10.21 10.23L15.96 0.27Z" fill="#00AC47"/>
                <path d="M15.96 0.27L10.21 10.23L14.21 17.16L23.54 20.73L19.96 7.2L15.96 0.27Z" fill="#FFBA00"/>
              </svg>
              <span>Drive</span>
            </button>

            <!-- Save to Dropbox -->
            <button
              type="button"
              class="action-pill-btn dropbox-btn"
              (click)="openDropbox($event)"
              title="Save to Dropbox"
            >
              <svg width="18" height="16" viewBox="0 0 24 22" fill="#0061FE">
                <path d="M6 1.8L0 5.7L6 9.6L12 5.7L6 1.8ZM18 1.8L12 5.7L18 9.6L24 5.7L18 1.8ZM0 13.5L6 17.4L12 13.5L6 9.6L0 13.5ZM24 13.5L18 9.6L12 13.5L18 17.4L24 13.5ZM6 18.7L12 22.6L18 18.7L12 14.8L6 18.7Z"/>
              </svg>
              <span>Dropbox</span>
            </button>

            <!-- Copy Shareable Link -->
            <button
              type="button"
              class="action-pill-btn link-btn"
              (click)="copyShareLink()"
              title="Copy download link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <span>{{ copied() ? 'Copied!' : 'Copy Link' }}</span>
            </button>

            <!-- Start Over / Merge More -->
            <button
              type="button"
              class="action-pill-btn restart-btn"
              (click)="reset.emit()"
              title="Merge more files / Start over"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>Merge More</span>
            </button>
          </div>
        </div>

        <!-- COPIED TOAST CONFIRMATION -->
        @if (copied()) {
          <div class="toast-popup" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Blob download link copied to clipboard</span>
          </div>
        }

        <!-- LIVE EXPANDABLE PREVIEW FRAME -->
        @if (showPreview()) {
          <div class="preview-drawer">
            <div class="preview-drawer-header">
              <div class="preview-tag-group">
                <span class="preview-indicator-dot"></span>
                <span class="preview-title">Document Inspection Viewer</span>
                <span class="preview-engine-tag">Local WebAssembly Engine</span>
              </div>
              <button
                type="button"
                class="preview-close-btn"
                (click)="showPreview.set(false)"
                aria-label="Close preview"
              >
                ✕ Close Preview
              </button>
            </div>
            <iframe
              [src]="previewUrl()"
              class="preview-embed-frame"
              title="Live Merged PDF Preview"
            ></iframe>
          </div>
        }
      </section>

      <!-- 3. PRIVACY GUARANTEE BANNER (Modern lightbulb/shield equivalent) -->
      <aside class="privacy-callout-banner">
        <div class="callout-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div class="callout-content">
          <strong>Zero Server Storage:</strong> Your documents were merged directly inside your browser's private memory. No files are uploaded to our servers, keeping your data confidential.
        </div>
      </aside>

      <!-- 4. RECOMMENDED NEXT TOOLS ("Continue to...") -->
      <section class="next-tools-section">
        <div class="section-top-row">
          <h2 class="section-title">Continue with your document</h2>
          <span class="section-hint">Choose another operation to perform on your merged PDF</span>
        </div>

        <div class="tools-showcase-grid">
          <!-- 1. Compress PDF -->
          <a routerLink="/compress-pdf" class="tool-recommend-card">
            <div class="tool-icon-box emerald-box">
              <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
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
            <div class="tool-meta">
              <h3 class="tool-name">Compress PDF</h3>
              <p class="tool-desc">Reduce file size without quality loss</p>
            </div>
            <span class="tool-arrow-icon" aria-hidden="true">→</span>
          </a>

          <!-- 2. Split PDF -->
          <a routerLink="/split-pdf" class="tool-recommend-card">
            <div class="tool-icon-box coral-box">
              <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="22" height="22" rx="5" fill="#E53238" />
                <line x1="19" y1="19" x2="9" y2="9" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <polyline points="16 9 9 9 9 16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                <line x1="29" y1="29" x2="39" y2="39" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <polyline points="32 39 39 39 39 32" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="tool-meta">
              <h3 class="tool-name">Split PDF</h3>
              <p class="tool-desc">Extract pages or split into documents</p>
            </div>
            <span class="tool-arrow-icon" aria-hidden="true">→</span>
          </a>

          <!-- 3. PDF to Word -->
          <a routerLink="/pdf-to-word" class="tool-recommend-card">
            <div class="tool-icon-box word-box">
              <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="18" y="16" width="26" height="26" rx="6" fill="#2B579A" />
                <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
              </svg>
            </div>
            <div class="tool-meta">
              <h3 class="tool-name">PDF to Word</h3>
              <p class="tool-desc">Convert to editable DOCX format</p>
            </div>
            <span class="tool-arrow-icon" aria-hidden="true">→</span>
          </a>

          <!-- 4. Rotate PDF -->
          <a routerLink="/rotate-pdf" class="tool-recommend-card">
            <div class="tool-icon-box purple-box">
              <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#7C3AED" />
                <rect x="19" y="17" width="10" height="14" rx="2" fill="white" opacity="0.35"/>
                <path d="M24 13a11 11 0 1 1-7.8 3.2M16 11v6h6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
            </div>
            <div class="tool-meta">
              <h3 class="tool-name">Rotate PDF</h3>
              <p class="tool-desc">Turn portrait or landscape pages</p>
            </div>
            <span class="tool-arrow-icon" aria-hidden="true">→</span>
          </a>

          <!-- 5. Protect PDF -->
          <a routerLink="/protect-pdf" class="tool-recommend-card">
            <div class="tool-icon-box navy-box">
              <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E3A8A" />
                <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white"/>
                <circle cx="24" cy="23" r="2.5" fill="#1E3A8A"/>
              </svg>
            </div>
            <div class="tool-meta">
              <h3 class="tool-name">Protect PDF</h3>
              <p class="tool-desc">Lock with AES-256 encryption</p>
            </div>
            <span class="tool-arrow-icon" aria-hidden="true">→</span>
          </a>

          <!-- 6. Watermark PDF -->
          <a routerLink="/watermark-pdf" class="tool-recommend-card">
            <div class="tool-icon-box amber-box">
              <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#D97706" />
                <circle cx="24" cy="24" r="12" stroke="white" stroke-width="2.5" stroke-dasharray="3 3"/>
                <text x="24" y="28" font-size="12" font-weight="900" fill="white" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">★</text>
              </svg>
            </div>
            <div class="tool-meta">
              <h3 class="tool-name">Watermark PDF</h3>
              <p class="tool-desc">Add text stamps or image stamps</p>
            </div>
            <span class="tool-arrow-icon" aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <!-- 5. GOOGLE ADSENSE PLACEHOLDER SLOT -->
      <section class="adsense-card-slot" aria-label="Advertisement">
        <span class="ads-tag">Advertisement</span>
        <div class="ads-box-content">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.45">
            <rect x="2" y="3" width="20" height="14" rx="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>Google AdSense Slot • Responsive Leaderboard (728 × 90 / 320 × 100)</span>
        </div>
      </section>

      <!-- 6. SPREAD THE WORD / SOCIAL SHARING -->
      <footer class="spread-word-section">
        <h4 class="spread-title">Help us spread the word</h4>
        <p class="spread-subtitle">If PDF flow saved you time today, share it with your friends or team!</p>
        <div class="social-share-pills">
          <button type="button" class="share-pill-btn x-pill" (click)="shareOnTwitter()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>Twitter / X</span>
          </button>

          <button type="button" class="share-pill-btn linkedin-pill" (click)="shareOnLinkedIn()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            <span>LinkedIn</span>
          </button>

          <button type="button" class="share-pill-btn facebook-pill" (click)="shareOnFacebook()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
            </svg>
            <span>Facebook</span>
          </button>

          <button type="button" class="share-pill-btn whatsapp-pill" (click)="shareOnWhatsApp()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
            </svg>
            <span>WhatsApp</span>
          </button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .result-experience {
      display: flex;
      flex-direction: column;
      gap: 28px;
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      padding: 10px 0 32px;
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* 1. SUCCESS HERO HEADER */
    .result-hero-header {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .success-icon-badge {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #10B981;
      color: #ffffff;
      box-shadow: 0 10px 25px -4px rgba(16, 185, 129, 0.4);
      margin-bottom: 16px;
    }
    .success-ring-pulse {
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      border: 2px solid rgba(16, 185, 129, 0.35);
      animation: pulseGlow 2.5s infinite ease-out;
    }
    @keyframes pulseGlow {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 0; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .result-h1 {
      font-size: clamp(28px, 4vw, 38px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #0f172a;
      margin: 0 0 8px;
    }
    .result-lead {
      font-size: 16px;
      color: #64748b;
      margin: 0;
      max-width: 620px;
      line-height: 1.5;
    }

    /* 2. SHOWCASE CARD */
    .document-showcase-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 30px 36px;
      box-shadow: 0 12px 35px -8px rgba(15, 23, 42, 0.07);
      display: flex;
      flex-direction: column;
      gap: 24px;
      transition: all 0.25s ease;
    }
    .document-showcase-card:hover {
      box-shadow: 0 16px 40px -8px rgba(15, 23, 42, 0.1);
      border-color: #cbd5e1;
    }

    /* Card Top identity bar */
    .doc-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-bottom: 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .doc-file-identity {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .pdf-file-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #fef2f2;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid #fee2e2;
    }
    .doc-file-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .doc-filename {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      max-width: 440px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: -0.01em;
    }
    .doc-badges-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #64748b;
    }
    .info-pill {
      font-weight: 600;
      color: #475569;
    }
    .dot-divider {
      color: #cbd5e1;
    }
    .secure-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #10B981;
      font-weight: 600;
    }

    /* Preview toggle pill button */
    .preview-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 600;
      color: #0284C7;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .preview-pill-btn:hover {
      background: #f0f9ff;
      border-color: #38bdf8;
      transform: translateY(-1px);
    }

    /* Main CTA & Secondary Bar */
    .doc-actions-cluster {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      width: 100%;
    }

    /* Giant Red Download CTA */
    .prime-download-btn {
      width: 100%;
      max-width: 520px;
      height: 72px;
      border-radius: 16px;
      background: linear-gradient(135deg, #FF3B30 0%, #E5252A 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      text-decoration: none;
      box-shadow: 0 10px 25px -4px rgba(229, 37, 42, 0.45);
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }
    .prime-download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 32px -4px rgba(229, 37, 42, 0.55);
      background: linear-gradient(135deg, #ff453a 0%, #d32025 100%);
    }
    .prime-download-btn:active {
      transform: translateY(0);
    }
    .btn-icon-wrapper {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .btn-text-block {
      display: flex;
      flex-direction: column;
      text-align: left;
    }
    .btn-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.015em;
      line-height: 1.2;
    }
    .btn-subtext {
      font-size: 12.5px;
      opacity: 0.85;
      font-weight: 500;
    }

    /* Secondary Cloud & Utility Actions */
    .secondary-actions-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      width: 100%;
    }
    .action-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .action-pill-btn:hover {
      background: #ffffff;
      border-color: #cbd5e1;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .drive-btn:hover {
      border-color: #2684FC;
      color: #1e40af;
    }
    .dropbox-btn:hover {
      border-color: #0061FE;
      color: #0061FE;
    }
    .restart-btn {
      background: #ffffff;
      border-color: #cbd5e1;
      color: #0f172a;
    }
    .restart-btn:hover {
      background: #f1f5f9;
    }

    /* Toast */
    .toast-popup {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #0f172a;
      color: #ffffff;
      padding: 9px 20px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 600;
      box-shadow: 0 6px 18px rgba(0,0,0,0.18);
      animation: fadeIn 0.2s ease;
      margin: 0 auto;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Expandable Preview Frame */
    .preview-drawer {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      margin-top: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }
    .preview-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .preview-tag-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .preview-indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
    }
    .preview-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .preview-engine-tag {
      font-size: 11.5px;
      color: #64748b;
      padding: 2px 8px;
      background: #e2e8f0;
      border-radius: 6px;
      font-weight: 600;
    }
    .preview-close-btn {
      background: none;
      border: none;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
    }
    .preview-close-btn:hover {
      color: #0f172a;
    }
    .preview-embed-frame {
      width: 100%;
      height: 540px;
      border: none;
      display: block;
      background: #525659;
    }

    /* 3. PRIVACY CALLOUT */
    .privacy-callout-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 22px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      font-size: 14px;
      color: #1e3a8a;
      line-height: 1.5;
    }
    .callout-icon-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .callout-content strong {
      color: #1d4ed8;
      font-weight: 700;
    }

    /* 4. RECOMMENDED NEXT TOOLS GRID */
    .next-tools-section {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .section-top-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.015em;
      margin: 0;
    }
    .section-hint {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }
    .tools-showcase-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .tool-recommend-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      text-decoration: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }
    .tool-recommend-card:hover {
      border-color: #fca5a5;
      transform: translateY(-3px);
      box-shadow: 0 10px 24px -4px rgba(229, 50, 56, 0.12);
    }
    .tool-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .emerald-box { background: #ecfdf5; }
    .coral-box   { background: #fef2f2; }
    .word-box    { background: #eff6ff; }
    .purple-box  { background: #f5f3ff; }
    .navy-box    { background: #eff6ff; }
    .amber-box   { background: #fffbeb; }

    .tool-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .tool-name {
      font-size: 15.5px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .tool-desc {
      font-size: 12.5px;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
    }
    .tool-arrow-icon {
      font-size: 16px;
      color: #94a3b8;
      font-weight: 700;
      transition: transform 0.2s ease;
    }
    .tool-recommend-card:hover .tool-arrow-icon {
      transform: translateX(4px);
      color: #E53238;
    }

    /* 5. ADSENSE CARD */
    .adsense-card-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #fafafa;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
      padding: 16px;
    }
    .ads-tag {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .ads-box-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
      min-height: 60px;
    }

    /* 6. SPREAD THE WORD */
    .spread-word-section {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
    }
    .spread-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .spread-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 8px;
    }
    .social-share-pills {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .share-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.18s ease;
    }
    .x-pill {
      background: #000000;
      color: #ffffff;
    }
    .x-pill:hover {
      background: #262626;
      transform: translateY(-1px);
    }
    .linkedin-pill {
      background: #0A66C2;
      color: #ffffff;
    }
    .linkedin-pill:hover {
      background: #095196;
      transform: translateY(-1px);
    }
    .facebook-pill {
      background: #1877F2;
      color: #ffffff;
    }
    .facebook-pill:hover {
      background: #145dbf;
      transform: translateY(-1px);
    }
    .whatsapp-pill {
      background: #25D366;
      color: #ffffff;
    }
    .whatsapp-pill:hover {
      background: #20ba5a;
      transform: translateY(-1px);
    }

    @media (max-width: 900px) {
      .tools-showcase-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .document-showcase-card {
        padding: 24px 20px;
      }
      .prime-download-btn {
        max-width: 100%;
        height: 66px;
      }
    }

    @media (max-width: 640px) {
      .tools-showcase-grid {
        grid-template-columns: 1fr;
      }
      .doc-card-top {
        flex-direction: column;
        align-items: flex-start;
      }
      .doc-filename {
        max-width: 260px;
      }
      .secondary-actions-bar {
        flex-direction: column;
        width: 100%;
      }
      .action-pill-btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class ResultViewComponent {
  private sanitizer = inject(DomSanitizer);

  result = input.required<MergeResult>();
  reset = output<void>();

  showPreview = signal<boolean>(false);
  copied = signal<boolean>(false);

  safeUrl = computed<SafeUrl>(() => {
    return this.sanitizer.bypassSecurityTrustUrl(this.result().url);
  });

  previewUrl = computed<SafeResourceUrl>(() => {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.result().url);
  });

  downloadFile(event?: Event): void {
    const res = this.result();
    if (!res) return;

    try {
      const anchor = document.createElement('a');
      anchor.href = res.url;
      anchor.download = res.filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      // Fallback
    }
  }

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

  copyShareLink(): void {
    const url = this.result().url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 3000);
      });
    }
  }

  shareOnTwitter(): void {
    const text = encodeURIComponent('Just merged multiple PDFs instantly and privately in browser with PDF flow! Check it out:');
    const url = encodeURIComponent(window.location.origin);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer');
  }

  shareOnLinkedIn(): void {
    const url = encodeURIComponent(window.location.origin);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener,noreferrer');
  }

  shareOnFacebook(): void {
    const url = encodeURIComponent(window.location.origin);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer');
  }

  shareOnWhatsApp(): void {
    const text = encodeURIComponent('Merge PDFs privately and free with PDF flow: ' + window.location.origin);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}
