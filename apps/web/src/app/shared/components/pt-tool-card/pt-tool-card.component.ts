import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-pt-tool-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a [routerLink]="route()" class="pt-tool-card" [class.is-live]="isLive()">
      <div class="card-top-row">
        <div class="icon-tile" [class.tile-live]="isLive()">
          <ng-content select="[card-icon]"></ng-content>
        </div>
        @if (badge()) {
          <span class="tool-badge" [class.badge-live]="isLive()" [class.badge-soon]="!isLive()">
            {{ badge() }}
          </span>
        }
      </div>

      <h3 class="tool-title">{{ title() }}</h3>
      <p class="tool-desc">{{ description() }}</p>

      <div class="card-action-cue" aria-hidden="true">
        <span>{{ isLive() ? 'Open Tool' : 'Coming Soon' }}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </div>
    </a>
  `,
  styles: [`
    .pt-tool-card {
      display: flex;
      flex-direction: column;
      background: var(--pt-bg, #ffffff);
      border: 1px solid var(--pt-soft-outline, #E4E7EC);
      border-radius: var(--pt-radius-lg, 12px);
      padding: 24px;
      text-decoration: none;
      box-shadow: var(--pt-shadow-card, 0 1px 3px rgba(16, 24, 40, 0.06));
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      height: 100%;
    }

    .pt-tool-card:hover {
      border-color: var(--pt-teal-100, #CCEBE6);
      transform: translateY(-3px);
      box-shadow: var(--pt-shadow-card-hover, 0 10px 20px -3px rgba(15, 118, 110, 0.1));
    }

    .card-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .icon-tile {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--pt-radius-md, 8px);
      background: var(--pt-teal-50, #ECF7F5);
      color: var(--pt-teal-700, #0F766E);
      transition: transform 0.2s ease;
    }

    .pt-tool-card:hover .icon-tile {
      transform: scale(1.05);
    }

    .icon-tile.tile-live {
      background: var(--pt-teal-100, #CCEBE6);
      color: var(--pt-teal-800, #0B5D57);
    }

    .tool-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--pt-radius-full, 9999px);
      letter-spacing: 0.02em;
    }

    .badge-live {
      background: var(--pt-teal-50, #ECF7F5);
      color: var(--pt-teal-700, #0F766E);
      border: 1px solid var(--pt-teal-100, #CCEBE6);
    }

    .badge-soon {
      background: var(--pt-amber-50, #FFFBEB);
      color: var(--pt-amber-700, #B45309);
      border: 1px solid var(--pt-amber-100, #FEF3C7);
    }

    .tool-title {
      font-family: var(--pt-font-heading);
      font-size: 17px;
      font-weight: 700;
      color: var(--pt-navy, #14213D);
      margin: 0 0 8px;
      line-height: 1.35;
      letter-spacing: -0.01em;
    }

    .tool-desc {
      font-family: var(--pt-font-body);
      font-size: 13.5px;
      line-height: 1.55;
      color: var(--pt-muted, #475467);
      margin: 0 0 18px;
      flex: 1;
    }

    .card-action-cue {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--pt-teal-700, #0F766E);
      transition: gap 0.2s ease;
      margin-top: auto;
    }

    .pt-tool-card:hover .card-action-cue {
      gap: 9px;
    }

    .pt-tool-card:not(.is-live) .card-action-cue {
      color: var(--pt-muted-light, #667085);
    }
  `]
})
export class PtToolCardComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly route = input.required<string>();
  readonly badge = input<string>('');
  readonly isLive = input<boolean>(false);
}
