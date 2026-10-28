import { Component, input } from '@angular/core';

@Component({
  selector: 'app-pt-workspace-layout',
  standalone: true,
  template: `
    <div class="pt-workspace-shell">
      <main class="workspace-canvas" role="region" [attr.aria-label]="canvasAriaLabel()">
        <ng-content select="[workspace-canvas]"></ng-content>
      </main>

      <aside class="workspace-panel" role="complementary" [attr.aria-label]="panelAriaLabel()">
        <ng-content select="[workspace-panel]"></ng-content>
      </aside>
    </div>
  `,
  styles: [`
    .pt-workspace-shell {
      display: flex;
      width: 100%;
      height: calc(100vh - var(--header-height, 64px));
      overflow: hidden;
      background: var(--pt-subtle-bg, #F6F8FA);
    }

    .workspace-canvas {
      flex: 1;
      height: 100%;
      overflow-y: auto;
      padding: 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .workspace-panel {
      width: 360px;
      flex-shrink: 0;
      height: 100%;
      background: var(--pt-bg, #ffffff);
      border-left: 1px solid var(--pt-soft-outline, #E4E7EC);
      box-shadow: -2px 0 8px rgba(16, 24, 40, 0.04);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      z-index: 10;
    }

    @media (max-width: 1024px) {
      .workspace-panel {
        width: 320px;
      }
      .workspace-canvas {
        padding: 20px;
      }
    }

    @media (max-width: 768px) {
      .pt-workspace-shell {
        flex-direction: column;
        height: auto;
        min-height: calc(100vh - var(--header-height-mobile, 56px));
        overflow: visible;
      }

      .workspace-canvas {
        height: auto;
        overflow: visible;
        padding: 16px;
      }

      .workspace-panel {
        width: 100%;
        height: auto;
        border-left: none;
        border-top: 1px solid var(--pt-soft-outline, #E4E7EC);
        box-shadow: 0 -4px 12px rgba(16, 24, 40, 0.06);
      }
    }
  `]
})
export class PtWorkspaceLayoutComponent {
  readonly canvasAriaLabel = input<string>('Document editing workspace');
  readonly panelAriaLabel = input<string>('Tool action options');
}
