import { Component, input } from '@angular/core';

@Component({
  selector: 'app-processing-state',
  template: `
    <div class="dribbble-processing-card">
      <!-- 3 PULSING CORAL DOTS (Exact Dribbble video animation) -->
      <div class="pulsing-dots-wrapper">
        <span class="pulse-dot dot-1"></span>
        <span class="pulse-dot dot-2"></span>
        <span class="pulse-dot dot-3"></span>
      </div>

      <!-- SECURED BADGE PILL -->
      <div class="secured-pill">
        <span>Secured Data Processing</span>
      </div>

      <!-- HEADLINE & WARNING SUBTITLE -->
      <div class="processing-text-block">
        <h2 class="processing-headline">{{ (title() || 'MERGING PDF DOCUMENTS...').toUpperCase() }}</h2>
        <p class="processing-subtext">
          The process will be finished soon.<br/>
          Please, do not refresh the screen, before it finishes.
        </p>
      </div>

      <!-- PROGRESS TRACK & PERCENTAGE -->
      <div class="progress-section">
        <span class="progress-percent-label">{{ percent() }}%</span>
        <div class="dribbble-progress-track">
          <div class="dribbble-progress-fill" [style.width.%]="percent()"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dribbble-processing-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 72px 32px;
      gap: 20px;
      max-width: 680px;
      margin: 40px auto;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-2xl);
      box-shadow: var(--shadow-sm);
    }

    /* 3 PULSING DOTS */
    .pulsing-dots-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    .pulse-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      animation: dotPulse 1.4s infinite ease-in-out both;
    }
    .dot-1 {
      background: var(--coral-600);
      animation-delay: -0.32s;
    }
    .dot-2 {
      background: var(--coral-200);
      animation-delay: -0.16s;
    }
    .dot-3 {
      background: var(--coral-100);
    }
    @keyframes dotPulse {
      0%, 80%, 100% {
        transform: scale(0.85);
        opacity: 0.6;
      }
      40% {
        transform: scale(1.15);
        opacity: 1;
      }
    }

    /* SECURED PILL */
    .secured-pill {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      background: #f1f3f5;
      padding: 4px 14px;
      border-radius: 9999px;
    }

    /* HEADLINE */
    .processing-text-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .processing-headline {
      font-size: 26px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: 0.02em;
      font-family: var(--font-display);
      margin: 0;
    }
    .processing-subtext {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-muted);
      margin: 0;
    }

    /* PROGRESS TRACK */
    .progress-section {
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
    }
    .progress-percent-label {
      font-size: 14px;
      font-weight: 800;
      color: var(--text-main);
    }
    .dribbble-progress-track {
      width: 100%;
      height: 12px;
      background: var(--coral-100);
      border-radius: 9999px;
      overflow: hidden;
      padding: 2px;
    }
    .dribbble-progress-fill {
      height: 100%;
      background: var(--coral-600);
      border-radius: 9999px;
      transition: width 0.3s ease;
    }
  `]
})
export class ProcessingStateComponent {
  readonly title = input<string>('Merging PDF Documents...');
  readonly message = input<string>('');
  readonly percent = input<number>(0);
}
