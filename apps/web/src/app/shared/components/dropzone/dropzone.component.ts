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
        <div class="upload-icon-wrapper">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>

        <div class="dropzone-text">
          <h3 class="dropzone-title">{{ title() }}</h3>
          <p class="dropzone-subtitle">{{ subtitle() }}</p>
        </div>

        <button type="button" class="btn-primary select-btn">
          <span>Choose Files</span>
        </button>

        <div class="dropzone-limits">
          <span>{{ limitInfo() }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dropzone-area {
      position: relative;
      background: #ffffff;
      border: 2px dashed var(--surface-border);
      border-radius: var(--radius-xl);
      padding: 48px 32px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: var(--shadow-sm);
    }
    .dropzone-area:hover {
      border-color: var(--primary-500);
      background: #fafcff;
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .dropzone-area.active {
      border-color: var(--primary-600);
      background: var(--primary-50);
      transform: scale(1.01);
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
    }
    .hidden-input {
      display: none;
    }
    .dropzone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .upload-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: var(--primary-50);
      color: var(--primary-600);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
      transition: transform 0.2s ease;
    }
    .dropzone-area:hover .upload-icon-wrapper {
      transform: scale(1.08);
    }
    .dropzone-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
    }
    .dropzone-subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .select-btn {
      pointer-events: none;
      margin-top: 4px;
    }
    .dropzone-limits {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 4px;
    }
  `]
})
export class DropzoneComponent {
  readonly title = input<string>('Select PDF files');
  readonly subtitle = input<string>('or drag and drop multiple PDF documents here');
  readonly acceptedTypes = input<string>('.pdf,application/pdf');
  readonly multiple = input<boolean>(true);
  readonly limitInfo = input<string>('Select 2 or more PDFs • Maximum 50MB per file');
  readonly ariaLabel = input<string>('File upload dropzone');

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
    const inputEl = event.target as HTMLInputElement;
    if (inputEl.files && inputEl.files.length > 0) {
      const files = Array.from(inputEl.files);
      this.filesSelected.emit(files);
      inputEl.value = '';
    }
  }
}
