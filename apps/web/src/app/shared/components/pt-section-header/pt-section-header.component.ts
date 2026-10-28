import { Component, input } from '@angular/core';

@Component({
  selector: 'app-pt-section-header',
  standalone: true,
  template: `
    <div class="pt-section-header" [class.align-left]="align() === 'left'">
      @if (eyebrow()) {
        <span class="eyebrow-text">{{ eyebrow() }}</span>
      }
      <h2 class="section-headline">{{ headline() }}</h2>
      @if (subtext()) {
        <p class="section-subtext">{{ subtext() }}</p>
      }
    </div>
  `,
  styles: [`
    .pt-section-header {
      text-align: center;
      max-width: 760px;
      margin: 0 auto 40px;
    }

    .pt-section-header.align-left {
      text-align: left;
      margin-left: 0;
      margin-right: 0;
    }

    .eyebrow-text {
      display: inline-block;
      font-family: var(--pt-font-body);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--pt-teal-700, #0F766E);
      margin-bottom: 12px;
    }

    .section-headline {
      font-family: var(--pt-font-heading);
      font-size: clamp(26px, 3.5vw, 38px);
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: -0.02em;
      color: var(--pt-navy, #14213D);
      margin: 0 0 14px;
    }

    .section-subtext {
      font-family: var(--pt-font-body);
      font-size: 16px;
      line-height: 1.6;
      color: var(--pt-muted, #475467);
      margin: 0;
    }

    @media (max-width: 640px) {
      .pt-section-header {
        margin-bottom: 28px;
      }
      .section-subtext {
        font-size: 14.5px;
      }
    }
  `]
})
export class PtSectionHeaderComponent {
  readonly eyebrow = input<string>('');
  readonly headline = input.required<string>();
  readonly subtext = input<string>('');
  readonly align = input<'center' | 'left'>('center');
}
