import { Component, output } from '@angular/core';

@Component({
  selector: 'app-whiteout-panel',
  standalone: true,
  template: `
    <div class="section-badge-title">WHITEOUT</div>
    <div class="property-panel-card">
      <p class="property-tip">Erase or hide sensitive text with an opaque cover rectangle.</p>
      <button type="button" class="btn-action-primary" (click)="placeBlock.emit()">
        <span>+ Place Whiteout Block</span>
      </button>
    </div>
  `
})
export class WhiteoutPanelComponent {
  readonly placeBlock = output<void>();
}

