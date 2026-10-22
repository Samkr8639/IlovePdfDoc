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
          <div class="tool-ambient-glow"></div>
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

            <h1 class="tool-h1">{{ t.name.toUpperCase() }}</h1>
            <p class="tool-lead">{{ t.longDescription }}</p>
          </div>
        </section>

        <section class="placeholder-section">
          <div class="container placeholder-container">
            <div class="placeholder-card card-clean">
              <div class="placeholder-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>

              <h3 class="placeholder-title">{{ t.name }} is coming soon</h3>
              <p class="placeholder-text">
                This feature is scheduled for Phase 2 of our local-first roadmap.
                We ensure that all document operations execute 100% in-browser with complete privacy and zero third-party dependencies.
              </p>

              <div class="placeholder-actions">
                <a routerLink="/merge-pdf" class="btn-primary">
                  <span>Try Working Merge PDF Tool</span>
                </a>
                <a routerLink="/" class="btn-blush">
                  <span>Browse All Services</span>
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
      position: relative;
      padding: 56px 0 36px;
      text-align: center;
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border);
      overflow: hidden;
    }
    .tool-ambient-glow {
      position: absolute;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 300px;
      background: radial-gradient(circle, rgba(229, 57, 53, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    .tool-header-container {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 800px;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 18px;
    }
    .crumb-link:hover { color: var(--coral-600); }
    .crumb-sep { color: var(--text-light); }
    .crumb-current { color: var(--text-main); font-weight: 600; }
    .status-badge { margin-bottom: 18px; font-size: 11px; }
    .tool-h1 {
      font-size: clamp(32px, 4.5vw, 44px);
      font-weight: 800;
      letter-spacing: 0.03em;
      color: var(--text-main);
      font-family: var(--font-display);
      margin: 0;
    }
    .tool-lead {
      font-size: 16px;
      color: var(--text-muted);
      margin-top: 14px;
      line-height: 1.6;
      font-weight: 500;
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
      padding: 56px 36px;
      gap: 20px;
      background: #ffffff;
      border-radius: var(--radius-2xl);
    }
    .placeholder-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--coral-100);
      color: var(--coral-600);
    }
    .placeholder-title {
      font-size: 22px;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--text-main);
      margin: 0;
    }
    .placeholder-text {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      margin: 0;
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
