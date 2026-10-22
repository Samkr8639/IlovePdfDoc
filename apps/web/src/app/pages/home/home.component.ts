import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { ToolCategory } from '@paperflow/contracts';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="home-page">
      <!-- HERO SECTION -->
      <section class="hero-section">
        <div class="container hero-container">
          <div class="badge-privacy hero-badge">
            <span>100% Private • In-Browser Processing</span>
          </div>

          <h1 class="hero-title">
            Every tool you need to work with <span class="gradient-text">PDFs</span>, in one place.
          </h1>

          <p class="hero-subtitle">
            Merge, split, rotate, and manage documents right inside your browser memory.
            Zero file uploads, no account required, completely free.
          </p>

          <div class="hero-cta-group">
            <a routerLink="/merge-pdf" class="btn-primary hero-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>Merge PDFs Now</span>
            </a>

            <a routerLink="/split-pdf" class="btn-secondary hero-btn">
              <span>Split PDF</span>
            </a>
          </div>
        </div>
      </section>

      <!-- TOOLS EXPLORATION SECTION -->
      <section class="tools-section">
        <div class="container">
          <!-- SEARCH & FILTER CONTROLS -->
          <div class="filter-bar">
            <div class="category-tabs">
              <button
                type="button"
                class="tab-btn"
                [class.active]="toolRegistry.selectedCategory() === 'all'"
                (click)="setCategory('all')"
              >
                All Tools
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
                placeholder="Search PDF tools (e.g., merge, split, rotate)..."
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
                  <div class="tool-icon-wrapper" [class]="'icon-' + tool.category">
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

      <!-- FEATURES & TRUST SECTION -->
      <section class="trust-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">The Privacy-First Standard for Document Productivity</h2>
            <p class="section-subtitle">Why thousands choose client-side processing over traditional cloud tools.</p>
          </div>

          <div class="trust-grid">
            <div class="trust-card card-clean">
              <div class="trust-icon text-emerald">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3 class="trust-title">100% In-Browser Privacy</h3>
              <p class="trust-desc">
                Your PDF files are processed directly on your computer's RAM using WebAssembly.
                Documents never travel over the internet or sit on remote servers.
              </p>
            </div>

            <div class="trust-card card-clean">
              <div class="trust-icon text-primary">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <h3 class="trust-title">Lightning-Fast Execution</h3>
              <p class="trust-desc">
                No upload wait times and no download buffering. Processing starts immediately
                upon selection and completes in seconds.
              </p>
            </div>

            <div class="trust-card card-clean">
              <div class="trust-icon text-amber">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3 class="trust-title">Zero Paywalls & No Hidden Fees</h3>
              <p class="trust-desc">
                No credit cards, no premium subscriptions, and no trial limits. All essential
                PDF capabilities are completely accessible at zero cost.
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
            <p class="section-subtitle">Clear answers on security, limits, and document handling.</p>
          </div>

          <div class="faq-list">
            <div class="faq-item card-clean">
              <h4 class="faq-q">Are my files really private?</h4>
              <p class="faq-a">
                Yes. For client-side tools like Merge, Split, and Rotate, your files are read and processed entirely
                within your browser's sandboxed JavaScript memory. They are never sent to our backend or stored on any server.
              </p>
            </div>

            <div class="faq-item card-clean">
              <h4 class="faq-q">What is the maximum file size supported?</h4>
              <p class="faq-a">
                You can process documents up to 50MB per file with up to 30 documents simultaneously.
              </p>
            </div>

            <div class="faq-item card-clean">
              <h4 class="faq-q">Do I need an account or email to use PaperFlow?</h4>
              <p class="faq-a">
                No account or email is required. You can start combining, organizing, and editing documents immediately.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .hero-section {
      padding: 72px 0 54px;
      text-align: center;
      background: radial-gradient(circle at 50% 20%, rgba(37, 99, 235, 0.06) 0%, transparent 70%);
    }
    .hero-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 820px;
    }
    .hero-badge {
      margin-bottom: 24px;
    }
    .hero-title {
      font-size: clamp(32px, 5vw, 54px);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: var(--text-main);
    }
    .gradient-text {
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: clamp(16px, 2vw, 19px);
      color: var(--text-muted);
      margin-top: 20px;
      line-height: 1.6;
      max-width: 640px;
    }
    .hero-cta-group {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 36px;
    }
    .hero-btn {
      padding: 14px 32px;
      font-size: 16px;
    }

    /* TOOLS SECTION */
    .tools-section {
      padding: 48px 0 64px;
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
      gap: 8px;
      background: #ffffff;
      padding: 6px;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-md);
    }
    .tab-btn {
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      transition: all 0.15s ease;
    }
    .tab-btn:hover {
      color: var(--text-main);
    }
    .tab-btn.active {
      background: var(--primary-50);
      color: var(--primary-600);
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
      transition: border-color 0.2s ease;
    }
    .search-input:focus {
      border-color: var(--primary-500);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
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
      justify-content: space-between;
      height: 220px;
      text-decoration: none;
    }
    .tool-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tool-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--primary-50);
      color: var(--primary-600);
    }
    .badge-active {
      background: var(--emerald-50);
      color: var(--emerald-700);
    }
    .tool-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      margin-top: 14px;
    }
    .tool-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 6px;
      line-height: 1.5;
    }
    .tool-card-footer {
      margin-top: auto;
      padding-top: 12px;
    }
    .open-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--primary-600);
      transition: gap 0.2s ease;
    }
    .tool-card:hover .open-link {
      gap: 10px;
    }

    /* TRUST SECTION */
    .trust-section {
      padding: 64px 0;
      background: #ffffff;
      border-top: 1px solid var(--surface-border);
      border-bottom: 1px solid var(--surface-border);
    }
    .section-header {
      text-align: center;
      margin-bottom: 48px;
    }
    .section-title {
      font-size: 28px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.02em;
    }
    .section-subtitle {
      font-size: 15px;
      color: var(--text-muted);
      margin-top: 8px;
    }
    .trust-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .trust-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .trust-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-main);
    }
    .trust-desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .text-emerald { color: var(--emerald-600); }
    .text-primary { color: var(--primary-600); }
    .text-amber { color: var(--amber-600); }

    /* FAQ */
    .faq-section {
      padding: 64px 0 20px;
    }
    .faq-container {
      max-width: 820px;
    }
    .faq-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .faq-item {
      padding: 24px;
    }
    .faq-q {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
    }
    .faq-a {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 8px;
      line-height: 1.6;
    }

    @media (max-width: 860px) {
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
