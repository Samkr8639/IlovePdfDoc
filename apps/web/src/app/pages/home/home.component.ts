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
                      <!-- Professional Merge PDF: 2 converging coral-red tiles with converging arrows -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="9" y1="9" x2="19" y2="19" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                        <polyline points="13 19 19 19 19 13" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="39" y1="39" x2="29" y2="29" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                        <polyline points="35 29 29 29 29 35" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('split-pdf') {
                      <!-- Professional Split PDF: 2 separating coral-red tiles with diverging arrows -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="19" y1="19" x2="9" y2="9" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                        <polyline points="16 9 9 9 9 16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="29" y1="29" x2="39" y2="39" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                        <polyline points="32 39 39 39 39 32" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('compress-pdf') {
                      <!-- Professional Compress PDF: 4 inward emerald green tiles -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <!-- Top-Left -->
                        <rect x="4" y="4" width="18" height="18" rx="4" fill="#10B981" />
                        <line x1="8" y1="8" x2="16" y2="16" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                        <polyline points="10 16 16 16 16 10" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <!-- Top-Right -->
                        <rect x="26" y="4" width="18" height="18" rx="4" fill="#10B981" />
                        <line x1="40" y1="8" x2="32" y2="16" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                        <polyline points="38 16 32 16 32 10" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <!-- Bottom-Left -->
                        <rect x="4" y="26" width="18" height="18" rx="4" fill="#10B981" />
                        <line x1="8" y1="40" x2="16" y2="32" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                        <polyline points="10 32 16 32 16 38" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <!-- Bottom-Right -->
                        <rect x="26" y="26" width="18" height="18" rx="4" fill="#10B981" />
                        <line x1="40" y1="40" x2="32" y2="32" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                        <polyline points="38 32 32 32 32 38" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('pdf-to-word') {
                      <!-- Professional PDF to Word: Salmon transition tile + Royal Blue Word 'W' Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                        <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="18" y="16" width="26" height="26" rx="6" fill="#2B579A" />
                        <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
                      </svg>
                    }
                    @case ('pdf-to-powerpoint') {
                      <!-- Professional PDF to PPT: Salmon transition tile + Orange PPT 'P' Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                        <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="18" y="16" width="26" height="26" rx="6" fill="#D24726" />
                        <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">P</text>
                      </svg>
                    }
                    @case ('pdf-to-excel') {
                      <!-- Professional PDF to Excel: Salmon transition tile + Green Excel 'X' Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                        <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="18" y="16" width="26" height="26" rx="6" fill="#107C41" />
                        <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">X</text>
                      </svg>
                    }
                    @case ('word-to-pdf') {
                      <!-- Professional Word to PDF: Blue 'W' Badge + Red PDF Arrow Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="26" height="26" rx="6" fill="#2B579A" />
                        <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
                        <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                        <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('powerpoint-to-pdf') {
                      <!-- Professional PPT to PDF: Orange 'P' Badge + Red PDF Arrow Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="26" height="26" rx="6" fill="#D24726" />
                        <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">P</text>
                        <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                        <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('excel-to-pdf') {
                      <!-- Professional Excel to PDF: Green 'X' Badge + Red PDF Arrow Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="26" height="26" rx="6" fill="#107C41" />
                        <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">X</text>
                        <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                        <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('edit-pdf') {
                      <!-- Professional Edit PDF: Plum/Purple Editor Box with Pencil & Anchor Handles -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="40" height="40" rx="10" fill="#9333EA" />
                        <rect x="12" y="12" width="24" height="24" rx="3" fill="none" stroke="white" stroke-width="1.8" stroke-dasharray="3 2" />
                        <!-- Corner anchor handles -->
                        <rect x="10.5" y="10.5" width="3" height="3" fill="white" />
                        <rect x="34.5" y="10.5" width="3" height="3" fill="white" />
                        <rect x="10.5" y="34.5" width="3" height="3" fill="white" />
                        <rect x="34.5" y="34.5" width="3" height="3" fill="white" />
                        <!-- Stylus / Pencil -->
                        <path d="M28 16l4 4-10 10h-4v-4l10-10z" fill="white"/>
                        <circle cx="16" cy="28" r="1.5" fill="white"/>
                      </svg>
                    }
                    @case ('pdf-to-jpg') {
                      <!-- Professional PDF to JPG: Salmon transition tile + Golden Amber Landscape Photo Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                        <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="18" y="16" width="26" height="26" rx="6" fill="#F59E0B" />
                        <circle cx="25" cy="23" r="2.5" fill="white"/>
                        <path d="M22 36l5-6 3 3 5-7 7 10H22z" fill="white"/>
                      </svg>
                    }
                    @case ('images-to-pdf') {
                      <!-- Professional JPG to PDF: Golden Amber 'JPG' Badge + Coral Red Arrow Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="25" height="22" rx="5" fill="#F59E0B" />
                        <text x="16.5" y="19" font-size="9" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">JPG</text>
                        <rect x="22" y="20" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="28" y1="26" x2="37" y2="35" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                        <polyline points="31 35 37 35 37 29" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('sign-pdf') {
                      <!-- Professional Sign PDF: Vibrant Blue Badge with Fountain Pen Nib & Signature Stroke -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="40" height="40" rx="10" fill="#0284C7" />
                        <path d="M28 12l4 4-8 8-4-1 1-4 7-7z" fill="white"/>
                        <circle cx="21" cy="23" r="1.5" fill="#0284C7"/>
                        <path d="M13 34c4-3 7 1 11-2s8-1 11 1" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                      </svg>
                    }
                    @case ('watermark-pdf') {
                      <!-- Professional Watermark PDF: Berry Burgundy Badge with Classic Rubber Stamp -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="40" height="40" rx="10" fill="#9D174D" />
                        <!-- Stamp Handle -->
                        <path d="M24 13c-2 0-3 1.5-3 3v4h6v-4c0-1.5-1-3-3-3z" fill="white"/>
                        <!-- Stamp Plate -->
                        <rect x="15" y="20" width="18" height="5" rx="1.5" fill="white"/>
                        <!-- Stamp Pad Cushion -->
                        <rect x="12" y="26" width="24" height="4" rx="1.5" fill="white" opacity="0.9"/>
                        <!-- Ink impression mark -->
                        <line x1="15" y1="34" x2="33" y2="34" stroke="white" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 2"/>
                      </svg>
                    }
                    @case ('rotate-pdf') {
                      <!-- Professional Rotate PDF: Violet Badge with Page & 360 Degree Curved Arrow -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="40" height="40" rx="10" fill="#7C3AED" />
                        <rect x="19" y="17" width="10" height="14" rx="2" fill="white" opacity="0.35"/>
                        <path d="M24 13a11 11 0 1 1-7.8 3.2M16 11v6h6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                      </svg>
                    }
                    @case ('html-to-pdf') {
                      <!-- Professional HTML to PDF: Yellow 'HTML' Code Badge + Red Arrow Badge -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="26" height="22" rx="5" fill="#EAB308" />
                        <text x="17" y="19" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">HTML</text>
                        <rect x="22" y="20" width="22" height="22" rx="5" fill="#E53238" />
                        <line x1="28" y1="26" x2="37" y2="35" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                        <polyline points="31 35 37 35 37 29" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('unlock-pdf') {
                      <!-- Professional Unlock PDF: Sky Blue Badge with Open Padlock & Keyhole -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="40" height="40" rx="10" fill="#2563EB" />
                        <!-- Open Shackle -->
                        <path d="M19 22V17a5 5 0 0 1 10 0v2" stroke="white" stroke-width="3" stroke-linecap="round" fill="none"/>
                        <!-- Lock Body -->
                        <rect x="14" y="22" width="20" height="15" rx="3.5" fill="white"/>
                        <!-- Keyhole -->
                        <circle cx="24" cy="28" r="2" fill="#2563EB"/>
                        <rect x="23" y="28" width="2" height="4" fill="#2563EB"/>
                      </svg>
                    }
                    @case ('protect-pdf') {
                      <!-- Professional Protect PDF: Deep Navy Blue Badge with Security Shield & Keyhole -->
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E3A8A" />
                        <!-- Shield -->
                        <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white"/>
                        <!-- Keyhole inside shield -->
                        <circle cx="24" cy="23" r="2.5" fill="#1E3A8A"/>
                        <polygon points="22.5,23.5 25.5,23.5 26,29 22,29" fill="#1E3A8A"/>
                      </svg>
                    }
                    @default {
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="4" y="4" width="40" height="40" rx="10" fill="#E53238" />
                        <path d="M20 14h8l6 6v14H14V14h6z" fill="white"/>
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

    /* PROFESSIONAL ICON BADGE CONTAINER */
    .tool-icon-box {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      width: 48px;
      height: 48px;
      margin-bottom: 20px;
      flex-shrink: 0;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ilove-card:hover .tool-icon-box {
      transform: translateY(-2px) scale(1.08);
    }

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
