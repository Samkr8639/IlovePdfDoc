import { Component, input } from '@angular/core';

@Component({
  selector: 'app-pt-badge',
  standalone: true,
  template: `
    <span class="pt-badge" [class]="'badge-' + variant() + ' badge-' + size()">
      <ng-content></ng-content>
    </span>
  `,
  styles: [`
    .pt-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: var(--pt-font-body);
      font-weight: 700;
      border-radius: var(--pt-radius-full, 9999px);
      letter-spacing: 0.02em;
      line-height: 1;
      white-space: nowrap;
    }

    .badge-sm {
      font-size: 11px;
      padding: 3px 8px;
    }

    .badge-md {
      font-size: 12px;
      padding: 5px 12px;
    }

    .badge-teal {
      background: var(--pt-teal-50, #ECF7F5);
      color: var(--pt-teal-700, #0F766E);
      border: 1px solid var(--pt-teal-100, #CCEBE6);
    }

    .badge-navy {
      background: var(--pt-teal-100, #CCEBE6);
      color: var(--pt-navy, #14213D);
      border: 1px solid rgba(20, 33, 61, 0.15);
    }

    .badge-amber {
      background: var(--pt-amber-50, #FFFBEB);
      color: var(--pt-amber-700, #B45309);
      border: 1px solid var(--pt-amber-100, #FEF3C7);
    }

    .badge-success {
      background: var(--pt-success-50, #F0FDF4);
      color: var(--pt-success, #15803D);
      border: 1px solid rgba(21, 128, 61, 0.2);
    }

    .badge-outline {
      background: transparent;
      color: var(--pt-navy, #14213D);
      border: 1px solid var(--pt-outline, #D0D5DD);
    }
  `]
})
export class PtBadgeComponent {
  readonly variant = input<'teal' | 'navy' | 'amber' | 'success' | 'outline'>('teal');
  readonly size = input<'sm' | 'md'>('sm');
}
