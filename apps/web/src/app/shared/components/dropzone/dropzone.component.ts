import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-dropzone',
  template: `
    <div
      class="dropzone-area"
      [class.active]="isDragOver()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
      tabindex="0"
      (keydown.enter)="fileInput.click()"
      (keydown.space)="fileInput.click()"
      role="button"
      [attr.aria-label]="ariaLabel()"
    >
      <input
        #fileInput
        type="file"
        class="hidden-input"
        [accept]="acceptedTypes()"
        [multiple]="multiple()"
        (change)="onFileInputChange($event)"
      />

      <div class="dropzone-content">
        <h3 class="dropzone-heading">{{ title() || 'Drag PDF file here' }}</h3>
        <span class="dropzone-sep">or</span>

        <!-- DRIBBLE BLUSH PILL BUTTON -->
        <button type="button" class="select-file-btn" (click)="$event.stopPropagation(); fileInput.click()">
          <span>Select file</span>
        </button>

        <!-- CLOUD SHORTCUT ICONS (Dribbble Video Design) -->
        <div class="cloud-shortcuts">
          <!-- Google Drive -->
          <div class="cloud-chip" title="Google Drive">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 19h20L12 2z"></path>
              <path d="M2 19l5-9h10l5 9"></path>
            </svg>
          </div>
          <!-- Dropbox -->
          <div class="cloud-chip" title="Dropbox">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 3l6 4-6 4-6-4 6-4zm12 0l6 4-6 4-6-4 6-4zm-12 8l6 4-6 4-6-4 6-4zm12 0l6 4-6 4-6-4 6-4zm-6 5l6 4-6 4-6-4 6-4z"></path>
            </svg>
          </div>
          <!-- Link URL -->
          <div class="cloud-chip" title="Enter URL">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
        </div>

        <p class="dropzone-limits">{{ limitInfo() || 'Max 5 files, 800MB each' }}</p>
      </div>
    </div>
  `,
  styles: [`
    .dropzone-area {
      position: relative;
      width: 100%;
      border: 2px dashed #d1d5db;
      border-radius: var(--radius-xl);
      background: #fafafa;
      padding: 56px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      outline: none;
    }
    .dropzone-area:hover,
    .dropzone-area.active {
      border-color: var(--coral-400);
      background: var(--coral-50);
      transform: translateY(-2px);
      box-shadow: 0 12px 28px -4px rgba(229, 57, 53, 0.08);
    }
    .dropzone-area:focus-visible {
      border-color: var(--coral-500);
      box-shadow: 0 0 0 4px rgba(229, 57, 53, 0.15);
    }
    .hidden-input {
      display: none;
    }
    .dropzone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .dropzone-heading {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }
    .dropzone-sep {
      font-size: 14px;
      color: var(--text-muted);
    }
    
    /* SELECT FILE PILL BUTTON (Dribbble Pink Button) */
    .select-file-btn {
      background: var(--coral-100);
      color: var(--coral-600);
      font-size: 15px;
      font-weight: 700;
      padding: 12px 36px;
      border-radius: 9999px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      margin: 4px 0 10px;
      box-shadow: 0 2px 6px rgba(229, 57, 53, 0.08);
    }
    .select-file-btn:hover {
      background: var(--coral-200);
      color: var(--coral-700);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(229, 57, 53, 0.15);
    }

    /* CLOUD SHORTCUT ICONS */
    .cloud-shortcuts {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
    }
    .cloud-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      color: var(--text-muted);
      transition: all 0.2s ease;
    }
    .cloud-chip:hover {
      border-color: var(--coral-400);
      color: var(--coral-600);
      transform: scale(1.08);
    }

    .dropzone-limits {
      font-size: 13px;
      color: var(--text-light);
      margin-top: 6px;
    }
  `]
})
export class DropzoneComponent {
  readonly title = input<string>('Drag PDF file here');
  readonly subtitle = input<string>('');
  readonly acceptedTypes = input<string>('.pdf,application/pdf');
  readonly multiple = input<boolean>(true);
  readonly limitInfo = input<string>('Max 5 files, 800MB each');
  readonly ariaLabel = input<string>('Upload documents dropzone');

  readonly filesSelected = output<File[]>();

  isDragOver = signal<boolean>(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      this.filesSelected.emit(files);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.filesSelected.emit(files);
      input.value = '';
    }
  }
}
