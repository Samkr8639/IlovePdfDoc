import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrowserPdfService, ValidatedPdfFile, MergeResult } from '../../core/services/browser-pdf.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { FileListComponent } from '../../shared/components/file-list/file-list.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-merge-pdf',
  imports: [
    RouterLink,
    DropzoneComponent,
    FileListComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  template: `
    <div class="tool-page">
      <!-- HEADER & BREADCRUMBS -->
      <section class="tool-header-section">
        <div class="container tool-header-container">
          <nav class="breadcrumbs" aria-label="Breadcrumb">
            <a routerLink="/" class="crumb-link">Home</a>
            <span class="crumb-sep">/</span>
            <span class="crumb-cat">Organize PDF</span>
            <span class="crumb-sep">/</span>
            <span class="crumb-current">Merge PDF</span>
          </nav>

          <!-- Merge PDF Multi-tone Vector Badge -->
          <div class="hero-badge-wrap">
            <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="4" width="22" height="22" rx="5" fill="#E53238" />
              <line x1="9" y1="9" x2="19" y2="19" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              <polyline points="13 19 19 19 19 13" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
              <line x1="39" y1="39" x2="29" y2="29" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              <polyline points="35 29 29 29 29 35" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <h1 class="tool-h1">Merge PDF files</h1>
          <p class="tool-lead">
            Combine PDFs in the order you want with the easiest PDF merger available.
            Fast, secure, and 100% private in your browser.
          </p>

          <div class="privacy-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>100% Client-Side • Files Never Leave Your Device</span>
          </div>
        </div>
      </section>

      <!-- TOP ADSENSE ADVERTISEMENT SLOT -->
      <section class="adsense-section">
        <div class="container">
          <div class="adsense-wrapper" aria-label="Advertisement">
            <span class="adsense-label">Advertisement</span>
            <div class="adsense-slot adsense-leaderboard">
              <div class="adsense-placeholder-content">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <span>Google AdSense Slot • Auto-Responsive Leaderboard (728 × 90 / 320 × 100)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- INTERACTIVE WORKSPACE -->
      <section class="workspace-section">
        <div class="container workspace-container">
          @if (errorMessage()) {
            <div class="error-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{{ errorMessage() }}</span>
              <button class="error-close" (click)="errorMessage.set(null)">✕</button>
            </div>
          }

          <!-- STATE 1: UPLOAD DROPZONE -->
          @if (currentState() === 'upload') {
            <div class="workspace-dropzone-wrapper">
              <app-dropzone
                title="Select PDF files"
                subtitle="or drop PDFs here"
                acceptedTypes=".pdf,application/pdf"
                [multiple]="true"
                limitInfo="No file limit • Free & Private in your browser"
                (filesSelected)="onFilesAdded($event)"
              ></app-dropzone>
            </div>
          }

          <!-- STATE 2: ORGANIZE & REORDER -->
          @if (currentState() === 'organize') {
            <div class="organize-workspace">
              <div class="workspace-controls-bar">
                <div class="controls-left">
                  <span class="files-summary">
                    <strong>{{ selectedFiles().length }}</strong> files ready to combine
                  </span>
                  <button type="button" class="btn-secondary add-more-btn" (click)="fileInput.click()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Add More Files</span>
                  </button>
                  <input
                    #fileInput
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,application/pdf"
                    (change)="onFileInputChange($event)"
                  />
                </div>

                <div class="controls-right">
                  <button type="button" class="btn-secondary clear-btn" (click)="resetWorkspace()">
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              <!-- FILE LIST -->
              <app-file-list
                [files]="selectedFiles()"
                (moveUp)="onMoveUp($event)"
                (moveDown)="onMoveDown($event)"
                (removeFile)="onRemoveFile($event)"
              ></app-file-list>

              <!-- FLOATING ACTION DOCK -->
              <div class="action-dock">
                <div class="dock-info">
                  <span class="dock-pill">Sequence Preserved</span>
                  <span class="dock-note">Pages will merge in the exact sequence shown above.</span>
                </div>

                <button
                  type="button"
                  class="btn-primary merge-submit-btn"
                  [disabled]="selectedFiles().length < 2 || isProcessing()"
                  (click)="executeMerge()"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                  <span>Merge {{ selectedFiles().length }} PDFs (Instant)</span>
                </button>
              </div>
            </div>
          }

          <!-- STATE 3: PROCESSING -->
          @if (currentState() === 'processing') {
            <app-processing-state
              title="Merging Documents..."
              [message]="processingMessage()"
              [percent]="processingProgress()"
            ></app-processing-state>
          }

          <!-- STATE 4: COMPLETED RESULT -->
          @if (currentState() === 'completed' && mergeResult()) {
            <app-result-view
              [result]="mergeResult()!"
              (reset)="resetWorkspace()"
            ></app-result-view>
          }
        </div>
      </section>

      <!-- MID ADSENSE ADVERTISEMENT SLOT -->
      <section class="adsense-section">
        <div class="container">
          <div class="adsense-wrapper" aria-label="Advertisement">
            <span class="adsense-label">Advertisement</span>
            <div class="adsense-slot adsense-mid-banner">
              <div class="adsense-placeholder-content">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <span>Google AdSense Slot • Responsive Billboard (970 × 90 / 728 × 90)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- VALUE PROPOSITION / FEATURE HIGHLIGHTS (With Professional Badges) -->
      <section class="features-section">
        <div class="container">
          <div class="section-heading">
            <h2 class="section-title">The easiest & safest way to merge PDF documents</h2>
            <p class="section-subtitle">Engineered for privacy, speed, and precision.</p>
          </div>

          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon-badge">
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E3A8A" />
                  <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white"/>
                  <circle cx="24" cy="23" r="2.5" fill="#1E3A8A"/>
                  <polygon points="22.5,23.5 25.5,23.5 26,29 22,29" fill="#1E3A8A"/>
                </svg>
              </div>
              <h3 class="feature-title">100% In-Browser Privacy</h3>
              <p class="feature-desc">
                Your PDF documents never touch a third-party server. Everything is merged directly inside your browser memory using WebAssembly.
              </p>
            </div>

            <div class="feature-card">
              <div class="feature-icon-badge">
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="40" height="40" rx="10" fill="#10B981" />
                  <path d="M16 24l6 6 12-12" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h3 class="feature-title">Lossless Quality</h3>
              <p class="feature-desc">
                Original vector graphics, fonts, margins, high-res images, and hyperlinks remain intact with zero degradation.
              </p>
            </div>

            <div class="feature-card">
              <div class="feature-icon-badge">
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="40" height="40" rx="10" fill="#2563EB" />
                  <path d="M18 16l6-6 6 6M24 10v28M30 32l-6 6-6-6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h3 class="feature-title">Interactive Sequence Order</h3>
              <p class="feature-desc">
                Effortlessly reorder documents before merging. Shift pages up or down to ensure your combined document is organized perfectly.
              </p>
            </div>

            <div class="feature-card">
              <div class="feature-icon-badge">
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="40" height="40" rx="10" fill="#E53238" />
                  <path d="M16 24c0-3.3 2.7-6 6-6 2.3 0 4.2 1.3 5.2 3.1.9-1.8 2.8-3.1 5.1-3.1 3.3 0 6 2.7 6 6s-2.7 6-6 6c-2.3 0-4.2-1.3-5.1-3.1-.9 1.8-2.9 3.1-5.2 3.1-3.3 0-6-2.7-6-6z" stroke="white" stroke-width="2.5" fill="none"/>
                </svg>
              </div>
              <h3 class="feature-title">Free & Unlimited</h3>
              <p class="feature-desc">
                Combine as many files as you need with no subscriptions, watermark additions, or hidden paywalls.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 3-STEP GUIDE SECTION -->
      <section class="seo-guide-section">
        <div class="container">
          <div class="guide-header">
            <h2 class="guide-title">How to merge PDF files online</h2>
            <p class="guide-lead">Three effortless steps to combine your documents with precision.</p>
          </div>

          <div class="steps-grid">
            <div class="step-card">
              <div class="step-num">01</div>
              <h3 class="step-title">Select documents</h3>
              <p class="step-desc">
                Click "Select PDF files", drag and drop your files into the uploader, or open documents from Google Drive or Dropbox.
              </p>
            </div>

            <div class="step-card">
              <div class="step-num">02</div>
              <h3 class="step-title">Arrange sequence</h3>
              <p class="step-desc">
                Use the Move Up and Move Down arrows to set the exact page order. Add more files or remove items anytime.
              </p>
            </div>

            <div class="step-card">
              <div class="step-num">03</div>
              <h3 class="step-title">Merge & download</h3>
              <p class="step-desc">
                Click "Merge PDFs". The browser combines all documents instantly with in-browser preview and instant download.
              </p>
            </div>
          </div>

          <!-- FAQ SECTION FOR MERGE PDF -->
          <div class="tool-faqs">
            <h3 class="tool-faqs-title">Frequently Asked Questions</h3>
            <div class="tool-faqs-list">
              <div class="faq-card">
                <h4 class="faq-q">Are my files uploaded to your servers when merging?</h4>
                <p class="faq-a">
                  No. PDF flow operates with 100% in-browser WebAssembly. Your documents remain strictly inside your device's memory and are never transmitted across any network.
                </p>
              </div>

              <div class="faq-card">
                <h4 class="faq-q">Can I merge PDF files with different page orientations?</h4>
                <p class="faq-a">
                  Yes! PDF flow automatically detects and preserves portrait and landscape orientations, margins, embedded fonts, and page dimensions across all files.
                </p>
              </div>

              <div class="faq-card">
                <h4 class="faq-q">How many files can I merge at once?</h4>
                <p class="faq-a">
                  You can combine multiple PDF documents in a single operation. Because processing happens locally on your computer, performance is fast and unrestricted.
                </p>
              </div>

              <div class="faq-card">
                <h4 class="faq-q">Can I open files directly from Google Drive or Dropbox?</h4>
                <p class="faq-a">
                  Yes, simply click the Google Drive or Dropbox shortcut buttons next to the Select Files button to open your cloud storage in one click.
                </p>
              </div>
            </div>
          </div>

          <!-- MORE POPULAR TOOLS CROSS-LINKS -->
          <div class="related-tools-box">
            <h3 class="related-title">Explore more PDF tools</h3>
            <div class="related-tools-grid">
              <a routerLink="/split-pdf" class="related-card">
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="22" height="22" rx="5" fill="#E53238" />
                  <line x1="19" y1="19" x2="9" y2="9" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                  <polyline points="16 9 9 9 9 16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                  <line x1="29" y1="29" x2="39" y2="39" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                  <polyline points="32 39 39 39 39 32" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="related-info">
                  <h4>Split PDF</h4>
                  <p>Separate one page or whole sets</p>
                </div>
              </a>

              <a routerLink="/compress-pdf" class="related-card">
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="18" height="18" rx="4" fill="#10B981" />
                  <polyline points="10 16 16 16 16 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <rect x="26" y="4" width="18" height="18" rx="4" fill="#10B981" />
                  <polyline points="38 16 32 16 32 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <rect x="4" y="26" width="18" height="18" rx="4" fill="#10B981" />
                  <polyline points="10 32 16 32 16 38" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <rect x="26" y="26" width="18" height="18" rx="4" fill="#10B981" />
                  <polyline points="38 32 32 32 32 38" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="related-info">
                  <h4>Compress PDF</h4>
                  <p>Reduce file size while saving quality</p>
                </div>
              </a>

              <a routerLink="/pdf-to-word" class="related-card">
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                  <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <rect x="18" y="16" width="26" height="26" rx="6" fill="#2B579A" />
                  <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
                </svg>
                <div class="related-info">
                  <h4>PDF to Word</h4>
                  <p>Convert PDF to DOC & DOCX</p>
                </div>
              </a>

              <a routerLink="/protect-pdf" class="related-card">
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E3A8A" />
                  <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white"/>
                  <circle cx="24" cy="23" r="2.5" fill="#1E3A8A"/>
                </svg>
                <div class="related-info">
                  <h4>Protect PDF</h4>
                  <p>Encrypt with AES password security</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .tool-page {
      background: #f8fafc;
      min-height: 100vh;
    }

    /* HEADER SECTION */
    .tool-header-section {
      padding: 48px 0 28px;
      text-align: center;
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border);
    }
    .tool-header-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 820px;
      margin: 0 auto;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }
    .crumb-link {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s ease;
    }
    .crumb-link:hover {
      color: #E53238;
    }
    .crumb-sep {
      color: #cbd5e1;
    }
    .crumb-current {
      color: var(--text-main);
      font-weight: 700;
    }
    .hero-badge-wrap {
      margin-bottom: 14px;
      transition: transform 0.25s ease;
    }
    .hero-badge-wrap:hover {
      transform: scale(1.08);
    }
    .tool-h1 {
      font-size: clamp(34px, 4vw, 44px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--text-main);
      margin: 0 0 12px;
    }
    .tool-lead {
      font-size: 17px;
      color: var(--text-muted);
      line-height: 1.6;
      margin: 0 0 18px;
      max-width: 620px;
    }
    .privacy-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: #ecfdf5;
      color: #059669;
      font-size: 12.5px;
      font-weight: 600;
      border-radius: 9999px;
      border: 1px solid #a7f3d0;
    }

    /* ADSENSE PLACEHOLDER SLOTS */
    .adsense-section {
      padding: 24px 0 12px;
    }
    .adsense-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    .adsense-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .adsense-slot {
      width: 100%;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s ease;
    }
    .adsense-slot:hover {
      border-color: #94a3b8;
    }
    .adsense-leaderboard {
      min-height: 90px;
      max-width: 970px;
    }
    .adsense-mid-banner {
      min-height: 90px;
      max-width: 970px;
    }
    .adsense-placeholder-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
      padding: 16px;
    }

    /* WORKSPACE */
    .workspace-section {
      padding: 24px 0 48px;
    }
    .workspace-container {
      max-width: 1080px;
      margin: 0 auto;
    }
    .workspace-dropzone-wrapper {
      width: 100%;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: var(--radius-md);
      background-color: #fef2f2;
      color: #dc2626;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 24px;
      border: 1px solid #fecaca;
    }
    .error-close {
      margin-left: auto;
      font-weight: 700;
      color: #dc2626;
      padding: 4px;
      background: none;
      border: none;
      cursor: pointer;
    }

    /* ORGANIZE WORKSPACE */
    .workspace-controls-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .controls-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .files-summary {
      font-size: 15px;
      color: var(--text-main);
    }
    .add-more-btn {
      padding: 8px 16px;
      font-size: 13.5px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: var(--text-main);
      transition: all 0.2s ease;
    }
    .add-more-btn:hover {
      border-color: #E53238;
      color: #E53238;
    }
    .clear-btn {
      padding: 8px 16px;
      font-size: 13.5px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      cursor: pointer;
      color: #64748b;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    .clear-btn:hover {
      background: #fee2e2;
      border-color: #fca5a5;
      color: #dc2626;
    }
    
    /* FLOATING ACTION DOCK */
    .action-dock {
      position: sticky;
      bottom: 24px;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 18px 28px;
      margin-top: 32px;
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(229, 50, 56, 0.12);
    }
    .dock-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dock-pill {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #E53238;
    }
    .dock-note {
      font-size: 13.5px;
      color: var(--text-muted);
    }
    .merge-submit-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px 36px;
      font-size: 16px;
      font-weight: 700;
      border-radius: 12px;
      background: #E53238;
      color: #ffffff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(229, 50, 56, 0.35);
      transition: all 0.2s ease;
    }
    .merge-submit-btn:hover:not(:disabled) {
      background: #d3282e;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(229, 50, 56, 0.45);
    }
    .merge-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* FEATURES GRID */
    .features-section {
      padding: 56px 0;
      background: #ffffff;
      border-top: 1px solid var(--surface-border);
    }
    .section-heading {
      text-align: center;
      max-width: 720px;
      margin: 0 auto 48px;
    }
    .section-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
      margin: 0 0 10px;
    }
    .section-subtitle {
      font-size: 16px;
      color: var(--text-muted);
      margin: 0;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }
    .feature-card {
      display: flex;
      flex-direction: column;
      padding: 28px 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .feature-card:hover {
      border-color: #fca5a5;
      transform: translateY(-4px);
      box-shadow: 0 12px 24px -4px rgba(229, 50, 56, 0.1);
      background: #ffffff;
    }
    .feature-icon-badge {
      margin-bottom: 18px;
    }
    .feature-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0 0 8px;
    }
    .feature-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.6;
      margin: 0;
    }

    /* 3-STEP PROCESS GUIDE */
    .seo-guide-section {
      padding: 64px 0 56px;
      background: #ffffff;
      border-top: 1px solid var(--surface-border);
    }
    .guide-header {
      text-align: center;
      max-width: 680px;
      margin: 0 auto 48px;
    }
    .guide-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
      margin: 0 0 10px;
    }
    .guide-lead {
      font-size: 16px;
      color: var(--text-muted);
      margin: 0;
    }
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 28px;
      margin-bottom: 64px;
    }
    .step-card {
      display: flex;
      flex-direction: column;
      padding: 32px 28px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
    }
    .step-card:hover {
      border-color: #fca5a5;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
    }
    .step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #fee2e2;
      color: #E53238;
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 20px;
    }
    .step-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0 0 8px;
    }
    .step-desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      margin: 0;
    }

    /* FAQ */
    .tool-faqs {
      max-width: 900px;
      margin: 0 auto 64px;
    }
    .tool-faqs-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--text-main);
      text-align: center;
      margin-bottom: 32px;
      letter-spacing: -0.02em;
    }
    .tool-faqs-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .faq-card {
      padding: 24px 28px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      transition: all 0.2s ease;
    }
    .faq-card:hover {
      background: #ffffff;
      border-color: #cbd5e1;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    }
    .faq-q {
      font-size: 16.5px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }
    .faq-a {
      font-size: 14px;
      color: var(--text-muted);
      margin: 10px 0 0;
      line-height: 1.65;
    }

    /* RELATED TOOLS */
    .related-tools-box {
      max-width: 1080px;
      margin: 0 auto;
      border-top: 1px solid #e2e8f0;
      padding-top: 48px;
    }
    .related-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-main);
      margin: 0 0 24px;
      text-align: center;
    }
    .related-tools-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }
    .related-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .related-card:hover {
      border-color: #E53238;
      transform: translateY(-2px);
      box-shadow: 0 8px 18px rgba(229, 50, 56, 0.08);
    }
    .related-info h4 {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0 0 2px;
    }
    .related-info p {
      font-size: 12px;
      color: var(--text-muted);
      margin: 0;
    }

    @media (max-width: 1024px) {
      .features-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .related-tools-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .features-grid {
        grid-template-columns: 1fr;
      }
      .steps-grid {
        grid-template-columns: 1fr;
      }
      .related-tools-grid {
        grid-template-columns: 1fr;
      }
      .action-dock {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      .merge-submit-btn {
        width: 100%;
      }
    }
  `]
})
export class MergePdfComponent implements OnInit {
  private pdfService = inject(BrowserPdfService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);

