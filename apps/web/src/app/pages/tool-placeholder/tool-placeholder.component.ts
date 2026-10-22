import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { ToolDefinition } from '@paperflow/contracts';

@Component({
  selector: 'app-tool-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (tool(); as t) {
      <div class="tool-page">
        <section class="tool-header-section">
          <div class="container tool-header-container">
            <nav class="breadcrumbs" aria-label="Breadcrumb">
              <a routerLink="/" class="crumb-link">Home</a>
              <span class="crumb-sep">/</span>
              <span class="crumb-cat">{{ t.category }}</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-current">{{ t.name }}</span>
            </nav>

            <div class="badge-tag status-badge">
              <span>{{ t.badgeText || 'Planned Feature' }}</span>
            </div>

            <h1 class="tool-h1">{{ t.name }}</h1>
            <p class="tool-lead">{{ t.longDescription }}</p>
          </div>
        </section>

        <section class="placeholder-section">
          <div class="container placeholder-container">
            <div class="placeholder-card card-clean">
              <div class="placeholder-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>

              <h3 class="placeholder-title">{{ t.name }} is in active development</h3>
              <p class="placeholder-text">
                This feature is scheduled for Phase 2 of our local-first roadmap.
                We believe in publishing features only when they genuinely execute real files without paid third-party dependencies.
              </p>

              <div class="placeholder-actions">
                <a routerLink="/merge-pdf" class="btn-primary">
                  <span>Try Working Merge PDF Tool</span>
                </a>
                <a routerLink="/" class="btn-secondary">
                  <span>Browse All Available Tools</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    .tool-header-section {
      padding: 48px 0 32px;
      text-align: center;
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border);
    }
    .tool-header-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 780px;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .crumb-link:hover { color: var(--primary-600); }
    .crumb-sep { color: var(--text-light); }
    .crumb-current { color: var(--text-main); font-weight: 600; }
    .status-badge { margin-bottom: 16px; font-size: 12px; }
    .tool-h1 {
      font-size: clamp(28px, 4vw, 42px);
      font-weight: 800;
      color: var(--text-main);
    }
    .tool-lead {
      font-size: 16px;
      color: var(--text-muted);
      margin-top: 12px;
      line-height: 1.6;
    }
    .placeholder-section {
      padding: 64px 0;
    }
    .placeholder-container {
      max-width: 620px;
    }
    .placeholder-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 48px 32px;
      gap: 20px;
    }
    .placeholder-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--amber-50);
      color: var(--amber-600);
    }
    .placeholder-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
    }
    .placeholder-text {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .placeholder-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
  `]
})
export class ToolPlaceholderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);

  tool = signal<ToolDefinition | null>(null);

  ngOnInit(): void {
    const routePath = this.route.snapshot.routeConfig?.path || '';
    const foundTool = this.toolRegistry.getToolByRoute(`/${routePath}`);
    if (foundTool) {
      this.tool.set(foundTool);
      this.seo.setSeoData(foundTool.seo);
    }
  }
}
