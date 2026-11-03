import { Component, output } from '@angular/core';

@Component({
  selector: 'app-image-panel',
  standalone: true,
  template: `
    <div class="section-badge-title">IMAGE</div>
    <div class="property-panel-card">
      <p class="property-tip">Insert photos, logos, or stamps directly onto the page.</p>
      <button type="button" class="btn-action-primary" (click)="chooseImage.emit()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span>Choose Image File</span>
      </button>
    </div>
  `
})
export class ImagePanelComponent {
  readonly chooseImage = output<void>();
}
