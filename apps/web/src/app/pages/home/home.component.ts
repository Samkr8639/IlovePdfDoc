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
      <!-- HERO HEADER SECTION (Exact iLovePDF Layout & Typography) -->
      <section class="hero-section">
        <div class="container hero-container">
          <h1 class="hero-title">Every tool you need to work with PDFs in one place</h1>
          <p class="hero-subtitle">
            Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use!
            Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
          </p>

          <!-- CATEGORY FILTER PILLS (iLovePDF Style Pill Bar) -->
          <div class="filter-pills-row">
            <button
              type="button"
              class="cat-pill"
              [class.active]="toolRegistry.selectedCategory() === 'all'"
              (click)="setCategory('all')"
            >
              All
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="toolRegistry.selectedCategory() === 'organize'"
              (click)="setCategory('organize')"
            >
              Organize PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="toolRegistry.selectedCategory() === 'optimize'"
              (click)="setCategory('optimize')"
            >
              Optimize PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="toolRegistry.selectedCategory() === 'convert'"
              (click)="setCategory('convert')"
            >
              Convert PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="toolRegistry.selectedCategory() === 'edit'"
              (click)="setCategory('edit')"
            >
              Edit PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="toolRegistry.selectedCategory() === 'security'"
              (click)="setCategory('security')"
            >
              PDF Security
            </button>
          </div>
        </div>
      </section>

      <!-- 6-COLUMN RESPONSIVE TOOLS GRID (Exact iLovePDF Grid & Width) -->
      <section class="grid-section">
        <div class="container">
          <div class="ilove-grid">
            @for (tool of toolRegistry.filteredTools(); track tool.id) {
              <a [routerLink]="tool.route" class="ilove-card">
                <!-- Custom App Icon Badge matching iLovePDF & Video -->
                <div class="tool-icon-box" [class]="'box-' + tool.id">
                  @switch (tool.id) {
                    @case ('merge-pdf') {
                      <!-- Orange/Coral Merge PDF Fork -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="4 14 10 14 10 20"></polyline>
                        <polyline points="20 10 14 10 14 4"></polyline>
                        <line x1="14" y1="10" x2="21" y2="3"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                      </svg>
                    }
                    @case ('split-pdf') {
                      <!-- Red Split PDF Icon -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                      </svg>
                    }
                    @case ('compress-pdf') {
                      <!-- Green Inward Arrows -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="4 9 9 9 9 4"></polyline>
                        <polyline points="20 15 15 15 15 20"></polyline>
                        <line x1="9" y1="9" x2="3" y2="3"></line>
                        <line x1="15" y1="15" x2="21" y2="21"></line>
                      </svg>
                    }
                    @case ('pdf-to-word') {
                      <!-- Blue Word 'W' Badge -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M4 2H16L21 7V22H4V2Z" fill="currentColor" opacity="0.15"/>
                        <path d="M15 2V7H20" stroke="currentColor" stroke-width="2"/>
                        <text x="12" y="17" font-size="9" font-weight="900" fill="currentColor" text-anchor="middle" font-family="'Space Grotesk', sans-serif">W</text>
                      </svg>
                    }
                    @case ('pdf-to-powerpoint') {
                      <!-- Orange PPT 'P' Badge -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M4 2H16L21 7V22H4V2Z" fill="currentColor" opacity="0.15"/>
                        <path d="M15 2V7H20" stroke="currentColor" stroke-width="2"/>
                        <text x="12" y="17" font-size="9" font-weight="900" fill="currentColor" text-anchor="middle" font-family="'Space Grotesk', sans-serif">P</text>
                      </svg>
                    }
                    @case ('pdf-to-excel') {
                      <!-- Green Excel 'X' Badge -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M4 2H16L21 7V22H4V2Z" fill="currentColor" opacity="0.15"/>
                        <path d="M15 2V7H20" stroke="currentColor" stroke-width="2"/>
                        <text x="12" y="17" font-size="9" font-weight="900" fill="currentColor" text-anchor="middle" font-family="'Space Grotesk', sans-serif">X</text>
                      </svg>
                    }
                    @case ('word-to-pdf') {
                      <!-- Word to PDF -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h10l6 6v10H4V4z"></path>
                        <polyline points="14 4 14 10 20 10"></polyline>
                        <path d="M8 17l4-8 4 8" stroke-width="2.5"></path>
                      </svg>
                    }
                    @case ('powerpoint-to-pdf') {
                      <!-- PPT to PDF -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    }
                    @case ('excel-to-pdf') {
                      <!-- Excel to PDF -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                      </svg>
                    }
                    @case ('edit-pdf') {
                      <!-- Purple Edit PDF Icon -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    }
                    @case ('pdf-to-jpg') {
                      <!-- Yellow PDF to JPG -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    }
                    @case ('images-to-pdf') {
                      <!-- JPG to PDF -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <polyline points="8 12 12 8 16 12"></polyline>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                      </svg>
                    }
                    @case ('sign-pdf') {
                      <!-- Sign PDF Fountain Pen -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    }
                    @case ('watermark-pdf') {
                      <!-- Watermark Stamp -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="4"></rect>
                        <path d="M9 15l6-6"></path>
                        <circle cx="9.5" cy="9.5" r="1.5"></circle>
                        <circle cx="14.5" cy="14.5" r="1.5"></circle>
                      </svg>
                    }
                    @case ('rotate-pdf') {
                      <!-- Rotate CW -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                      </svg>
                    }
                    @case ('html-to-pdf') {
                      <!-- HTML Code Tag -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                      </svg>
                    }
                    @case ('unlock-pdf') {
                      <!-- Unlock Padlock -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/>
                        <path d="M8 11V7a4 4 0 0 1 7.5-2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="#FFFFFF"/>
                      </svg>
                    }
                    @case ('protect-pdf') {
                      <!-- Green Padlock -->
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="#FFFFFF"/>
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

                <!-- Card Content -->
                <h3 class="card-title">{{ tool.name }}</h3>
                <p class="card-desc">{{ tool.shortDescription }}</p>
              </a>
            }
          </div>

          <!-- 3-STEP PROCESS GUIDE -->
          <div class="steps-row">
            <div class="step-col">
              <span class="step-badge">01</span>
              <h4 class="step-head">Choose the service</h4>
              <p class="step-text">
                Choose from all available document tools above or in the navigation dropdowns.
              </p>
            </div>

            <div class="step-col">
              <span class="step-badge">02</span>
              <h4 class="step-head">Upload document</h4>
              <p class="step-text">
                Select documents to transform. All data is saved and securely processed directly in browser memory.
              </p>
            </div>

            <div class="step-col">
              <span class="step-badge">03</span>
              <h4 class="step-head">Preview & download</h4>
              <p class="step-text">
                Review the document with live in-browser preview, then download your finished file instantly.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-page {
      padding-bottom: 80px;
    }

    /* HERO SECTION */
    .hero-section {
      padding: 64px 0 40px;
      text-align: center;
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border-subtle);
    }
    .hero-container {
      max-width: 960px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .hero-title {
      font-size: clamp(30px, 3.4vw, 46px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--text-main);
      line-height: 1.2;
      margin-bottom: 16px;
    }
    .hero-subtitle {
      font-size: clamp(15px, 1.3vw, 17px);
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 780px;
      margin: 0 auto 36px;
    }

    /* CATEGORY FILTER PILLS (iLovePDF Style) */
    .filter-pills-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cat-pill {
      padding: 8px 18px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 9999px;
      background: #f3f4f6;
      color: var(--text-muted);
      border: 1px solid transparent;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .cat-pill:hover {
      background: #e5e7eb;
      color: var(--text-main);
    }
    .cat-pill.active {
      background: #1f2937;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    /* GRID SECTION - iLovePDF Exact 6-Column Responsive Dimensions */
    .grid-section {
      padding: 48px 0 64px;
    }
    .ilove-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 20px;
      width: 100%;
    }

    /* CARD DESIGN */
    .ilove-card {
      display: flex;
      flex-direction: column;
      padding: 26px 22px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-xl);
      text-decoration: none;
      min-height: 220px;
      box-shadow: var(--shadow-sm);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .ilove-card:hover {
      border-color: var(--coral-300);
      transform: translateY(-4px);
      box-shadow: 0 14px 28px -4px rgba(229, 57, 53, 0.12), 0 4px 10px rgba(0, 0, 0, 0.04);
    }

    /* ICON BOXES WITH EXACT iLovePDF THEME COLORS */
    .tool-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      margin-bottom: 16px;
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }
    .ilove-card:hover .tool-icon-box {
      transform: scale(1.08);
    }

    /* Specific Tool Colors matching screenshot */
    .box-merge-pdf { background: #feebe8; color: #e53935; }
    .box-split-pdf { background: #fee2e2; color: #ef4444; }
    .box-compress-pdf { background: #ecfdf5; color: #10b981; }
    .box-pdf-to-word { background: #eff6ff; color: #2563eb; }
    .box-pdf-to-powerpoint { background: #fff7ed; color: #ea580c; }
    .box-pdf-to-excel { background: #f0fdf4; color: #16a34a; }
    .box-word-to-pdf { background: #eff6ff; color: #2563eb; }
    .box-powerpoint-to-pdf { background: #fff7ed; color: #ea580c; }
    .box-excel-to-pdf { background: #f0fdf4; color: #16a34a; }
    .box-edit-pdf { background: #f5f3ff; color: #7c3aed; }
    .box-pdf-to-jpg { background: #fffbeb; color: #d97706; }
    .box-images-to-pdf { background: #fffbeb; color: #d97706; }
    .box-sign-pdf { background: #ecfeff; color: #0891b2; }
    .box-watermark-pdf { background: #fae8ff; color: #a855f7; }
    .box-rotate-pdf { background: #f3e8ff; color: #9333ea; }
    .box-html-to-pdf { background: #fef9c3; color: #ca8a04; }
    .box-unlock-pdf { background: #eff6ff; color: #3b82f6; }
    .box-protect-pdf { background: #f0fdf4; color: #15803d; }

    .card-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.015em;
      color: var(--text-main);
      margin: 0 0 8px;
      line-height: 1.3;
    }
    .card-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.5;
      margin: 0;
    }

    /* 3-STEP GUIDE (Spacious & Clean) */
    .steps-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      width: 100%;
      border-top: 1px solid var(--surface-border);
      margin-top: 56px;
      padding-top: 48px;
    }
    .step-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .step-badge {
      font-size: 16px;
      font-weight: 800;
      color: var(--coral-600);
      font-family: var(--font-display);
    }
    .step-head {
      font-size: 17px;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }
    .step-text {
      font-size: 13.5px;
      line-height: 1.6;
      color: var(--text-muted);
      margin: 0;
    }

    /* FULL RESPONSIVE BREAKPOINTS (Fluid 6 to 1 columns) */
    @media (max-width: 1440px) {
      .ilove-grid {
        grid-template-columns: repeat(5, 1fr);
      }
    }
    @media (max-width: 1180px) {
      .ilove-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
    }
    @media (max-width: 900px) {
      .ilove-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .steps-row {
        grid-template-columns: 1fr;
        gap: 24px;
      }
    }
    @media (max-width: 680px) {
      .ilove-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .hero-section {
        padding: 48px 0 28px;
      }
    }
    @media (max-width: 460px) {
      .ilove-grid {
        grid-template-columns: 1fr;
      }
      .ilove-card {
        min-height: auto;
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
