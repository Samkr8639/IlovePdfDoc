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
    <div class="home-unified-canvas">
      <!-- 1. HERO HEADER AREA -->
      <header class="container hero-header">
        <h1 class="hero-title">Every tool you need to work with PDFs in one place</h1>
        <p class="hero-subtitle">
          Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use!
          Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
        </p>

        <!-- CATEGORY FILTER PILLS (Matching Reference Image) -->
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

      <!-- 2. 6-COLUMN RESPONSIVE TOOLS GRID (Seamlessly follows the pills) -->
      <main class="container ilove-grid-container" aria-label="PDF Tools Grid">
        <div class="ilove-grid">
          @for (tool of displayedTools(); track tool.id) {
            <a [routerLink]="tool.route" class="ilove-card">
              <!-- New Badge Indicator if applicable -->
              @if (tool.isNew) {
                <span class="tool-new-badge">NEW</span>
              }

              <!-- Custom App Icon Badge -->
              <div class="tool-icon-box" [class]="'box-' + tool.id">
                @switch (tool.id) {
                  @case ('merge-pdf') {
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
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#2B579A" />
                      <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
                    </svg>
                  }
                  @case ('pdf-to-powerpoint') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#D24726" />
                      <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">P</text>
                    </svg>
                  }
                  @case ('pdf-to-excel') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#107C41" />
                      <text x="31" y="35" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">X</text>
                    </svg>
                  }
                  @case ('word-to-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="26" rx="6" fill="#2B579A" />
                      <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">W</text>
                      <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('powerpoint-to-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="26" rx="6" fill="#D24726" />
                      <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">P</text>
                      <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('excel-to-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="26" rx="6" fill="#107C41" />
                      <text x="17" y="23" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">X</text>
                      <rect x="22" y="22" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="28" x2="37" y2="37" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 37 37 37 37 31" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('edit-pdf') {
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
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="4.5" fill="#FEE2E2" />
                      <path d="M10 10l7 7M17 12v5h-5" stroke="#E53238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="18" y="16" width="26" height="26" rx="6" fill="#F59E0B" />
                      <circle cx="25" cy="23" r="2.5" fill="white"/>
                      <path d="M22 36l5-6 3 3 5-7 7 10H22z" fill="white"/>
                    </svg>
                  }
                  @case ('images-to-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="25" height="22" rx="5" fill="#F59E0B" />
                      <text x="16.5" y="19" font-size="9" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">JPG</text>
                      <rect x="22" y="20" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="26" x2="37" y2="35" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 35 37 35 37 29" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('sign-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#0284C7" />
                      <path d="M28 12l4 4-8 8-4-1 1-4 7-7z" fill="white"/>
                      <circle cx="21" cy="23" r="1.5" fill="#0284C7"/>
                      <path d="M13 34c4-3 7 1 11-2s8-1 11 1" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    </svg>
                  }
                  @case ('watermark-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#9D174D" />
                      <path d="M24 13c-2 0-3 1.5-3 3v4h6v-4c0-1.5-1-3-3-3z" fill="white"/>
                      <rect x="15" y="20" width="18" height="5" rx="1.5" fill="white"/>
                      <rect x="12" y="26" width="24" height="4" rx="1.5" fill="white" opacity="0.9"/>
                      <line x1="15" y1="34" x2="33" y2="34" stroke="white" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 2"/>
                    </svg>
                  }
                  @case ('rotate-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#7C3AED" />
                      <rect x="19" y="17" width="10" height="14" rx="2" fill="white" opacity="0.35"/>
                      <path d="M24 13a11 11 0 1 1-7.8 3.2M16 11v6h6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                  }
                  @case ('html-to-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="26" height="22" rx="5" fill="#EAB308" />
                      <text x="17" y="19" font-size="8.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">HTML</text>
                      <rect x="22" y="20" width="22" height="22" rx="5" fill="#E53238" />
                      <line x1="28" y1="26" x2="37" y2="35" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
                      <polyline points="31 35 37 35 37 29" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('unlock-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#2563EB" />
                      <path d="M19 22V17a5 5 0 0 1 10 0v2" stroke="white" stroke-width="3" stroke-linecap="round" fill="none"/>
                      <rect x="14" y="22" width="20" height="15" rx="3.5" fill="white"/>
                      <circle cx="24" cy="28" r="2" fill="#2563EB"/>
                      <rect x="23" y="28" width="2" height="4" fill="#2563EB"/>
                    </svg>
                  }
                  @case ('protect-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E3A8A" />
                      <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white"/>
                      <circle cx="24" cy="23" r="2.5" fill="#1E3A8A"/>
                      <polygon points="22.5,23.5 25.5,23.5 26,29 22,29" fill="#1E3A8A"/>
                    </svg>
                  }
                  @case ('organize-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="18" height="18" rx="4" fill="#E53238" />
                      <rect x="26" y="4" width="18" height="18" rx="4" fill="#E53238" />
                      <rect x="4" y="26" width="18" height="18" rx="4" fill="#E53238" />
                      <rect x="26" y="26" width="18" height="18" rx="4" fill="#E53238" />
                    </svg>
                  }
                  @case ('pdf-to-pdfa') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#475569" />
                      <text x="24" y="29" font-size="14" font-weight="900" fill="white" text-anchor="middle">PDF/A</text>
                    </svg>
                  }
                  @case ('repair-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#059669" />
                      <path d="M29 19a7 7 0 0 0-9.9 0l-5 5a7 7 0 1 0 9.9 9.9l5-5a7 7 0 0 0 0-9.9z" stroke="white" stroke-width="2.5" fill="none"/>
                    </svg>
                  }
                  @case ('page-numbers') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#7C3AED" />
                      <text x="24" y="30" font-size="18" font-weight="900" fill="white" text-anchor="middle">123</text>
                    </svg>
                  }
                  @case ('scan-to-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#E53238" />
                      <path d="M15 17h18v14H15z" stroke="white" stroke-width="2" fill="none"/>
                      <circle cx="24" cy="24" r="3.5" fill="white"/>
                    </svg>
                  }
                  @case ('ocr-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#10B981" />
                      <text x="24" y="30" font-size="16" font-weight="900" fill="white" text-anchor="middle">OCR</text>
                    </svg>
                  }
                  @case ('compare-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="6" y="8" width="16" height="32" rx="3" fill="#2563EB" />
                      <rect x="26" y="8" width="16" height="32" rx="3" fill="#3B82F6" />
                    </svg>
                  }
                  @case ('redact-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#1E293B" />
                      <line x1="12" y1="24" x2="36" y2="24" stroke="#E53238" stroke-width="5" stroke-linecap="round"/>
                    </svg>
                  }
                  @case ('crop-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#9333EA" />
                      <path d="M14 6v28h28M6 14h28v28" stroke="white" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                  }
                  @case ('pdf-forms') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#8B5CF6" />
                      <rect x="14" y="14" width="20" height="6" rx="2" fill="white"/>
                      <rect x="14" y="24" width="20" height="6" rx="2" fill="white"/>
                    </svg>
                  }
                  @case ('ai-summarizer') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#6366F1" />
                      <path d="M24 12l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z" fill="white"/>
                    </svg>
                  }
                  @case ('translate-pdf') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#3B82F6" />
                      <circle cx="24" cy="24" r="12" stroke="white" stroke-width="2.5" fill="none"/>
                      <path d="M12 24h24M24 12a18 18 0 0 1 0 24 18 18 0 0 1 0-24z" stroke="white" stroke-width="2" fill="none"/>
                    </svg>
                  }
                  @case ('pdf-to-markdown') {
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="4" y="4" width="40" height="40" rx="10" fill="#0F172A" />
                      <text x="24" y="30" font-size="16" font-weight="900" fill="white" text-anchor="middle">MD</text>
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

          <!-- SPECIAL "CREATE A WORKFLOW" CARD (Signature Highlight from Reference) -->
          <div class="workflow-highlight-card" (click)="onSelectCategory('workflows')">
            <div class="workflow-header-pill">New Feature</div>
            <div class="workflow-icon-group">
              <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
                <circle cx="12" cy="14" r="6" fill="#E53238"/>
                <circle cx="36" cy="14" r="6" fill="#F59E0B"/>
                <circle cx="24" cy="36" r="6" fill="#10B981"/>
                <path d="M18 14h12M16 18l6 14M32 18l-6 14" stroke="#E53238" stroke-width="2" stroke-dasharray="3 3"/>
              </svg>
            </div>
            <h3 class="workflow-title">Create a workflow</h3>
            <p class="workflow-desc">
              Do it in one go. Combine multiple tools into automated customized sequences for you or your team.
            </p>
            <div class="workflow-action-link">
              <span>Start a workflow</span>
              <span class="workflow-arrow">→</span>
            </div>
          </div>
        </div>
      </main>

      <!-- 3. "WORK YOUR WAY" (Ecosystem 3-Column Section) -->
      <section class="work-your-way-section">
        <div class="container">
          <div class="section-center-head">
            <h2 class="section-title-large">Work your way</h2>
            <p class="section-subtitle-muted">
              Access your documents from any device, offline or in the cloud.
            </p>
          </div>

          <div class="ecosystem-cards-grid">
            <!-- 1. Desktop Card -->
            <div class="ecosystem-card">
              <div class="card-visual-header desktop-bg">
                <div class="window-mockup">
                  <div class="window-topbar">
                    <span class="dot-red"></span>
                    <span class="dot-yellow"></span>
                    <span class="dot-green"></span>
                    <span class="window-title">PDF flow Desktop</span>
                  </div>
                  <div class="window-body">
                    <div class="window-sidebar"></div>
                    <div class="window-doc-view">
                      <div class="doc-line line-lg"></div>
                      <div class="doc-line line-md"></div>
                      <div class="doc-stamp-chip">Offline Ready</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="ecosystem-card-body">
                <h3 class="ecosystem-heading">Work offline with Desktop</h3>
                <p class="ecosystem-text">
                  Powerful document tools right on your computer. Batch process hundreds of gigabytes without internet connection.
                </p>
                <a routerLink="/" class="ecosystem-cta-link">
                  <span>Explore Desktop</span>
                  <span class="cta-arrow">↗</span>
                </a>
              </div>
            </div>

            <!-- 2. Mobile Card -->
            <div class="ecosystem-card">
              <div class="card-visual-header mobile-bg">
                <div class="phone-mockup">
                  <div class="phone-camera-notch"></div>
                  <div class="phone-screen">
                    <div class="phone-header-chip">PDF Scanner</div>
                    <div class="phone-doc-thumb">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E53238" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div class="ecosystem-card-body">
                <h3 class="ecosystem-heading">On the go with Mobile</h3>
                <p class="ecosystem-text">
                  Turn your iOS or Android device into a pocket scanner and signature pad. Edit, scan, and send documents anywhere.
                </p>
                <a routerLink="/" class="ecosystem-cta-link">
                  <span>Explore Mobile</span>
                  <span class="cta-arrow">↗</span>
                </a>
              </div>
            </div>

            <!-- 3. Business Card -->
            <div class="ecosystem-card">
              <div class="card-visual-header business-bg">
                <div class="business-mockup">
                  <div class="invoice-badge">APPROVED</div>
                  <div class="invoice-lines">
                    <div class="inv-line"></div>
                    <div class="inv-line short"></div>
                  </div>
                  <div class="signature-stroke">
                    <svg width="70" height="24" viewBox="0 0 100 30" fill="none" stroke="#2563EB" stroke-width="3">
                      <path d="M5 25c15-20 25 5 40-15s20 25 50-10"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div class="ecosystem-card-body">
                <h3 class="ecosystem-heading">Built for business</h3>
                <p class="ecosystem-text">
                  Automate document processing, team management, cryptographic signatures, and enterprise REST API integration.
                </p>
                <a routerLink="/" class="ecosystem-cta-link">
                  <span>Business Solutions</span>
                  <span class="cta-arrow">↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. "GET MORE WITH PREMIUM" HERO CARD -->
      <section class="premium-hero-section">
        <div class="container">
          <div class="premium-banner-card">
            <div class="premium-info-col">
              <div class="premium-badge-tag">PRO WORKFLOWS</div>
              <h2 class="premium-title">Get more with Premium</h2>
              <ul class="premium-perks-list">
                <li>
                  <span class="perk-check">✓</span>
                  <span>Complete access to all 31+ tools with zero file size restrictions</span>
                </li>
                <li>
                  <span class="perk-check">✓</span>
                  <span>High-precision OCR text recognition in 100+ languages</span>
                </li>
                <li>
                  <span class="perk-check">✓</span>
                  <span>Convert scanned documents into fully editable Word & Excel files</span>
                </li>
                <li>
                  <span class="perk-check">✓</span>
                  <span>Unlimited high-speed batch processing directly on your device</span>
                </li>
              </ul>
              <button type="button" class="get-premium-cta-btn">
                <span>Get Premium</span>
                <span class="btn-arrow">➔</span>
              </button>
            </div>

            <div class="premium-visual-col">
              <div class="signed-doc-mockup">
                <div class="doc-mock-head">
                  <span class="mock-tag">Client Project Agreement</span>
                  <span class="mock-status">Verified</span>
                </div>
                <div class="mock-body-lines">
                  <div class="mock-p-line"></div>
                  <div class="mock-p-line"></div>
                  <div class="mock-p-line half"></div>
                </div>
                <div class="mock-sign-row">
                  <div class="mock-sign-mark">Mark Trainer</div>
                  <div class="mock-seal">AES-256</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. CREATIVE IMAGE SUITE SHOWCASE ("Image editing made simple") -->
      <section class="media-suite-section">
        <div class="container">
          <div class="media-suite-card">
            <div class="media-canvas-visual">
              <div class="crop-frame-mockup">
                <div class="crop-corner tl"></div>
                <div class="crop-corner tr"></div>
                <div class="crop-corner bl"></div>
                <div class="crop-corner br"></div>
                <div class="crop-inner-content">
                  <span class="crop-badge">1920 × 1080</span>
                  <div class="flower-icon-wrap">🌸</div>
                </div>
              </div>
            </div>
            <div class="media-info-block">
              <h3 class="media-title">Image editing made simple with PDF flow Media</h3>
              <p class="media-desc">
                Crop, resize, compress, and convert PNG, JPG, and SVG assets into vector PDFs with lossless quality. All running in WebAssembly with 0 cloud storage.
              </p>
              <a routerLink="/images-to-pdf" class="media-cta-btn">
                Explore Media Tools
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. TRUST & COMPLIANCE CERTS ("The PDF software trusted by millions") -->
      <section class="trust-certs-section">
        <div class="container trust-container">
          <h2 class="trust-headline">The PDF software trusted by millions of users</h2>
          <p class="trust-subtitle">
            PDF flow is your number-one web app for editing PDF with more ease. Enjoy all the tools you need to work efficiently with your digital documents while keeping your data safe and secure.
          </p>

          <div class="compliance-badges-row">
            <div class="cert-badge">
              <span class="cert-icon">🛡️</span>
              <div class="cert-text">
                <strong>ISO 27001</strong>
                <span>Certified Security</span>
              </div>
            </div>

            <div class="cert-badge">
              <span class="cert-icon">🔒</span>
              <div class="cert-text">
                <strong>GDPR Compliant</strong>
                <span>Zero Server Logs</span>
              </div>
            </div>

            <div class="cert-badge">
              <span class="cert-icon">⚡</span>
              <div class="cert-text">
                <strong>WebAssembly</strong>
                <span>100% In-Browser</span>
              </div>
            </div>

            <div class="cert-badge">
              <span class="cert-icon">🔑</span>
              <div class="cert-text">
                <strong>AES-256 Bit</strong>
                <span>Hardware Encryption</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    /* 1. CONTINUOUS UNIFIED CANVAS */
    .home-unified-canvas {
      background: #f7f8fa;
      min-height: calc(100vh - 68px);
      padding-top: 56px;
      font-family: 'Outfit', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* HERO HEADER */
    .hero-header {
      text-align: center;
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

    /* FILTER PILLS */
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

    /* 2. 6-COLUMN RESPONSIVE TOOLS GRID */
    .ilove-grid-container {
      margin-bottom: 72px;
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
      padding: 32px;
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

    .tool-new-badge {
      position: absolute;
      top: 14px;
      right: 14px;
      padding: 2px 8px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #3B82F6, #8B5CF6);
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

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

    /* SPECIAL WORKFLOW HIGHLIGHT CARD */
    .workflow-highlight-card {
      background: linear-gradient(135deg, #FFF1F2 0%, #FFFBEB 100%);
      border: 1.5px dashed #FDA4AF;
      border-radius: 18px;
      padding: 26px 22px;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      min-height: 220px;
      transition: all 0.22s ease;
      position: relative;
    }
    .workflow-highlight-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 14px 28px -4px rgba(225, 29, 72, 0.15);
      border-color: #F43F5E;
    }
    .workflow-header-pill {
      align-self: flex-start;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #BE123C;
      background: #FFE4E6;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .workflow-icon-group {
      margin-bottom: 14px;
    }
    .workflow-title {
      font-size: 18px;
      font-weight: 800;
      color: #9F1239;
      margin: 0 0 8px;
    }
    .workflow-desc {
      font-size: 12.5px;
      color: #881337;
      line-height: 1.5;
      margin: 0 0 16px;
    }
    .workflow-action-link {
      margin-top: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 800;
      color: #BE123C;
    }
    .workflow-arrow {
      transition: transform 0.2s ease;
    }
    .workflow-highlight-card:hover .workflow-arrow {
      transform: translateX(4px);
    }

    /* 3. WORK YOUR WAY (ECOSYSTEM SECTION) */
    .work-your-way-section {
      padding: 72px 0;
      background: #ffffff;
      border-top: 1px solid #eef0f3;
    }
    .section-center-head {
      text-align: center;
      margin-bottom: 48px;
    }
    .section-title-large {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111827;
      margin: 0 0 10px;
    }
    .section-subtitle-muted {
      font-size: 16px;
      color: #64748b;
      margin: 0;
    }
    .ecosystem-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 28px;
    }
    .ecosystem-card {
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
    }
    .ecosystem-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
    .card-visual-header {
      height: 190px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .desktop-bg { background: linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%); }
    .mobile-bg  { background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); }
    .business-bg{ background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); }

    /* Visual Mockups */
    .window-mockup {
      width: 200px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .window-topbar {
      height: 20px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .dot-red { width: 6px; height: 6px; border-radius: 50%; background: #EF4444; }
    .dot-yellow { width: 6px; height: 6px; border-radius: 50%; background: #F59E0B; }
    .dot-green { width: 6px; height: 6px; border-radius: 50%; background: #10B981; }
    .window-title { font-size: 8px; color: #64748b; font-weight: 600; margin-left: auto; }
    .window-body {
      display: flex;
      height: 90px;
    }
    .window-sidebar { width: 40px; background: #f8fafc; border-right: 1px solid #f1f5f9; }
    .window-doc-view {
      flex: 1;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .doc-line { height: 6px; border-radius: 3px; background: #e2e8f0; }
    .line-lg { width: 85%; }
    .line-md { width: 60%; }
    .doc-stamp-chip {
      margin-top: auto;
      font-size: 8px;
      font-weight: 700;
      color: #059669;
      background: #D1FAE5;
      padding: 2px 6px;
      border-radius: 4px;
      align-self: flex-start;
    }

    .phone-mockup {
      width: 100px;
      height: 150px;
      background: #1e293b;
      border-radius: 16px;
      padding: 5px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
    }
    .phone-camera-notch {
      width: 30px;
      height: 4px;
      border-radius: 2px;
      background: #0f172a;
      align-self: center;
      margin-bottom: 4px;
    }
    .phone-screen {
      flex: 1;
      background: #ffffff;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px;
    }
    .phone-header-chip { font-size: 9px; font-weight: 800; color: #2563EB; }

    .business-mockup {
      width: 180px;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      padding: 16px;
      border: 1px solid #e2e8f0;
      position: relative;
    }
    .invoice-badge {
      font-size: 8px;
      font-weight: 900;
      color: #059669;
      background: #D1FAE5;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 8px;
    }
    .invoice-lines {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }
    .inv-line { height: 5px; background: #e2e8f0; border-radius: 3px; width: 80%; }
    .inv-line.short { width: 50%; }

    .ecosystem-card-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .ecosystem-heading {
      font-size: 19px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 10px;
    }
    .ecosystem-text {
      font-size: 14px;
      color: #64748b;
      line-height: 1.55;
      margin: 0 0 20px;
    }
    .ecosystem-cta-link {
      margin-top: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 700;
      color: #E53238;
      text-decoration: none;
    }
    .cta-arrow { font-size: 16px; transition: transform 0.2s ease; }
    .ecosystem-card:hover .cta-arrow { transform: translate(3px, -3px); }

    /* 4. "GET MORE WITH PREMIUM" SECTION */
    .premium-hero-section {
      padding: 64px 0;
      background: #f7f8fa;
    }
    .premium-banner-card {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
      border: 1px solid #FCD34D;
      border-radius: 24px;
      padding: 48px;
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 40px;
      align-items: center;
      box-shadow: 0 10px 30px -5px rgba(217, 119, 6, 0.12);
    }
    .premium-badge-tag {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #92400E;
      background: rgba(255, 255, 255, 0.6);
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 12px;
    }
    .premium-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #78350F;
      margin: 0 0 20px;
    }
    .premium-perks-list {
      list-style: none;
      padding: 0;
      margin: 0 0 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .premium-perks-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14.5px;
      font-weight: 600;
      color: #92400E;
    }
    .perk-check {
      color: #059669;
      font-weight: 900;
      font-size: 16px;
    }
    .get-premium-cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #D97706;
      color: #ffffff;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 800;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
      transition: all 0.2s ease;
    }
    .get-premium-cta-btn:hover {
      background: #B45309;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(217, 119, 6, 0.4);
    }

    .signed-doc-mockup {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.08);
      padding: 24px;
      border: 1px solid #f1f5f9;
    }
    .doc-mock-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .mock-tag { font-size: 13px; font-weight: 800; color: #1e293b; }
    .mock-status { font-size: 11px; font-weight: 700; color: #059669; background: #D1FAE5; padding: 2px 8px; border-radius: 9999px; }
    .mock-body-lines {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }
    .mock-p-line { height: 7px; background: #f1f5f9; border-radius: 4px; width: 100%; }
    .mock-p-line.half { width: 55%; }
    .mock-sign-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
    }
    .mock-sign-mark { font-family: cursive; font-size: 18px; color: #2563EB; font-weight: 700; }
    .mock-seal { font-size: 10px; font-weight: 800; color: #64748b; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; }

    /* 5. MEDIA SUITE SECTION */
    .media-suite-section {
      padding: 64px 0;
      background: #ffffff;
      border-top: 1px solid #eef0f3;
    }
    .media-suite-card {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 48px;
      align-items: center;
    }
    .media-canvas-visual {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      height: 240px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .crop-frame-mockup {
      width: 180px;
      height: 140px;
      border: 2px dashed #3B82F6;
      position: relative;
      background: rgba(59, 130, 246, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .crop-corner {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #3B82F6;
    }
    .tl { top: -5px; left: -5px; }
    .tr { top: -5px; right: -5px; }
    .bl { bottom: -5px; left: -5px; }
    .br { bottom: -5px; right: -5px; }
    .crop-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      font-size: 9px;
      font-weight: 800;
      background: #3B82F6;
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .flower-icon-wrap { font-size: 40px; }

    .media-title {
      font-size: 26px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 14px;
    }
    .media-desc {
      font-size: 15px;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .media-cta-btn {
      display: inline-flex;
      align-items: center;
      padding: 12px 24px;
      border-radius: 10px;
      background: #E53238;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 4px 12px rgba(229, 50, 56, 0.25);
      transition: all 0.2s ease;
    }
    .media-cta-btn:hover {
      background: #d3282e;
      transform: translateY(-2px);
    }

    /* 6. TRUST & COMPLIANCE SECTION */
    .trust-certs-section {
      padding: 72px 0 88px;
      background: #f7f8fa;
      border-top: 1px solid #eef0f3;
    }
    .trust-container {
      text-align: center;
      max-width: 860px;
      margin: 0 auto;
    }
    .trust-headline {
      font-size: 28px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 12px;
    }
    .trust-subtitle {
      font-size: 15px;
      color: #64748b;
      line-height: 1.6;
      margin: 0 auto 40px;
    }
    .compliance-badges-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .cert-badge {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }
    .cert-icon { font-size: 22px; }
    .cert-text {
      display: flex;
      flex-direction: column;
      text-align: left;
    }
    .cert-text strong {
      font-size: 13.5px;
      color: #1e293b;
    }
    .cert-text span {
      font-size: 11px;
      color: #64748b;
    }

    /* RESPONSIVE LAYOUT BREAKPOINTS */
    @media (max-width: 1400px) {
      .ilove-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    @media (max-width: 1024px) {
      .ilove-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .ecosystem-cards-grid {
        grid-template-columns: 1fr;
      }
      .premium-banner-card {
        grid-template-columns: 1fr;
        padding: 32px 24px;
      }
      .media-suite-card {
        grid-template-columns: 1fr;
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
      canonical: 'https://pdfflow.app',
      faqs: []
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
      return all.filter(t => ['merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'protect-pdf', 'organize-pdf'].includes(t.id));
    }
    if (tab === 'intelligence') {
      return all.filter(t => t.category === 'intelligence' || ['ocr-pdf', 'pdf-to-word', 'word-to-pdf', 'pdf-to-excel'].includes(t.id));
    }
    return this.toolRegistry.filteredTools();
  }
}
