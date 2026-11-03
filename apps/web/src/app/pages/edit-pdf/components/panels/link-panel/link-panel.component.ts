import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-link-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="section-badge-title">LINK PROPERTIES</div>
    <div class="property-panel-card">
      <label class="property-sublabel">Destination Web URL</label>
      <input type="url" class="custom-range-input" placeholder="https://example.com" [ngModel]="linkUrl()"
        (ngModelChange)="linkUrlChange.emit($event)" />
      <button type="button" class="btn-action-primary" (click)="placeLink.emit()">
        <span>+ Place Link Box on Page</span>
      </button>
    </div>
  `
})
export class LinkPanelComponent {
  readonly linkUrl = input.required<string>();
  readonly linkUrlChange = output<string>();
  readonly placeLink = output<void>();
}
