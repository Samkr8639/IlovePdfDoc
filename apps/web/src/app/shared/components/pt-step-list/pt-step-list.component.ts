import { Component, input } from '@angular/core';

export interface StepItem {
  number: number | string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-pt-step-list',
  standalone: true,
  template: `
    <div class="pt-step-list">
      @for (step of steps(); track step.number; let last = $last) {
        <div class="step-card">
          <div class="step-badge">{{ step.number }}</div>
          <div class="step-body">
            <h4 class="step-title">{{ step.title }}</h4>
            <p class="step-desc">{{ step.description }}</p>
          </div>
          @if (!last) {
            <div class="step-connector" aria-hidden="true"></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .pt-step-list {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      position: relative;
    }

    .step-card {
      position: relative;
      background: var(--pt-bg, #ffffff);
      border: 1px solid var(--pt-soft-outline, #E4E7EC);
      border-radius: var(--pt-radius-lg, 12px);
      padding: 28px 24px;
      box-shadow: var(--pt-shadow-sm, 0 1px 3px rgba(16, 24, 40, 0.08));
    }

    .step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--pt-radius-md, 8px);
      background: var(--pt-teal-700, #0F766E);
      color: #ffffff;
      font-family: var(--pt-font-heading);
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 16px;
    }

    .step-title {
      font-family: var(--pt-font-heading);
      font-size: 16px;
      font-weight: 700;
      color: var(--pt-navy, #14213D);
      margin: 0 0 8px;
    }

    .step-desc {
      font-family: var(--pt-font-body);
      font-size: 14px;
      line-height: 1.55;
      color: var(--pt-muted, #475467);
      margin: 0;
    }

    @media (max-width: 768px) {
      .pt-step-list {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }
  `]
})
export class PtStepListComponent {
  readonly steps = input<StepItem[]>([
    {
      number: 1,
      title: 'Select PDF Documents',
      description: 'Upload your file directly from your computer, Google Drive, or Dropbox.'
    },
    {
      number: 2,
      title: 'Tailor Options',
      description: 'Configure pages, compression level, or conversion layout to fit your exact needs.'
    },
    {
      number: 3,
      title: 'Download & Save',
      description: 'Get your tailored PDF instantly with ephemeral zero-retention guarantee.'
    }
  ]);
}
