import { Component, input, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToolRegistryService } from '../../../core/services/tool-registry.service';
import { TOOL_REGISTRY, ToolDefinition } from '@paperflow/contracts';

const RELATED_MAP: Record<string, string[]> = {
  'sign-pdf': ['edit-pdf', 'merge-pdf', 'jpg-to-pdf', 'pdf-to-word'],
  'edit-pdf': ['sign-pdf', 'merge-pdf', 'pdf-to-jpg', 'word-to-pdf'],
  'merge-pdf': ['split-pdf', 'compress-pdf', 'edit-pdf', 'sign-pdf'],
  'jpg-to-pdf': ['pdf-to-jpg', 'merge-pdf', 'edit-pdf', 'sign-pdf'],
  'pdf-to-jpg': ['jpg-to-pdf', 'edit-pdf', 'merge-pdf', 'pdf-to-word'],
  'word-to-pdf': ['pdf-to-word', 'merge-pdf', 'edit-pdf', 'sign-pdf'],
  'pdf-to-word': ['word-to-pdf', 'edit-pdf', 'merge-pdf', 'pdf-to-excel'],
  'excel-to-pdf': ['pdf-to-excel', 'word-to-pdf', 'merge-pdf', 'edit-pdf'],
  'pdf-to-excel': ['excel-to-pdf', 'pdf-to-word', 'edit-pdf', 'merge-pdf'],
  'powerpoint-to-pdf': ['pdf-to-powerpoint', 'word-to-pdf', 'merge-pdf', 'edit-pdf'],
  'pdf-to-powerpoint': ['powerpoint-to-pdf', 'pdf-to-word', 'edit-pdf', 'merge-pdf'],
  'split-pdf': ['merge-pdf', 'compress-pdf', 'edit-pdf', 'sign-pdf'],
  'compress-pdf': ['merge-pdf', 'edit-pdf', 'pdf-to-jpg', 'sign-pdf']
};

