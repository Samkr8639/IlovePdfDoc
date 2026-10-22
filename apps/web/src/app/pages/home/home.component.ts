import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { ToolCategory } from '@paperflow/contracts';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule],
  template: `
    <div class="home-page">
      <!-- HERO SECTION -->
      <section class="hero-section">
        <div class="hero-ambient-spotlight"></div>
        <div class="hero-ambient-spotlight-2"></div>
        <div class="container hero-container">
          <div class="badge-privacy hero-badge">
            <span>100% In-Browser Privacy • Zero Server Uploads</span>
          </div>

          <h1 class="hero-title">
            Every tool you need to work with <br/>
            <span class="gradient-text">PDF documents</span>, in one place.
          </h1>

          <p class="hero-subtitle">
            Merge, split, rotate, and manage documents right inside your browser memory.
            Zero network upload lag, no account required, completely free.
          </p>

          <div class="hero-cta-group">
            <a routerLink="/merge-pdf" class="btn-primary hero-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>Merge PDFs (Private)</span>
            </a>

            <a routerLink="/split-pdf" class="btn-secondary hero-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
              </svg>
              <span>Split PDF</span>
            </a>
          </div>

          <!-- DRIBBLE-INSPIRED LIVE SAAS WORKSPACE SHOWCASE -->
          <div class="hero-showcase-window">
            <div class="showcase-chrome">
              <div class="chrome-dots">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
              </div>
              <div class="chrome-address">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>paperflow.app // client-sandbox-isolated</span>
              </div>
              <div class="chrome-status">
                <span class="status-live-dot"></span>
                <span>WASM 0ms Upload</span>
              </div>
            </div>

            <div class="showcase-content">
              <!-- Left side: Drop mockup -->
              <a routerLink="/merge-pdf" class="showcase-drop-mockup">
                <div class="mockup-drop-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div class="mockup-drop-text">
                  <strong class="mockup-title">Drop PDF documents here</strong>
                  <span class="mockup-sub">or click to open in-browser workspace</span>
                </div>
                <div class="mockup-pill-formats">
                  <span>.PDF</span>
                  <span>.PNG</span>
                  <span>.JPG</span>
                </div>
              </a>

              <!-- Right side: Queued documents pipeline -->
              <div class="showcase-pipeline">
                <div class="pipeline-header">
                  <span class="pipeline-title">Active Memory Buffer</span>
                  <span class="pipeline-badge">3 Documents Queued</span>
                </div>

                <div class="pipeline-cards">
                  <div class="pipeline-card">
                    <div class="file-chip chip-pdf">PDF</div>
                    <div class="file-meta">
                      <span class="file-name">annual_financial_report_2026.pdf</span>
                      <span class="file-sub">3.4 MB • 42 pages</span>
                    </div>
                    <span class="file-pill pill-emerald">Ready in RAM</span>
                  </div>

                  <div class="pipeline-card">
                    <div class="file-chip chip-pdf">PDF</div>
                    <div class="file-meta">
                      <span class="file-name">q3_executive_summary.pdf</span>
                      <span class="file-sub">1.8 MB • 14 pages</span>
                    </div>
                    <span class="file-pill pill-emerald">Ready in RAM</span>
                  </div>

                  <div class="pipeline-card">
                    <div class="file-chip chip-blue">DOC</div>
                    <div class="file-meta">
                      <span class="file-name">compliance_audit_appendix.pdf</span>
                      <span class="file-sub">4.1 MB • 28 pages</span>
                    </div>
                    <span class="file-pill pill-blue">Zero Upload</span>
                  </div>
                </div>

                <div class="pipeline-footer">
                  <span class="pipeline-total">Total: 9.3 MB • 84 Pages</span>
                  <a routerLink="/merge-pdf" class="pipeline-cta">
                    <span>Merge Instantly</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- TRUST METRICS STRIP -->
          <div class="trust-strip">
            <div class="trust-item">
              <span class="trust-check">✓</span>
              <span>100% Client-Side WebAssembly</span>
            </div>
            <div class="trust-sep">•</div>
            <div class="trust-item">
              <span class="trust-check">✓</span>
              <span>No File Size Restrictions</span>
            </div>
            <div class="trust-sep">•</div>
            <div class="trust-item">
              <span class="trust-check">✓</span>
              <span>No Registration or Credit Card</span>
            </div>
          </div>
        </div>
      </section>

      <!-- TOOLS EXPLORATION SECTION -->
      <section class="tools-section">
        <div class="container">
          <!-- SEARCH & FILTER BAR -->
          <div class="filter-bar">
            <div class="category-tabs">
              <button
                type="button"
                class="tab-btn"
                [class.active]="toolRegistry.selectedCategory() === 'all'"
                (click)="setCategory('all')"
              >
                All Tools
                <span class="tab-count">{{ toolRegistry.allTools().length }}</span>
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="toolRegistry.selectedCategory() === 'organize'"
                (click)="setCategory('organize')"
              >
                Organize
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="toolRegistry.selectedCategory() === 'convert'"
                (click)="setCategory('convert')"
              >
                Convert
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="toolRegistry.selectedCategory() === 'optimize'"
                (click)="setCategory('optimize')"
              >
                Optimize
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="toolRegistry.selectedCategory() === 'security'"
                (click)="setCategory('security')"
              >
                Security
              </button>
            </div>

            <div class="search-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                class="search-input"
                placeholder="Search tools (e.g. merge, split, rotate)..."
                [ngModel]="toolRegistry.searchQuery()"
                (ngModelChange)="onSearchChange($event)"
              />
            </div>
          </div>

          <!-- TOOLS GRID -->
          <div class="tools-grid">
            @for (tool of toolRegistry.filteredTools(); track tool.id) {
              <a [routerLink]="tool.route" class="tool-card card-clean">
                <div class="card-ambient-highlight"></div>
                <div class="tool-card-top">
                  <div class="tool-icon-wrapper" [class]="'icon-' + tool.id">
                    @switch (tool.icon) {
                      @case ('layers') {
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                          <polyline points="2 17 12 22 22 17"></polyline>
                          <polyline points="2 12 12 17 22 12"></polyline>
                        </svg>
                      }
                      @case ('scissors') {
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="6" cy="6" r="3"></circle>
                          <circle cx="6" cy="18" r="3"></circle>
                          <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                          <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                          <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                        </svg>
                      }
                      @case ('rotate-cw') {
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="23 4 23 10 17 10"></polyline>
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                      }
                      @case ('image') {
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      }
                      @case ('minimize-2') {
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="4 14 10 14 10 20"></polyline>
                          <polyline points="20 10 14 10 14 4"></polyline>
                          <line x1="14" y1="10" x2="21" y2="3"></line>
                          <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                      }
                      @case ('lock') {
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      }
                      @default {
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      }
                    }
                  </div>

                  <span class="badge-tag" [class.badge-active]="tool.status === 'available'">
                    {{ tool.badgeText || tool.status }}
                  </span>
                </div>

                <div class="tool-info">
                  <h3 class="tool-name">{{ tool.name }}</h3>
                  <p class="tool-desc">{{ tool.shortDescription }}</p>
                </div>

                <div class="tool-card-footer">
                  <span class="open-link">
                    Open Tool
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                </div>
              </a>
            }
          </div>
        </div>
      </section>

      <!-- WHY PAPERFLOW / ARCHITECTURE SECTION -->
      <section class="trust-section">
        <div class="container">
          <div class="section-header">
            <span class="badge-tag">Privacy-First Architecture</span>
            <h2 class="section-title">Engineered for Document Security and Raw Speed</h2>
            <p class="section-subtitle">How client-side execution transforms online PDF productivity.</p>
          </div>

          <div class="trust-grid">
            <div class="trust-card card-clean">
              <div class="trust-icon-box bg-emerald">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3 class="trust-title">100% In-Browser Privacy</h3>
              <p class="trust-desc">
                Your PDF files never leave your device. All parsing, copying, and generation happens in your computer's RAM using pure client-side WebAssembly.
              </p>
            </div>

            <div class="trust-card card-clean">
              <div class="trust-icon-box bg-blue">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <h3 class="trust-title">Zero Upload Latency</h3>
              <p class="trust-desc">
                No slow uploading of 50MB files to a distant cloud server. Processing begins instantly and completes in sub-seconds.
              </p>
            </div>

            <div class="trust-card card-clean">
              <div class="trust-icon-box bg-indigo">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <line x1="6" y1="12" x2="18" y2="12"></line>
                </svg>
              </div>
              <h3 class="trust-title">Completely Free Forever</h3>
              <p class="trust-desc">
                No credit cards, no premium subscriptions, and no trial limits. All essential tools are free for personal and commercial use.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ SECTION -->
      <section class="faq-section">
        <div class="container faq-container">
          <div class="section-header">
            <h2 class="section-title">Frequently Asked Questions</h2>
            <p class="section-subtitle">Straightforward answers about our security and technology.</p>
          </div>

          <div class="faq-list">
            <div class="faq-item card-clean">
              <h4 class="faq-q">How does in-browser PDF processing work?</h4>
              <p class="faq-a">
                PaperFlow utilizes WebAssembly and pdf-lib compiled directly to JavaScript. When you select a PDF, your web browser parses the binary PDF tree in local sandboxed memory. No network requests are sent to our backend.
              </p>
            </div>

            <div class="faq-item card-clean">
              <h4 class="faq-q">Are there any restrictions on file size or document count?</h4>
              <p class="faq-a">
                You can combine up to 30 PDF documents at once, with individual file sizes up to 50MB, without any fee or subscription.
              </p>
            </div>

            <div class="faq-item card-clean">
              <h4 class="faq-q">Is PaperFlow open source?</h4>
              <p class="faq-a">
                Yes! The entire code is open-source and hosted on GitHub under the MIT License.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-page {
      position: relative;
    }
    .hero-section {
      position: relative;
      padding: 72px 0 60px;
      text-align: center;
      overflow: hidden;
    }
    .hero-ambient-spotlight {
      position: absolute;
      top: -140px;
      left: 50%;
      transform: translateX(-50%);
      width: 900px;
      height: 520px;
      background: radial-gradient(ellipse at center, rgba(37, 99, 235, 0.16) 0%, rgba(124, 58, 237, 0.08) 50%, transparent 70%);
      pointer-events: none;
      filter: blur(50px);
    }
    .hero-ambient-spotlight-2 {
      position: absolute;
      top: 180px;
      right: 15%;
      width: 480px;
      height: 380px;
      background: radial-gradient(ellipse at center, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
      pointer-events: none;
      filter: blur(60px);
    }
    .hero-container {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 980px;
    }
    .hero-badge {
      margin-bottom: 24px;
    }
    .hero-title {
      font-size: clamp(34px, 5.2vw, 58px);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.035em;
      color: var(--text-main);
    }
    .gradient-text {
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: clamp(16px, 2.2vw, 19px);
      color: var(--text-muted);
      margin-top: 20px;
      line-height: 1.6;
      max-width: 680px;
      font-weight: 500;
    }
    .hero-cta-group {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 32px;
    }
    .hero-btn {
      padding: 14px 34px;
      font-size: 16px;
    }

    /* DRIBBLE SAAS WORKSPACE SHOWCASE WINDOW */
    .hero-showcase-window {
      width: 100%;
      margin-top: 48px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: var(--radius-2xl);
      box-shadow: 0 30px 60px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(37, 99, 235, 0.08);
      overflow: hidden;
      text-align: left;
      transition: all 0.3s ease;
    }
    .hero-showcase-window:hover {
      box-shadow: 0 35px 70px -15px rgba(37, 99, 235, 0.16), 0 0 0 1px rgba(37, 99, 235, 0.15);
    }
    .showcase-chrome {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: #f8fafc;
      border-bottom: 1px solid var(--surface-border);
    }
    .chrome-dots {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }
    .chrome-address {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      background: #ffffff;
      padding: 4px 14px;
      border-radius: 9999px;
      border: 1px solid var(--surface-border);
    }
    .chrome-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: var(--emerald-700);
    }
    .status-live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--emerald-500);
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
    }
    .showcase-content {
      display: grid;
      grid-template-columns: 1fr 1.35fr;
      gap: 24px;
      padding: 28px;
    }
    .showcase-drop-mockup {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      border: 2px dashed #cbd5e1;
      border-radius: var(--radius-xl);
      padding: 32px 20px;
      background: #f8fafc;
      transition: all 0.25s ease;
      cursor: pointer;
    }
    .showcase-drop-mockup:hover {
      border-color: var(--primary-500);
      background: var(--primary-50);
      transform: scale(1.01);
    }
    .mockup-drop-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: #ffffff;
      color: var(--primary-600);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-sm);
      margin-bottom: 14px;
    }
    .mockup-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
    }
    .mockup-sub {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .mockup-pill-formats {
      display: flex;
      gap: 6px;
      margin-top: 14px;
    }
    .mockup-pill-formats span {
      font-size: 11px;
      font-weight: 700;
      background: #ffffff;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--surface-border);
      color: var(--text-muted);
    }

    /* PIPELINE QUEUE SHOWCASE */
    .showcase-pipeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-xl);
      padding: 20px;
    }
    .pipeline-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--surface-border-subtle);
    }
    .pipeline-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pipeline-badge {
      font-size: 11px;
      font-weight: 700;
      background: var(--primary-50);
      color: var(--primary-600);
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .pipeline-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pipeline-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
    }
    .pipeline-card:hover {
      background: #ffffff;
      border-color: var(--primary-300);
      box-shadow: var(--shadow-sm);
    }
    .file-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 800;
      color: #ffffff;
    }
    .chip-pdf {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    .chip-blue {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    .file-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .file-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .file-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
    }
    .pill-emerald {
      background: var(--emerald-50);
      color: var(--emerald-700);
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .pill-blue {
      background: var(--primary-50);
      color: var(--primary-700);
      border: 1px solid rgba(37, 99, 235, 0.25);
    }
    .pipeline-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--surface-border-subtle);
    }
    .pipeline-total {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .pipeline-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: var(--primary-600);
      transition: gap 0.2s ease;
    }
    .pipeline-cta:hover {
      gap: 9px;
      color: var(--primary-700);
    }

    .trust-strip {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 36px;
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 600;
      flex-wrap: wrap;
      justify-content: center;
    }
    .trust-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .trust-check {
      color: var(--emerald-600);
      font-weight: 800;
    }
    .trust-sep {
      color: var(--text-light);
    }

    /* TOOLS SECTION */
    .tools-section {
      padding: 56px 0 80px;
    }
    .filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 40px;
      flex-wrap: wrap;
    }
    .category-tabs {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(16px);
      padding: 5px;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
    }
    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      transition: all 0.2s ease;
    }
    .tab-btn:hover {
      color: var(--text-main);
    }
    .tab-btn.active {
      background: var(--primary-50);
      color: var(--primary-600);
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.1);
    }
    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: var(--primary-600);
      color: #ffffff;
      width: 18px;
      height: 18px;
      border-radius: 50%;
    }
    .search-box {
      position: relative;
      flex: 1;
      max-width: 380px;
    }
    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-light);
    }
    .search-input {
      width: 100%;
      height: 44px;
      padding: 0 16px 0 42px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
      font-family: inherit;
      font-size: 14px;
      color: var(--text-main);
      outline: none;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }
    .search-input:focus {
      border-color: var(--primary-500);
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
    }

    /* TOOLS GRID */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 26px;
    }
    .tool-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 240px;
      text-decoration: none;
      overflow: hidden;
    }
    .card-ambient-highlight {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.4), transparent);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .tool-card:hover .card-ambient-highlight {
      opacity: 1;
    }
    .tool-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    /* BESPOKE DRIBBLE SQUIRCLE ICON BADGES */
    .tool-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      color: #ffffff;
      box-shadow: 0 8px 16px -4px rgba(15, 23, 42, 0.12);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .tool-card:hover .tool-icon-wrapper {
      transform: scale(1.1) translateY(-2px);
    }
    .icon-merge-pdf {
      background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
      box-shadow: 0 8px 20px -4px rgba(239, 68, 68, 0.35);
    }
    .icon-split-pdf {
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.35);
    }
    .icon-rotate-pdf {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 8px 20px -4px rgba(245, 158, 11, 0.35);
    }
    .icon-images-to-pdf {
      background: linear-gradient(135deg, #06b6d4 0%, #2563eb 100%);
      box-shadow: 0 8px 20px -4px rgba(6, 182, 212, 0.35);
    }
    .icon-compress-pdf {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 8px 20px -4px rgba(16, 185, 129, 0.35);
    }
    .icon-protect-pdf {
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
      box-shadow: 0 8px 20px -4px rgba(244, 63, 94, 0.35);
    }

    .badge-active {
      background: var(--emerald-50);
      color: var(--emerald-700);
      border-color: rgba(16, 185, 129, 0.25);
    }
    .tool-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.015em;
      color: var(--text-main);
      margin-top: 18px;
    }
    .tool-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      margin-top: 6px;
      line-height: 1.5;
    }
    .tool-card-footer {
      margin-top: auto;
      padding-top: 14px;
    }
    .open-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: var(--primary-600);
      transition: gap 0.2s ease;
    }
    .arrow-icon {
      transition: transform 0.2s ease;
    }
    .tool-card:hover .arrow-icon {
      transform: translateX(4px);
    }

    /* TRUST SECTION */
    .trust-section {
      padding: 76px 0;
      background: #ffffff;
      border-top: 1px solid var(--surface-border);
      border-bottom: 1px solid var(--surface-border);
    }
    .section-header {
      text-align: center;
      margin-bottom: 54px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .section-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--text-main);
    }
    .section-subtitle {
      font-size: 16px;
      color: var(--text-muted);
    }
    .trust-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 26px;
    }
    .trust-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 34px 28px;
    }
    .trust-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 54px;
      height: 54px;
      border-radius: 16px;
      color: #ffffff;
      box-shadow: var(--shadow-sm);
    }
    .bg-emerald {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      box-shadow: 0 8px 20px -4px rgba(16, 185, 129, 0.35);
    }
    .bg-blue {
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.35);
    }
    .bg-indigo {
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.35);
    }
    .trust-title {
      font-size: 19px;
      font-weight: 700;
      color: var(--text-main);
    }
    .trust-desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* FAQ */
    .faq-section {
      padding: 76px 0 36px;
    }
    .faq-container {
      max-width: 860px;
    }
    .faq-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .faq-item {
      padding: 26px 30px;
    }
    .faq-q {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-main);
    }
    .faq-a {
      font-size: 14.5px;
      color: var(--text-muted);
      margin-top: 8px;
      line-height: 1.65;
    }

    @media (max-width: 920px) {
      .showcase-content {
        grid-template-columns: 1fr;
      }
      .trust-grid {
        grid-template-columns: 1fr;
      }
      .filter-bar {
        flex-direction: column;
        align-items: stretch;
      }
      .search-box {
        max-width: 100%;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private router = inject(Router);

  ngOnInit(): void {
    this.seo.setDefaultSeo();
  }

  setCategory(cat: ToolCategory | 'all'): void {
    this.toolRegistry.setCategory(cat);
  }

  onSearchChange(query: string): void {
    this.toolRegistry.setSearchQuery(query);
  }
}
