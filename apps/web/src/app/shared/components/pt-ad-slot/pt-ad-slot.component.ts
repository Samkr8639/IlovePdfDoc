import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-pt-ad-slot',
  standalone: true,
  template: `
    @if (isEnabled()) {
      <aside
        class="pt-ad-container"
        [class]="'ad-' + slotType()"
        role="complementary"
        aria-label="Advertisement"
      >
        <div class="ad-inner">
          <span class="ad-label">ADVERTISEMENT</span>
          <div class="ad-placeholder-content">
            <ng-content></ng-content>
          </div>
        </div>
      </aside>
    }
  `,
  styles: [`
    .pt-ad-container {
      width: 100%;
      display: flex;
      justify-content: center;
      margin: 24px auto;
      contain: layout style;
    }

    .ad-inner {
      width: 100%;
      max-width: 970px;
      min-height: 90px;
      background: var(--pt-subtle-bg, #F6F8FA);
      border: 1px dashed var(--pt-outline, #D0D5DD);
      border-radius: var(--pt-radius-md, 8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 12px;
    }

    .ad-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--pt-muted-light, #667085);
      position: absolute;
      top: 4px;
      right: 8px;
    }

    .ad-placeholder-content {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ad-rectangle .ad-inner {
      max-width: 336px;
      min-height: 280px;
    }

    .ad-banner .ad-inner {
      max-width: 728px;
      min-height: 90px;
    }

    .ad-leaderboard .ad-inner {
      max-width: 970px;
      min-height: 90px;
    }

    @media (max-width: 768px) {
      .ad-inner {
        min-height: 60px;
      }
    }
  `]
})
export class PtAdSlotComponent {
  readonly slotType = input<'leaderboard' | 'rectangle' | 'banner'>('leaderboard');
  readonly isEnabled = signal<boolean>(true);
}