@Component({
  selector: 'app-explore-more-tools',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="explore-tools-section" aria-label="Explore more PDF tools">
      <div class="container">
        <div class="explore-header text-center">
          <h2 class="explore-title">Explore more PDF tools</h2>
          <p class="explore-subtitle">Everything you need to edit, convert, sign, and organize PDFs in one place.</p>
        </div>

        <div class="explore-grid">
          @for (tool of relatedTools(); track tool.id) {
            <a [routerLink]="tool.route" class="explore-card">
              <div class="card-top">
                <div class="icon-tile" [attr.data-tool]="tool.id">
                  @switch (tool.id) {
                    @case ('edit-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    }
                    @case ('sign-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    }
                    @case ('merge-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                      </svg>
                    }
                    @case ('split-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="6" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                        <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                        <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                      </svg>
                    }
                    @case ('compress-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="4 14 10 14 10 20"></polyline>
                        <polyline points="20 10 14 10 14 4"></polyline>
                        <line x1="14" y1="10" x2="21" y2="3"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                      </svg>
                    }
                    @case ('jpg-to-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    }
                    @case ('pdf-to-jpg') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    }
                    @case ('word-to-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    }
                    @case ('pdf-to-word') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    }
                    @case ('excel-to-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                      </svg>
                    }
                    @case ('pdf-to-excel') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                      </svg>
                    }
                    @case ('powerpoint-to-pdf') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                      </svg>
                    }
                    @case ('pdf-to-powerpoint') {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                      </svg>
                    }
                    @default {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    }
                  }
                </div>
                <span class="tool-tag">Free</span>
              </div>

              <div class="card-content">
                <h3 class="tool-title">{{ tool.name }}</h3>
                <p class="tool-desc">{{ tool.shortDescription }}</p>
              </div>

              <div class="card-footer">
                <span class="action-text">Open Tool</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            </a>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .explore-tools-section {
      width: 100%;
      padding: 64px 0 80px;
      background: var(--pt-bg-subtle, #f8fafc);
      border-top: 1px solid var(--pt-soft-outline, #e2e8f0);
      margin-top: 48px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
    }

    .text-center {
      text-align: center;
    }

    .explore-header {
      margin-bottom: 40px;
    }

    .explore-title {
      font-size: 28px;
      font-weight: 800;
      color: var(--pt-navy, #0f172a);
      letter-spacing: -0.02em;
      margin: 0 0 10px;
      line-height: 1.25;
    }

    .explore-subtitle {
      font-size: 15px;
      color: var(--pt-muted, #64748b);
      margin: 0;
      line-height: 1.5;
    }

    .explore-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 22px;
    }

    .explore-card {
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border: 1px solid var(--pt-soft-outline, #e2e8f0);
      border-radius: var(--pt-radius-lg, 14px);
      padding: 24px;
      text-decoration: none;
      box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05), 0 8px 24px -4px rgba(15, 118, 110, 0.04);
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      height: 100%;
    }

    .explore-card:hover {
      border-color: var(--pt-teal-100, #ccebe6);
      transform: translateY(-3px);
      box-shadow: 0 10px 24px -4px rgba(15, 118, 110, 0.12);
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .icon-tile {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--pt-radius-md, 10px);
      background: var(--pt-teal-50, #ecf7f5);
      color: var(--pt-teal-700, #0f766e);
      transition: transform 0.2s ease;
    }

    .explore-card:hover .icon-tile {
      transform: scale(1.06);
    }

    .icon-tile[data-tool="edit-pdf"],
    .icon-tile[data-tool="sign-pdf"] {
      background: #ecfdf5;
      color: #059669;
    }

    .icon-tile[data-tool="word-to-pdf"],
    .icon-tile[data-tool="pdf-to-word"] {
      background: #eff6ff;
      color: #2563eb;
    }

    .icon-tile[data-tool="excel-to-pdf"],
    .icon-tile[data-tool="pdf-to-excel"] {
      background: #f0fdf4;
      color: #16a34a;
    }

    .icon-tile[data-tool="powerpoint-to-pdf"],
    .icon-tile[data-tool="pdf-to-powerpoint"] {
      background: #fff7ed;
      color: #ea580c;
    }

    .icon-tile[data-tool="jpg-to-pdf"],
    .icon-tile[data-tool="pdf-to-jpg"] {
      background: #faf5ff;
      color: #9333ea;
    }

    .tool-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      background: var(--pt-teal-50, #ecf7f5);
      color: var(--pt-teal-700, #0f766e);
      border: 1px solid var(--pt-teal-100, #ccebe6);
      letter-spacing: 0.02em;
    }

    .card-content {
      flex: 1;
      margin-bottom: 16px;
    }

    .tool-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--pt-navy, #0f172a);
      margin: 0 0 8px;
      line-height: 1.35;
    }

    .tool-desc {
      font-size: 13.5px;
      color: var(--pt-muted, #64748b);
      margin: 0;
      line-height: 1.5;
    }

    .card-footer {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--pt-teal-700, #0f766e);
      margin-top: auto;
      transition: gap 0.2s ease;
    }

    .explore-card:hover .card-footer {
      gap: 9px;
      color: var(--pt-teal-800, #0b5d57);
    }

    @media (max-width: 1024px) {
      .explore-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .explore-tools-section {
        padding: 48px 0 60px;
        margin-top: 36px;
      }
      .explore-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
      .explore-title {
        font-size: 22px;
      }
    }
  `]
})
export class ExploreMoreToolsComponent {
  readonly currentTool = input.required<string>();
  private readonly toolRegistry = inject(ToolRegistryService, { optional: true });

  readonly relatedTools = computed<ToolDefinition[]>(() => {
    const cur = this.currentTool();
    const targeted = RELATED_MAP[cur];
    const all = (typeof this.toolRegistry?.getAllTools === 'function')
      ? this.toolRegistry.getAllTools()
      : TOOL_REGISTRY;

    if (targeted && targeted.length > 0) {
      const list: ToolDefinition[] = [];
      for (const id of targeted) {
        const found = all.find(t => t.id === id);
        if (found) list.push(found);
      }
      if (list.length >= 4) return list.slice(0, 4);
    }

    // Fallback: pick 4 live tools different from currentTool
    return all.filter(t => t.id !== cur).slice(0, 4);
  });
}
