import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { ToolCategory } from '@paperflow/contracts';

type ExtendedFilterCategory = ToolCategory | 'all' | 'workflows' | 'intelligence';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule],
  template: `
    <!-- UNIFIED HOME CANVAS (ONE CONTINUOUS SECTION - NO SPLIT BETWEEN HERO AND TOOLS) -->
    <div class="home-unified-canvas">
      <div class="container canvas-container">
        <!-- 1. HERO TITLE & SUBTITLE -->
        <header class="hero-header">
          <h1 class="hero-title">Every tool you need to work with PDFs in one place</h1>
          <p class="hero-subtitle">
            Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use!
            Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
          </p>

          <!-- 2. CATEGORY FILTER PILLS (Exact iLovePDF Pills matching Image 3) -->
          <div class="filter-pills-row" role="tablist" aria-label="Tool Categories">
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'all'"
              (click)="onSelectCategory('all')"
            >
              All
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'workflows'"
              (click)="onSelectCategory('workflows')"
            >
              Workflows
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'organize'"
              (click)="onSelectCategory('organize')"
            >
              Organize PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'optimize'"
              (click)="onSelectCategory('optimize')"
            >
              Optimize PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'convert'"
              (click)="onSelectCategory('convert')"
            >
              Convert PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'edit'"
              (click)="onSelectCategory('edit')"
            >
              Edit PDF
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'security'"
              (click)="onSelectCategory('security')"
            >
              PDF Security
            </button>
            <button
              type="button"
              class="cat-pill"
              [class.active]="selectedTab() === 'intelligence'"
              (click)="onSelectCategory('intelligence')"
            >
              PDF Intelligence
            </button>
          </div>
        </header>

        <!-- 3. 6-COLUMN RESPONSIVE TOOLS GRID (Seamlessly follows the pills on same canvas) -->
        <main class="ilove-grid" aria-label="PDF Tools Grid">
          @for (tool of displayedTools(); track tool.id) {
            <a [routerLink]="tool.route" class="ilove-card">
              <!-- Custom App Icon Badge matching iLovePDF & Video -->
              <div class="tool-icon-box" [class]="'box-' + tool.id">
                @switch (tool.id) {
                  @case ('merge-pdf') {
                    <!-- Merge PDF: 2 converging coral-red tiles with converging arrows -->
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
                    <!-- Split PDF: 2 separating coral-red tiles with diverging arrows -->
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
                    <!-- Compress PDF: 4 inward emerald green tiles -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="18" height="18" rx="4" fill="#10B981" />
                      <line x1="8" y1="8" x2="16" y2="16" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                      <polyline points="10 16 16 16 16 10" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="26" y="4" width="18" height="18" rx="4" fill="#10B981" />
                      <line x1="40" y1="8" x2="32" y2="16" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                      <polyline points="38 16 32 16 32 10" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="4" y="26" width="18" height="18" rx="4" fill="#10B981" />
                      <line x1="8" y1="40" x2="16" y2="32" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                      <polyline points="10 32 16 32 16 38" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="26" y="26" width="18" height="18" rx="4" fill="#10B981" />
                      <line x1="40" y1="40" x2="32" y2="32" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                      <polyline points="38 32 32 32 32 38" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('pdf-to-word') {
                    <!-- PDF to Word: Salmon transition tile + Royal Blue Word 'W' Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#2B579A" />
                      <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
                    </svg>
                  }
                  @case ('pdf-to-powerpoint') {
                    <!-- PDF to PPT: Salmon transition tile + Orange PPT 'P' Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#D24726" />
                      <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">P</text>
                    </svg>
                  }
                  @case ('pdf-to-excel') {
                    <!-- PDF to Excel: Salmon transition tile + Green Excel 'X' Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#107C41" />
                      <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">X</text>
                    </svg>
                  }
                  @case ('word-to-pdf') {
                    <!-- Word to PDF: Blue 'W' Badge + Red PDF Arrow Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="26" rx="6" fill="#2B579A" />
                      <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
                      <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('powerpoint-to-pdf') {
                    <!-- PPT to PDF: Orange 'P' Badge + Red PDF Arrow Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="26" rx="6" fill="#D24726" />
                      <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">P</text>
                      <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('excel-to-pdf') {
                    <!-- Excel to PDF: Green 'X' Badge + Red PDF Arrow Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="26" rx="6" fill="#107C41" />
                      <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">X</text>
                      <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('edit-pdf') {
                    <!-- Edit PDF: Plum/Purple Editor Box with Pencil & Anchor Handles -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#9333EA" />
                      <rect x="12" y="12" width="24" height="24" rx="3" fill="none" stroke="white" stroke-width="1.8" stroke-dasharray="3 2" />
                      <rect x="10.5" y="10.5" width="3" height="3" fill="white" />
                      <rect x="34.5" y="10.5" width="3" height="3" fill="white" />
                      <rect x="10.5" y="34.5" width="3" height="3" fill="white" />
                      <rect x="34.5" y="34.5" width="3" height="3" fill="white" />
                      <path d="M28 16l4 4-10 10h-4v-4l10-10z" fill="white"/>
                      <circle cx="16" cy="28" r="1.5" fill="white"/>
                    </svg>
                  }
                  @case ('pdf-to-jpg') {
                    <!-- PDF to JPG: Salmon transition tile + Golden Amber Landscape Photo Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#F59E0B" />
                      <circle cx="25" cy="23" r="2.5" fill="white"/>
                      <path d="M22 36l5-6 3 3 5-7 7 10H22z" fill="white"/>
                    </svg>
                  }
                  @case ('images-to-pdf') {
                    <!-- JPG to PDF: Golden Amber 'JPG' Badge + Coral Red Arrow Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="25" height="22" rx="5" fill="#F59E0B" />
                      <text x="16.5" y="19" font-size="9" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">JPG</text>
                      <rect x="22" y="20" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="26" x2="37" y2="35" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 35 37 35 37 29" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('sign-pdf') {
                    <!-- Sign PDF: Vibrant Blue Badge with Fountain Pen Nib & Signature Stroke -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#0284C7" />
                      <path d="M28 12l4 4-8 8-4-1 1-4 7-7z" fill="white"/>
                      <circle cx="21" cy="23" r="1.5" fill="#0284C7"/>
                      <path d="M13 34c4-3 7 1 11-2s8-1 11 1" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    </svg>
                  }
                  @case ('watermark-pdf') {
                    <!-- Watermark PDF: Berry Burgundy Badge with Classic Rubber Stamp -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#9D174D" />
                      <path d="M24 13c-2 0-3 1.5-3 3v4h6v-4c0-1.5-1-3-3-3z" fill="white"/>
                      <rect x="15" y="20" width="18" height="5" rx="1.5" fill="white"/>
                      <rect x="12" y="26" width="24" height="4" rx="1.5" fill="white" opacity="0.9"/>
                      <line x1="15" y1="34" x2="33" y2="34" stroke="white" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 2"/>
                    </svg>
                  }
                  @case ('rotate-pdf') {
                    <!-- Rotate PDF: Violet Badge with Page & Curved Arrow -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#7C3AED" />
                      <rect x="19" y="17" width="10" height="14" rx="2" fill="white" opacity="0.35"/>
                      <path d="M24 13a11 11 0 1 1-7.8 3.2M16 11v6h6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                  }
                  @case ('html-to-pdf') {
                    <!-- HTML to PDF: Yellow 'HTML' Code Badge + Red Arrow Badge -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="22" rx="5" fill="#EAB308" />
                      <text x="17" y="19" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">HTML</text>
                      <rect x="22" y="20" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="26" x2="37" y2="35" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 35 37 35 37 29" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('unlock-pdf') {
                    <!-- Unlock PDF: Sky Blue Badge with Open Padlock & Keyhole -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#2563EB" />
                      <path d="M19 22V17a5 5 0 0 1 10 0v2" stroke="white" stroke-width="3" stroke-linecap="round" fill="none"/>
                      <rect x="14" y="22" width="20" height="15" rx="3.5" fill="white"/>
                      <circle cx="24" cy="28" r="2" fill="#2563EB"/>
                      <rect x="23" y="28" width="2" height="4" fill="#2563EB"/>
                    </svg>
                  }
                  @case ('protect-pdf') {
                    <!-- Protect PDF: Deep Navy Blue Badge with Security Shield & Keyhole -->
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E3A8A" />
                      <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white"/>
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
        </main>

        <!-- 4. 3-STEP PROCESS GUIDE -->
        <section class="steps-section" aria-label="How it works">
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
                Select documents to transform. All data is processed directly inside your browser memory.
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
        </section>
      </div>
    </div>
  `,
  styles: [`
    /* UNIFIED HOME CANVAS: ONE CONTINUOUS SEAMLESS BACKGROUND MATCHING IMAGE 3 */
    .home-unified-canvas {
      background: #f7f8fa;
      min-height: calc(100vh - 68px);
      padding: 56px 0 80px;
    }
    .canvas-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* 1. HERO HEADER AREA */
    .hero-header {
      text-align: center;
      max-width: 980px;
      margin: 0 auto 36px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .hero-title {
      font-size: clamp(28px, 3.2vw, 44px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111827;
      line-height: 1.22;
      margin-bottom: 14px;
    }
    .hero-subtitle {
      font-size: clamp(14.5px, 1.25vw, 16.5px);
      color: #6b7280;
      line-height: 1.6;
      max-width: 760px;
      margin: 0 auto 32px;
    }

    /* 2. CATEGORY FILTER PILLS (Exact styling from Image 3) */
    .filter-pills-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cat-pill {
      padding: 8px 18px;
      font-size: 13.5px;
      font-weight: 600;
      border-radius: 9999px;
      background: #ffffff;
      color: #4b5563;
      border: 1px solid #e5e7eb;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .cat-pill:hover {
      background: #ffffff;
      color: #111827;
      border-color: #cbd5e1;
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.06);
    }
    .cat-pill.active {
      background: #1e293b;
      color: #ffffff;
      border-color: #1e293b;
      box-shadow: 0 2px 10px rgba(30, 41, 59, 0.25);
    }

    /* 3. 6-COLUMN RESPONSIVE TOOLS GRID (Seamlessly follows the pills) */
    .ilove-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 20px;
      width: 100%;
      margin-bottom: 56px;
    }

    /* CARD DESIGN */
    .ilove-card {
      display: flex;
      flex-direction: column;
      padding: 26px 22px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      text-decoration: none;
      min-height: 220px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .ilove-card:hover {
      border-color: #fca5a5;
      transform: translateY(-4px);
      box-shadow: 0 14px 28px -4px rgba(229, 50, 56, 0.12), 0 4px 10px rgba(0, 0, 0, 0.04);
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
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ilove-card:hover .tool-icon-box {
      transform: translateY(-2px) scale(1.08);
    }

    .card-title {
      font-size: 17.5px;
      font-weight: 800;
      letter-spacing: -0.015em;
      color: #111827;
      margin: 0 0 8px;
      line-height: 1.3;
    }
    .card-desc {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
      margin: 0;
    }

    /* 4. 3-STEP PROCESS GUIDE */
    .steps-section {
      width: 100%;
      border-top: 1px solid #e5e7eb;
      padding-top: 56px;
    }
    .steps-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      width: 100%;
    }
    .step-col {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 28px 24px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }
    .step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #fee2e2;
      color: #E53238;
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .step-head {
      font-size: 16.5px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 6px;
    }
    .step-text {
      font-size: 13.5px;
      color: #6b7280;
      line-height: 1.55;
      margin: 0;
    }

    /* RESPONSIVE BREAKPOINTS (Exact iLovePDF column collapse) */
    @media (max-width: 1400px) {
      .ilove-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    @media (max-width: 1024px) {
      .ilove-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .steps-row {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }

    @media (max-width: 768px) {
      .ilove-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
      }
      .ilove-card {
        padding: 20px 16px;
        min-height: 180px;
      }
      .hero-title {
        font-size: 26px;
      }
    }

    @media (max-width: 480px) {
      .ilove-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);

  selectedTab = signal<ExtendedFilterCategory>('all');

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'PDF flow - Online PDF Converter & Document Tools Free',
      description: 'The easiest & fastest free online PDF tools. Merge, split, compress, convert, edit, and protect PDFs with 100% in-browser privacy.',
      keywords: ['pdf tools', 'merge pdf', 'split pdf', 'compress pdf', 'pdf converter', 'free pdf tools'],
      canonical: 'https://pdfflow.app'
    });
  }

  onSelectCategory(tab: ExtendedFilterCategory): void {
    this.selectedTab.set(tab);

    if (tab === 'workflows' || tab === 'intelligence' || tab === 'all') {
      this.toolRegistry.setCategory('all');
    } else {
      this.toolRegistry.setCategory(tab);
    }
  }

  displayedTools() {
    const tab = this.selectedTab();
    const all = this.toolRegistry.allTools();

    if (tab === 'workflows') {
      // Return combination workflows tools: Merge, Split, Compress, Rotate
      return all.filter(t => ['merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'protect-pdf'].includes(t.id));
    }
    if (tab === 'intelligence') {
      // Return smart conversion / intelligence tools
      return all.filter(t => ['pdf-to-word', 'word-to-pdf', 'pdf-to-excel', 'images-to-pdf'].includes(t.id));
    }
    return this.toolRegistry.filteredTools();
  }
}
