import { Component, input } from '@angular/core';

@Component({
  selector: 'app-processing-state',
  template: `
    <div class="processing-card card-clean">
      <div class="spinner-wrapper">
        <div class="pulse-ring"></div>
        <div class="spinner-core">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        </div>
      </div>

      <div class="processing-details">
        <h3 class="processing-title">{{ title() }}</h3>
        <p class="processing-message">{{ message() }}</p>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" [style.width.%]="percent()"></div>
        </div>
        <span class="progress-percent">{{ percent() }}%</span>
      </div>

      <div class="badge-privacy">
        <span>Processing 100% locally in browser memory</span>
      </div>
    </div>
  `,
  styles: [`
    .processing-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 48px 32px;
      gap: 20px;
      max-width: 580px;
      margin: 32px auto;
    }
    .spinner-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
    }
    .spin-icon {
      color: var(--primary-600);
      animation: rotate 1s linear infinite;
    }
    @keyframes rotate {
      100% { transform: rotate(360deg); }
    }
    .processing-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
    }
    .processing-message {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .progress-bar-container {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .progress-bar-track {
      flex: 1;
      height: 8px;
      background: var(--surface-border);
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--primary-gradient);
      border-radius: 9999px;
      transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .progress-percent {
      font-size: 13px;
      font-weight: 700;
      color: var(--primary-700);
      min-width: 36px;
    }
  `]
})
export class ProcessingStateComponent {
  readonly title = input<string>('Merging Documents...');
  readonly message = input<string>('Reading pages and assembling final PDF...');
  readonly percent = input<number>(0);
}
