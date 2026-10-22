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
    ProcessingStateComponent,
    ResultViewComponent
  ],
  template: `
    <div class="tool-page" [class.organize-mode]="currentState() === 'organize'">
      <!-- UPLOAD STATE: SEAMLESS UNIFIED HERO & DROPZONE (NOT TWO SECTIONS) -->
      @if (currentState() === 'upload') {
        <section class="unified-hero-section">
          <div class="container hero-content">
            <nav class="breadcrumbs" aria-label="Breadcrumb">
              <a routerLink="/" class="crumb-link">Home</a>
              <span class="crumb-sep">/</span>
              <span class="crumb-cat">Organize PDF</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-current">Merge PDF</span>
            </nav>

            <h1 class="tool-h1">Merge PDF files</h1>
            <p class="tool-lead">
              Combine PDFs in the order you want with the easiest PDF merger available.
            </p>

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

            <!-- UPLOADER COMPONENT -->
            <div class="hero-dropzone-wrap">
              <app-dropzone
                title="Select PDF files"
                subtitle="or drop PDFs here"
                acceptedTypes=".pdf,application/pdf"
                [multiple]="true"
                limitInfo=""
                (filesSelected)="onFilesAdded($event)"
              ></app-dropzone>
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

        <!-- FEATURES & VALUE PROPOSITION -->
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
                  Effortlessly reorder documents before merging. Drag and drop cards to arrange them in the exact order you need.
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
                  Drag and drop files to set the exact order or use the quick arrow buttons. Add more files anytime.
                </p>
              </div>

              <div class="step-card">
                <div class="step-num">03</div>
                <h3 class="step-title">Merge & download</h3>
                <p class="step-desc">
                  Click "Merge PDF". The browser combines all documents instantly with in-browser preview and instant download.
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
      }

      <!-- ORGANIZE STATE: EXACT LAYOUT FROM USER SCREENSHOT (CANVAS + RIGHT SIDEBAR) -->
      @if (currentState() === 'organize') {
        <div class="organize-workspace-screen">
          <!-- MAIN CANVAS AREA (Left/Center) -->
          <div class="canvas-main-area">
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

            <!-- CARDS GRID -->
            <div class="pdf-cards-canvas">
              @for (file of selectedFiles(); track file.id; let idx = $index; let first = $first; let last = $last) {
                <div
                  class="pdf-document-card"
                  draggable="true"
                  (dragstart)="onDragStart(idx)"
                  (dragover)="onDragOverCard($event, idx)"
                  (drop)="onDropCard($event, idx)"
                  title="Drag to reorder"
                >
                  <!-- Card Hover Controls -->
                  <div class="card-hover-actions">
                    <button
                      type="button"
                      class="card-action-btn delete-action"
                      (click)="onRemoveFile(idx)"
                      title="Remove file"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  <!-- Document Page Graphic / Thumbnail -->
                  <div class="doc-sheet-graphic">
                    <div class="doc-lines-sim">
                      <div class="sim-line title-bar"></div>
                      <div class="sim-line body-1"></div>
                      <div class="sim-line body-2"></div>
                      <div class="sim-line body-1"></div>
                      <div class="sim-line body-3"></div>
                      <div class="sim-line body-2"></div>
                      <div class="sim-line body-1"></div>
                    </div>
                  </div>

                  <!-- Filename Label at bottom -->
                  <div class="card-meta">
                    <span class="meta-filename" [title]="file.name">{{ file.name }}</span>
                    <span class="meta-pages">{{ file.pageCount }} {{ file.pageCount === 1 ? 'page' : 'pages' }}</span>
                  </div>

                  <!-- Order Switcher Arrows -->
                  <div class="card-reorder-pills">
                    <button
                      type="button"
                      class="pill-arrow-btn"
                      [disabled]="first"
                      (click)="onMoveUp(idx)"
                      title="Move left"
                    >
                      ‹
                    </button>
                    <span class="pill-order-num">{{ idx + 1 }}</span>
                    <button
                      type="button"
                      class="pill-arrow-btn"
                      [disabled]="last"
                      (click)="onMoveDown(idx)"
                      title="Move right"
                    >
                      ›
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- FLOATING RED ACTION BUTTONS (Exact 4 icons from screenshot) -->
            <div class="floating-tools-stack">
              <!-- 1. Add More Files (+ with black count badge) -->
              <div class="floating-btn-wrap">
                <button
                  type="button"
                  class="floating-circle-btn add-more-circle"
                  (click)="fileInput.click()"
                  title="Add more files"
                >
                  <span class="floating-count-badge">{{ selectedFiles().length }}</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <span class="floating-tooltip-label">Add more files</span>
              </div>

              <!-- 2. Computer / Laptop Upload -->
              <div class="floating-btn-wrap">
                <button
                  type="button"
                  class="floating-circle-btn pc-circle"
                  (click)="fileInput.click()"
                  title="Upload from computer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </button>
                <span class="floating-tooltip-label">Upload from PC</span>
              </div>

              <!-- 3. Google Drive -->
              <div class="floating-btn-wrap">
                <button
                  type="button"
                  class="floating-circle-btn drive-circle"
                  (click)="openGoogleDrive($event)"
                  title="Google Drive"
                >
                  <svg width="20" height="18" viewBox="0 0 24 21" fill="none">
                    <path d="M8.04 13.8L12.04 20.73H23.54L19.54 13.8H8.04Z" fill="#ffffff"/>
                    <path d="M15.96 0.27H4.46L0.46 7.2L6.21 17.16L10.21 10.23L15.96 0.27Z" fill="#ffffff" opacity="0.85"/>
                    <path d="M15.96 0.27L10.21 10.23L14.21 17.16L23.54 20.73L19.96 7.2L15.96 0.27Z" fill="#ffffff" opacity="0.7"/>
                  </svg>
                </button>
                <span class="floating-tooltip-label">Google Drive</span>
              </div>

              <!-- 4. Dropbox -->
              <div class="floating-btn-wrap">
                <button
                  type="button"
                  class="floating-circle-btn dropbox-circle"
                  (click)="openDropbox($event)"
                  title="Dropbox"
                >
                  <svg width="18" height="18" viewBox="0 0 24 22" fill="#ffffff">
                    <path d="M6 1.8L0 5.7L6 9.6L12 5.7L6 1.8ZM18 1.8L12 5.7L18 9.6L24 5.7L18 1.8ZM0 13.5L6 17.4L12 13.5L6 9.6L0 13.5ZM24 13.5L18 9.6L12 13.5L18 17.4L24 13.5ZM6 18.7L12 22.6L18 18.7L12 14.8L6 18.7Z"/>
                  </svg>
                </button>
                <span class="floating-tooltip-label">Dropbox</span>
              </div>

              <input
                #fileInput
                type="file"
                hidden
                multiple
                accept=".pdf,application/pdf"
                (change)="onFileInputChange($event)"
              />
            </div>
          </div>

          <!-- RIGHT SIDEBAR (Exact layout from user screenshot) -->
          <aside class="sidebar-action-panel">
            <div class="sidebar-body">
              <h2 class="sidebar-heading">Merge PDF</h2>

              <!-- Blue Info Callout (Exact text from screenshot) -->
              <div class="sidebar-info-banner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2.2" class="info-svg">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <div class="info-text">
                  @if (selectedFiles().length < 2) {
                    Please, select more PDF files by clicking again on 'Select PDF files'.
                    Select multiple files by maintaining pressed 'Ctrl'
                  } @else {
                    To reorder your files, drag and drop them or click the arrows below each card.
                    Files will merge in the exact sequence shown.
                  }
                </div>
              </div>

              <!-- Sidebar File Count & Clear -->
              <div class="sidebar-details-row">
                <span class="details-count">
                  <strong>{{ selectedFiles().length }}</strong> {{ selectedFiles().length === 1 ? 'file' : 'files' }} ready
                </span>
                <button type="button" class="sidebar-reset-link" (click)="resetWorkspace()">
                  Clear all
                </button>
              </div>

              <!-- Dedicated Sidebar AdSense Slot -->
              <div class="sidebar-adsense-slot">
                <span class="adsense-label">Advertisement</span>
                <div class="sidebar-ad-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.4">
                    <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  <span>Google AdSense (300 × 250)</span>
                </div>
              </div>
            </div>

            <!-- Giant Red Merge PDF Button Sticky Bottom -->
            <div class="sidebar-footer">
              <button
                type="button"
                class="giant-merge-submit-btn"
                [class.btn-disabled]="selectedFiles().length < 2 || isProcessing()"
                [disabled]="selectedFiles().length < 2 || isProcessing()"
                (click)="executeMerge()"
              >
                <span>Merge PDF</span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 16 16 12 12 8"></polyline>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </button>
            </div>
          </aside>
        </div>
      }

      <!-- PROCESSING STATE -->
      @if (currentState() === 'processing') {
        <div class="processing-workspace-screen">
          <app-processing-state
            title="Merging Documents..."
            [message]="processingMessage()"
            [percent]="processingProgress()"
          ></app-processing-state>
        </div>
      }

      <!-- COMPLETED RESULT STATE -->
      @if (currentState() === 'completed' && mergeResult()) {
        <div class="completed-workspace-screen">
          <div class="container result-container">
            <app-result-view
              [result]="mergeResult()!"
              (reset)="resetWorkspace()"
            ></app-result-view>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .tool-page {
      background: #f4f5f8;
      min-height: calc(100vh - 72px);
      display: flex;
      flex-direction: column;
    }
    .tool-page.organize-mode {
      background: #f4f5f8;
      overflow-x: hidden;
    }

    /* UPLOAD STATE: UNIFIED HERO (NOT TWO SECTIONS) */
    .unified-hero-section {
      padding: 56px 0 36px;
      text-align: center;
      background: #f4f5f8;
    }
    .hero-content {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      color: #64748b;
      margin-bottom: 24px;
    }
    .crumb-link {
      color: #64748b;
      text-decoration: none;
    }
    .crumb-link:hover {
      color: #E53238;
    }
    .crumb-sep {
      color: #cbd5e1;
    }
    .crumb-current {
      color: #0f172a;
      font-weight: 700;
    }
    .tool-h1 {
      font-size: clamp(38px, 4.5vw, 48px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #0f172a;
      margin: 0 0 12px;
    }
    .tool-lead {
      font-size: 18px;
      color: #475569;
      line-height: 1.5;
      margin: 0 0 32px;
      max-width: 660px;
    }
    .hero-dropzone-wrap {
      width: 100%;
      max-width: 680px;
    }

    /* ORGANIZE WORKSPACE SCREEN: CANVAS (LEFT) + SIDEBAR (RIGHT) */
    .organize-workspace-screen {
      display: flex;
      flex: 1;
      min-height: calc(100vh - 72px);
      width: 100%;
      background: #f4f5f8;
      position: relative;
    }

    /* MAIN CANVAS (Left/Center) */
    .canvas-main-area {
      flex: 1;
      padding: 40px 80px 40px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      min-height: 600px;
    }

    /* PDF CARDS CANVAS */
    .pdf-cards-canvas {
      display: flex;
      flex-wrap: wrap;
      gap: 28px;
      align-items: flex-start;
      justify-content: flex-start;
      width: 100%;
      max-width: 1100px;
    }

    /* INDIVIDUAL PDF DOCUMENT CARD (Exact matching user screenshot) */
    .pdf-document-card {
      width: 180px;
      height: 250px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.05);
      padding: 12px 10px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      position: relative;
      cursor: grab;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pdf-document-card:hover {
      border-color: #fca5a5;
      transform: translateY(-4px);
      box-shadow: 0 10px 24px -2px rgba(229, 50, 56, 0.12);
    }
    .pdf-document-card:active {
      cursor: grabbing;
    }

    /* Top right hover action */
    .card-hover-actions {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .pdf-document-card:hover .card-hover-actions {
      opacity: 1;
    }
    .card-action-btn {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #ef4444;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      transition: transform 0.15s ease;
    }
    .card-action-btn:hover {
      transform: scale(1.15);
    }

    /* Document Sheet Graphic */
    .doc-sheet-graphic {
      width: 110px;
      height: 145px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      border-radius: 4px;
      padding: 14px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      margin-top: 6px;
      position: relative;
    }
    .doc-lines-sim {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sim-line {
      height: 4px;
      background: #e2e8f0;
      border-radius: 2px;
    }
    .sim-line.title-bar {
      height: 6px;
      background: #94a3b8;
      width: 60%;
      margin-bottom: 4px;
    }
    .sim-line.body-1 { width: 90%; }
    .sim-line.body-2 { width: 100%; }
    .sim-line.body-3 { width: 75%; }

    /* Filename text */
    .card-meta {
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0 4px;
    }
    .meta-filename {
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .meta-pages {
      font-size: 11px;
      color: #94a3b8;
    }

    /* Reorder pill switcher */
    .card-reorder-pills {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      border-top: 1px solid #f1f5f9;
      padding-top: 6px;
    }
    .pill-arrow-btn {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      color: #64748b;
      font-size: 14px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pill-arrow-btn:hover:not(:disabled) {
      border-color: #E53238;
      color: #E53238;
    }
    .pill-arrow-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .pill-order-num {
      font-size: 11.5px;
      font-weight: 700;
      color: #64748b;
    }

    /* FLOATING RED TOOLS STACK (Right edge of canvas - Exact matching user screenshot) */
    .floating-tools-stack {
      position: absolute;
      top: 40px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      z-index: 20;
    }
    .floating-btn-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .floating-circle-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #E53238;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(229, 50, 56, 0.3);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .floating-circle-btn:hover {
      background: #d3282e;
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(229, 50, 56, 0.45);
    }
    .floating-circle-btn:hover + .floating-tooltip-label {
      opacity: 1;
      visibility: visible;
      transform: translateX(-8px);
    }

    /* Badge on '+' button */
    .floating-count-badge {
      position: absolute;
      top: -3px;
      right: -3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
    }

    /* Tooltip on hover (black pill) */
    .floating-tooltip-label {
      position: absolute;
      right: 52px;
      background: #1e293b;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      padding: 5px 10px;
      border-radius: 6px;
      opacity: 0;
      visibility: hidden;
      transform: translateX(0);
      transition: all 0.2s ease;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .floating-tooltip-label::after {
      content: '';
      position: absolute;
      top: 50%;
      right: -4px;
      transform: translateY(-50%);
      border-width: 4px 0 4px 4px;
      border-style: solid;
      border-color: transparent transparent transparent #1e293b;
    }

    /* RIGHT SIDEBAR (Exact layout from user screenshot) */
    .sidebar-action-panel {
      width: 350px;
      background: #ffffff;
      border-left: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: calc(100vh - 72px);
      box-shadow: -4px 0 16px rgba(0, 0, 0, 0.03);
      position: sticky;
      top: 72px;
    }
    .sidebar-body {
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .sidebar-heading {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin: 0;
    }

    /* Blue Alert Info Box (Exact matching user screenshot) */
    .sidebar-info-banner {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .info-svg {
      flex-shrink: 0;
      margin-top: 1px;
    }
    .info-text {
      font-size: 13px;
      color: #0369a1;
      line-height: 1.5;
    }

    /* Details row */
    .sidebar-details-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .details-count {
      font-size: 13.5px;
      color: #334155;
    }
    .sidebar-reset-link {
      background: none;
      border: none;
      font-size: 12.5px;
      font-weight: 600;
      color: #ef4444;
      cursor: pointer;
    }
    .sidebar-reset-link:hover {
      text-decoration: underline;
    }

    /* Sidebar AdSense */
    .sidebar-adsense-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 8px;
    }
    .sidebar-ad-box {
      width: 100%;
      height: 250px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 12.5px;
      color: #94a3b8;
      font-weight: 500;
    }

    /* Sticky Bottom Merge Button */
    .sidebar-footer {
      padding: 20px 24px;
      border-top: 1px solid #f1f5f9;
      background: #ffffff;
    }
    .giant-merge-submit-btn {
      width: 100%;
      height: 64px;
      border-radius: 10px;
      background: #E53238;
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(229, 50, 56, 0.35);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .giant-merge-submit-btn:hover:not(.btn-disabled) {
      background: #d3282e;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(229, 50, 56, 0.45);
    }
    .giant-merge-submit-btn.btn-disabled {
      background: #f87171;
      opacity: 0.65;
      cursor: not-allowed;
      box-shadow: none;
    }

    /* ADSENSE COMMON STYLES */
    .adsense-section {
      padding: 24px 0 12px;
      background: #ffffff;
      border-top: 1px solid var(--surface-border);
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
      background: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .adsense-leaderboard {
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

    /* ERROR BANNER */
    .error-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      border-radius: 8px;
      background-color: #fef2f2;
      color: #dc2626;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
      border: 1px solid #fecaca;
      width: 100%;
      max-width: 800px;
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

    /* FEATURES GRID */
    .features-section {
      padding: 64px 0;
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

    /* 3-STEP GUIDE */
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

    /* PROCESSING & COMPLETED SCREENS */
    .processing-workspace-screen,
    .completed-workspace-screen {
      padding: 60px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
    }
    .result-container {
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 1024px) {
      .organize-workspace-screen {
        flex-direction: column;
      }
      .sidebar-action-panel {
        width: 100%;
        min-height: auto;
        position: static;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04);
      }
      .canvas-main-area {
        padding: 32px 20px 80px;
      }
      .floating-tools-stack {
        top: auto;
        bottom: 20px;
        right: 20px;
        flex-direction: row;
      }
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
  draggedIdx: number | null = null;

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

  onDragStart(index: number): void {
    this.draggedIdx = index;
  }

  onDragOverCard(event: DragEvent, index: number): void {
    event.preventDefault();
  }

  onDropCard(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.draggedIdx === null || this.draggedIdx === index) return;
    const list = [...this.selectedFiles()];
    const item = list.splice(this.draggedIdx, 1)[0];
    list.splice(index, 0, item);
    this.selectedFiles.set(list);
    this.draggedIdx = null;
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
