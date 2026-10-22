import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { ToolCategory } from '@paperflow/contracts';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule],
  template: `
    <div class="home-page">
      <!-- MAIN HERO: DRIBBLE POPULAR SERVICES -->
      <section class="popular-section">
        <div class="container popular-container">
          <!-- SECTION TITLE -->
          <h1 class="popular-title">POPULAR SERVICES</h1>

          <!-- 3x2 SERVICE CARDS GRID -->
          <div class="popular-grid">
            <!-- 1. PDF to Word -->
            <a routerLink="/merge-pdf" class="popular-card card-active">
              <div class="card-format-row">
                <span class="format-pill pill-red">PDF</span>
                <span class="format-arrow">→</span>
                <span class="format-pill pill-blue">W</span>
              </div>
              <h3 class="card-title">PDF to Word</h3>
            </a>

            <!-- 2. Word to PDF -->
            <a routerLink="/merge-pdf" class="popular-card">
              <div class="card-format-row">
                <span class="format-pill pill-blue">W</span>
                <span class="format-arrow">→</span>
                <span class="format-pill pill-red">PDF</span>
              </div>
              <h3 class="card-title">Word to PDF</h3>
            </a>

            <!-- 3. JPG to PDF -->
            <a routerLink="/images-to-pdf" class="popular-card">
              <div class="card-format-row">
                <span class="format-pill pill-purple">JPG</span>
                <span class="format-arrow">→</span>
                <span class="format-pill pill-red">PDF</span>
              </div>
              <h3 class="card-title">JPG to PDF</h3>
            </a>

            <!-- 4. Merge PDF -->
            <a routerLink="/merge-pdf" class="popular-card">
              <div class="card-format-row">
                <div class="single-icon-chip icon-merge">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="18" r="3"></circle>
                    <circle cx="6" cy="6" r="3"></circle>
                    <path d="M6 9v12"></path>
                    <path d="M18 9a9 9 0 0 1-9 9"></path>
                  </svg>
                </div>
              </div>
              <h3 class="card-title">Merge PDF</h3>
            </a>

            <!-- 5. Compress PDF -->
            <a routerLink="/compress-pdf" class="popular-card">
              <div class="card-format-row">
                <div class="single-icon-chip icon-compress">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="4 14 10 14 10 20"></polyline>
                    <polyline points="20 10 14 10 14 4"></polyline>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                </div>
              </div>
              <h3 class="card-title">Compress PDF</h3>
            </a>

            <!-- 6. Protect PDF -->
            <a routerLink="/protect-pdf" class="popular-card">
              <div class="card-format-row">
                <div class="single-icon-chip icon-protect">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              </div>
              <h3 class="card-title">Protect PDF</h3>
            </a>
          </div>

          <!-- 3-STEP PROCESS GUIDE -->
          <div class="steps-row">
            <div class="step-col">
              <span class="step-badge">01</span>
              <h4 class="step-head">Choose the service</h4>
              <p class="step-text">
                Choose from the popular services, or see all available options below or in the menu.
              </p>
            </div>

            <div class="step-col">
              <span class="step-badge">02</span>
              <h4 class="step-head">Upload document</h4>
              <p class="step-text">
                Upload document which you want to transform. All your data is saved and securely processed in-browser. Check Privacy Policy for more details.
              </p>
            </div>

            <div class="step-col">
              <span class="step-badge">03</span>
              <h4 class="step-head">Preview & download</h4>
              <p class="step-text">
                Review the preview. If everything looks correct, download your updated document. Fast, private, and always available.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ALL TOOLS DIRECTORY SECTION -->
      <section class="tools-directory-section">
        <div class="container">
          <div class="directory-header">
            <h2 class="directory-title">All PDF Tools</h2>
            <p class="directory-subtitle">Complete suite of private, client-side document utilities</p>
          </div>

          <!-- FILTER TABS & SEARCH -->
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
                <div class="tool-card-top">
                  <div class="tool-icon-chip" [class]="'icon-' + tool.id">
                    @switch (tool.icon) {
                      @case ('layers') {
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                          <polyline points="2 17 12 22 22 17"></polyline>
                          <polyline points="2 12 12 17 22 12"></polyline>
                        </svg>
                      }
                      @case ('scissors') {
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="6" cy="6" r="3"></circle>
                          <circle cx="6" cy="18" r="3"></circle>
                          <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                          <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                          <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                        </svg>
                      }
                      @case ('rotate-cw') {
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="23 4 23 10 17 10"></polyline>
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                      }
                      @case ('minimize-2') {
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="4 14 10 14 10 20"></polyline>
                          <polyline points="20 10 14 10 14 4"></polyline>
                          <line x1="14" y1="10" x2="21" y2="3"></line>
                          <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                      }
                      @case ('image') {
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      }
                      @case ('lock') {
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      }
                      @default {
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      }
                    }
                  </div>
                  <span class="tool-tag">{{ tool.category }}</span>
                </div>

                <div class="tool-card-body">
                  <h3 class="tool-name">{{ tool.name }}</h3>
                  <p class="tool-desc">{{ tool.shortDescription }}</p>
                </div>

                <div class="tool-card-footer">
                  <span class="tool-badge-wasm">In-Browser</span>
                  <div class="tool-cta-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                </div>
              </a>
            }
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-page {
      padding-bottom: 72px;
    }

    /* DRIBBLE POPULAR SERVICES SECTION */
    .popular-section {
      padding: 56px 0 64px;
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border);
    }
    .popular-container {
      max-width: 960px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .popular-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: var(--text-main);
      font-family: var(--font-display);
      text-transform: uppercase;
      margin-bottom: 36px;
      text-align: center;
    }

    /* 3x2 CARDS GRID */
    .popular-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      width: 100%;
      margin-bottom: 56px;
    }
    .popular-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 140px;
      padding: 24px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-xl);
      text-decoration: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .popular-card:hover {
      background: var(--coral-100);
      border-color: var(--coral-400);
      transform: translateY(-2px);
      box-shadow: 0 12px 24px -4px rgba(229, 57, 53, 0.12);
    }
    .popular-card.card-active {
      background: var(--coral-100);
      border-color: var(--coral-400);
    }

    /* FORMAT TRANSITION PILLS */
    .card-format-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .format-pill {
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      color: #ffffff;
      line-height: 1;
    }
    .pill-red { background: var(--coral-600); }
    .pill-blue { background: #2563eb; }
    .pill-purple { background: #7c3aed; }
    .format-arrow {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
    }
    .single-icon-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    .icon-merge { color: var(--coral-600); background: var(--coral-50); }
    .icon-compress { color: #f97316; background: #fff7ed; }
    .icon-protect { color: #16a34a; background: #f0fdf4; }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }

    /* 3-STEP PROCESS ROW */
    .steps-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      width: 100%;
      border-top: 1px solid var(--surface-border);
      padding-top: 40px;
    }
    .step-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .step-badge {
      font-size: 14px;
      font-weight: 800;
      color: var(--coral-600);
      font-family: var(--font-display);
    }
    .step-head {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }
    .step-text {
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-muted);
      margin: 0;
    }

    /* DIRECTORY SECTION */
    .tools-directory-section {
      padding: 64px 0;
    }
    .directory-header {
      text-align: center;
      margin-bottom: 36px;
    }
    .directory-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text-main);
      font-family: var(--font-display);
      letter-spacing: -0.02em;
    }
    .directory-subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 32px;
      flex-wrap: wrap;
    }
    .category-tabs {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      padding: 5px;
      border-radius: 9999px;
      border: 1px solid var(--surface-border);
    }
    .tab-btn {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      border-radius: 9999px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tab-btn:hover {
      color: var(--text-main);
    }
    .tab-btn.active {
      color: #ffffff;
      background: var(--coral-600);
      box-shadow: 0 2px 8px rgba(229, 57, 53, 0.3);
    }
    .tab-count {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.08);
    }
    .tab-btn.active .tab-count {
      background: rgba(255, 255, 255, 0.25);
    }

    .search-box {
      position: relative;
      min-width: 280px;
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
      padding: 10px 16px 10px 40px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: 9999px;
      font-size: 13px;
      color: var(--text-main);
      outline: none;
      transition: all 0.2s ease;
    }
    .search-input:focus {
      border-color: var(--coral-400);
      box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.1);
    }

    /* TOOLS GRID */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .tool-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      text-decoration: none;
    }
    .tool-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tool-icon-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--coral-50);
      color: var(--coral-600);
    }
    .tool-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-light);
    }
    .tool-card-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tool-name {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }
    .tool-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      margin: 0;
    }
    .tool-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--surface-border-subtle);
    }
    .tool-badge-wasm {
      font-size: 11px;
      font-weight: 700;
      color: var(--emerald-700);
      background: var(--emerald-50);
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .tool-cta-arrow {
      color: var(--text-light);
      transition: all 0.2s ease;
    }
    .tool-card:hover .tool-cta-arrow {
      color: var(--coral-600);
      transform: translateX(3px);
    }

    @media (max-width: 768px) {
      .popular-grid {
        grid-template-columns: 1fr;
      }
      .steps-row {
        grid-template-columns: 1fr;
        gap: 24px;
      }
      .filter-bar {
        flex-direction: column;
        align-items: stretch;
      }
      .category-tabs {
        overflow-x: auto;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'PDF flow - Free & Private Online PDF Toolkit',
      description: 'Merge, split, rotate, and manage PDF documents directly in your browser with zero server uploads.',
      keywords: ['pdf tools', 'merge pdf', 'split pdf', 'rotate pdf', 'pdf to word', 'dribbble pdf converter'],
      canonical: 'https://pdfflow.app',
      faqs: []
    });
  }

  setCategory(category: ToolCategory | 'all'): void {
    this.toolRegistry.setCategory(category);
  }

  onSearchChange(query: string): void {
    this.toolRegistry.setSearchQuery(query);
  }
}