  currentState = signal<WorkspaceState>('upload');
  selectedFiles = signal<ValidatedPdfFile[]>([]);
  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingMessage = signal<string>('');
  errorMessage = signal<string | null>(null);
  mergeResult = signal<MergeResult | null>(null);

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('merge-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  async onFilesAdded(files: File[]): Promise<void> {
    this.errorMessage.set(null);
    const validatedList: ValidatedPdfFile[] = [];

    for (const file of files) {
      const validated = await this.pdfService.validatePdf(file);
      validatedList.push(validated);
    }

    const current = this.selectedFiles();
    this.selectedFiles.set([...current, ...validatedList]);

    if (this.selectedFiles().length > 0) {
      this.currentState.set('organize');
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.onFilesAdded(files);
      input.value = '';
    }
  }

  onMoveUp(index: number): void {
    if (index <= 0) return;
    const list = [...this.selectedFiles()];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    this.selectedFiles.set(list);
  }

  onMoveDown(index: number): void {
    const list = [...this.selectedFiles()];
    if (index >= list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    this.selectedFiles.set(list);
  }

  onRemoveFile(index: number): void {
    const list = [...this.selectedFiles()];
    list.splice(index, 1);
    this.selectedFiles.set(list);

    if (list.length === 0) {
      this.currentState.set('upload');
    }
  }

  resetWorkspace(): void {
    const currentResult = this.mergeResult();
    if (currentResult?.url) {
      URL.revokeObjectURL(currentResult.url);
    }

    this.selectedFiles.set([]);
    this.mergeResult.set(null);
    this.errorMessage.set(null);
    this.processingProgress.set(0);
    this.currentState.set('upload');
  }

  async executeMerge(): Promise<void> {
    const validFiles = this.selectedFiles().filter((f) => f.isValid);
    if (validFiles.length < 2) {
      this.errorMessage.set('Please select at least 2 valid PDF documents to merge.');
      return;
    }

    this.isProcessing.set(true);
    this.currentState.set('processing');
    this.errorMessage.set(null);

    try {
      const rawFiles = validFiles.map((f) => f.file);
      const result = await this.pdfService.mergePdfs(rawFiles, (percent, msg) => {
        this.processingProgress.set(percent);
        this.processingMessage.set(msg);
      });

      this.mergeResult.set(result);
      this.currentState.set('completed');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while merging your PDF files.';
      this.errorMessage.set(message);
      this.currentState.set('organize');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
