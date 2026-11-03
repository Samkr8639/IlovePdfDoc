import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditToolType } from '../../models/document-model';

@Component({
  selector: 'app-tools-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sidebar-section">
      <div class="section-badge-title">TOOLS</div>
      <div class="tools-grid">
        <!-- 1. Select -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'select'"
          (click)="selectTool.emit('select')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 3 10 21 13 13 21 10 3 3" />
          </svg>
          <span class="tool-tile-name">Select</span>
        </button>

        <!-- 2. Text -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'text'"
          (click)="selectTool.emit('text')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
          <span class="tool-tile-name">Text</span>
        </button>

        <!-- 3. Image -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'image'"
          (click)="selectTool.emit('image')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span class="tool-tile-name">Image</span>
        </button>

        <!-- 4. Draw -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'draw'"
          (click)="selectTool.emit('draw')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          <span class="tool-tile-name">Draw</span>
        </button>

        <!-- 5. Shapes -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'shapes'"
          (click)="selectTool.emit('shapes')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          <span class="tool-tile-name">Shapes</span>
        </button>

        <!-- 6. Highlight -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'highlight'"
          (click)="selectTool.emit('highlight')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 11-6 6v3h3l6-6" />
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
          </svg>
          <span class="tool-tile-name">Highlight</span>
        </button>

        <!-- 7. Whiteout -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'whiteout'"
          (click)="selectTool.emit('whiteout')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
          <span class="tool-tile-name">Whiteout</span>
        </button>

        <!-- 8. Sign -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'sign'"
          (click)="selectTool.emit('sign')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
            <line x1="16" y1="8" x2="2" y2="22" />
            <line x1="17.5" y1="15" x2="9" y2="15" />
          </svg>
          <span class="tool-tile-name">Sign</span>
        </button>

        <!-- 9. Link -->
        <button
          type="button"
          class="tool-tile"
          [class.active]="activeTool() === 'link'"
          (click)="selectTool.emit('link')">
          <svg class="lucide-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span class="tool-tile-name">Link</span>
        </button>
      </div>
    </div>
  `
})
export class ToolsGridComponent {
  readonly activeTool = input<EditToolType>('select');
  readonly selectTool = output<EditToolType>();
}
