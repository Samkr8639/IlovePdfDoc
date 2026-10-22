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

      <div class="dropzone-ambient-glow"></div>

      <div class="dropzone-content">
        <div class="upload-icon-container">
          <div class="upload-icon-ring"></div>
          <div class="upload-icon-box">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
        </div>

        <div class="dropzone-text">
          <h3 class="dropzone-title">{{ title() }}</h3>
          <p class="dropzone-subtitle">{{ subtitle() }}</p>
        </div>

        <button type="button" class="btn-primary select-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Choose Files</span>
        </button>

        <div class="dropzone-meta">
          <span class="meta-pill">{{ limitInfo() }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dropzone-area {
      position: relative;
      background: radial-gradient(circle at 50% 30%, rgba(239, 246, 255, 0.7) 0%, #ffffff 80%);
      border: 2px dashed rgba(59, 130, 246, 0.35);
      border-radius: var(--radius-2xl);
      padding: 56px 36px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(226, 232, 240, 0.5);
      overflow: hidden;
    }
    .dropzone-ambient-glow {
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.04) 0%, transparent 60%);
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .dropzone-area:hover {
      border-color: var(--primary-500);
      transform: translateY(-3px);
      box-shadow: 0 16px 32px -8px rgba(37, 99, 235, 0.12), 0 0 0 1px var(--primary-200);
    }
    .dropzone-area.active {
      border-color: var(--primary-600);
      background: radial-gradient(circle at 50% 30%, rgba(219, 234, 254, 0.8) 0%, #ffffff 85%);
      transform: scale(1.015);
      box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.18), 0 20px 35px -5px rgba(37, 99, 235, 0.15);
    }
    .hidden-input {
      display: none;
    }
    .dropzone-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }
    .upload-icon-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
    }
    .upload-icon-ring {
      position: absolute;
      inset: -4px;
      border-radius: 26px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%);
      transition: transform 0.3s ease;
    }
    .upload-icon-box {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 22px;
      background: var(--primary-gradient);
      color: #ffffff;
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .dropzone-area:hover .upload-icon-box {
      transform: translateY(-4px) scale(1.05);
      box-shadow: 0 12px 28px rgba(37, 99, 235, 0.4);
    }
    .dropzone-area:hover .upload-icon-ring {
      transform: scale(1.1);
    }
    .dropzone-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }
    .dropzone-subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
      font-weight: 500;
    }
    .select-btn {
      pointer-events: none;
      padding: 13px 30px;
      font-size: 15px;
      margin-top: 4px;
    }
    .dropzone-meta {
      margin-top: 4px;
    }
    .meta-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      background: rgba(241, 245, 249, 0.8);
      border: 1px solid var(--surface-border);
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
