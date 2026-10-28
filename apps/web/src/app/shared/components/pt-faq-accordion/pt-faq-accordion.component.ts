import { Component, input, signal } from '@angular/core';

export interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-pt-faq-accordion',
  standalone: true,
  template: `
    <div class="pt-faq-accordion" role="region" aria-label="Frequently Asked Questions">
      @for (item of items(); track item.question; let idx = $index) {
        <div class="faq-item" [class.is-expanded]="expandedIndex() === idx">
          <button
            type="button"
            class="faq-trigger"
            (click)="toggle(idx)"
            [attr.aria-expanded]="expandedIndex() === idx"
            [attr.aria-controls]="'faq-panel-' + idx"
            [id]="'faq-header-' + idx"
          >
            <span class="faq-question">{{ item.question }}</span>
            <span class="faq-icon-wrap" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="faq-chevron" [class.rotated]="expandedIndex() === idx">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </button>
          @if (expandedIndex() === idx) {
            <div
              class="faq-panel"
              [id]="'faq-panel-' + idx"
              [attr.aria-labelledby]="'faq-header-' + idx"
              role="region"
            >
              <p class="faq-answer">{{ item.answer }}</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .pt-faq-accordion {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 860px;
      margin: 0 auto;
    }

    .faq-item {
      background: var(--pt-bg, #ffffff);
      border: 1px solid var(--pt-soft-outline, #E4E7EC);
      border-radius: var(--pt-radius-lg, 12px);
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .faq-item.is-expanded {
      border-color: var(--pt-teal-100, #CCEBE6);
      box-shadow: var(--pt-shadow-sm, 0 1px 3px rgba(16, 24, 40, 0.08));
    }

    .faq-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 24px;
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;
    }

    .faq-question {
      font-family: var(--pt-font-heading);
      font-size: 16px;
      font-weight: 600;
      color: var(--pt-navy, #14213D);
      line-height: 1.4;
    }

    .faq-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--pt-radius-full, 9999px);
      background: var(--pt-teal-50, #ECF7F5);
      color: var(--pt-teal-700, #0F766E);
      flex-shrink: 0;
    }

    .faq-chevron {
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .faq-chevron.rotated {
      transform: rotate(180deg);
    }

    .faq-panel {
      padding: 0 24px 20px;
      animation: faqSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .faq-answer {
      font-family: var(--pt-font-body);
      font-size: 14.5px;
      line-height: 1.65;
      color: var(--pt-muted, #475467);
      margin: 0;
    }

    @keyframes faqSlideDown {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class PtFaqAccordionComponent {
  readonly items = input.required<FaqItem[]>();
  readonly expandedIndex = signal<number | null>(0);

  toggle(index: number): void {
    if (this.expandedIndex() === index) {
      this.expandedIndex.set(null);
    } else {
      this.expandedIndex.set(index);
    }
  }
}
