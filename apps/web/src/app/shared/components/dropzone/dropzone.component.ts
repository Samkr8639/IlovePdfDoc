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
        <!-- PRIMARY ACTION ROW: GIANT RED BUTTON + CLOUD BUTTONS -->
        <div class="upload-action-row" (click)="$event.stopPropagation()">
          <button type="button" class="select-file-btn" (click)="fileInput.click()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>{{ title() || 'Select PDF files' }}</span>
          </button>

          <!-- CLOUD BUTTONS (Google Drive & Dropbox) -->
          <div class="cloud-buttons-group">
            <!-- Google Drive Button -->
            <button
              type="button"
              class="cloud-btn google-drive-btn"
              title="Open Google Drive"
              aria-label="Open Google Drive"
              (click)="openGoogleDrive($event)"
            >
              <svg width="22" height="20" viewBox="0 0 24 21" fill="none">
                <path d="M8.04 13.8L12.04 20.73H23.54L19.54 13.8H8.04Z" fill="#2684FC"/>
                <path d="M15.96 0.27H4.46L0.46 7.2L6.21 17.16L10.21 10.23L15.96 0.27Z" fill="#00AC47"/>
                <path d="M15.96 0.27L10.21 10.23L14.21 17.16L23.54 20.73L19.96 7.2L15.96 0.27Z" fill="#FFBA00"/>
              </svg>
            </button>

            <!-- Dropbox Button -->
            <button
              type="button"
              class="cloud-btn dropbox-btn"
              title="Open Dropbox"
              aria-label="Open Dropbox"
              (click)="openDropbox($event)"
            >
              <svg width="20" height="20" viewBox="0 0 24 22" fill="#0061FF">
                <path d="M6 1.8L0 5.7L6 9.6L12 5.7L6 1.8ZM18 1.8L12 5.7L18 9.6L24 5.7L18 1.8ZM0 13.5L6 17.4L12 13.5L6 9.6L0 13.5ZM24 13.5L18 9.6L12 13.5L18 17.4L24 13.5ZM6 18.7L12 22.6L18 18.7L12 14.8L6 18.7Z"/>
              </svg>
            </button>
          </div>
        </div>

        <p class="drop-hint">{{ subtitle() || 'or drop PDFs here' }}</p>
        <p class="dropzone-limits">{{ limitInfo() || 'No size limit • 100% Free & In-Browser' }}</p>
      </div>
    </div>
  `,
  styles: [`
    .dropzone-area {
      position: relative;
      width: 100%;
      min-height: 380px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px dashed #d1d5db;
      border-radius: var(--radius-2xl, 20px);
      background: #f8fafc;
      padding: 64px 32px;
      text-align: center;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      outline: none;
    }
    .dropzone-area:hover,
    .dropzone-area.active {
      border-color: #E53238;
      background: #fef2f2;
      transform: translateY(-2px);
      box-shadow: 0 16px 36px -6px rgba(229, 50, 56, 0.12);
    }
    .dropzone-area:focus-visible {
      border-color: #E53238;
      box-shadow: 0 0 0 4px rgba(229, 50, 56, 0.18);
    }
    .hidden-input {
      display: none;
    }
    .dropzone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      width: 100%;
      max-width: 580px;
    }

    /* ACTION ROW: GIANT SELECT BUTTON + CLOUD BUTTONS */
    .upload-action-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      width: 100%;
      flex-wrap: wrap;
    }

    /* GIANT RED SELECT BUTTON (Exact iLovePDF signature button) */
    .select-file-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      background: #E53238;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.01em;
      padding: 0 44px;
      height: 72px;
      min-width: 290px;
      border-radius: 14px;
      border: none;
      box-shadow: 0 6px 20px -2px rgba(229, 50, 56, 0.4);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }
    .select-file-btn:hover {
      background: #d3282e;
      transform: translateY(-2px);
      box-shadow: 0 10px 26px -2px rgba(229, 50, 56, 0.48);
    }
    .select-file-btn:active {
      transform: translateY(0);
      box-shadow: 0 4px 14px rgba(229, 50, 56, 0.3);
    }

    /* CLOUD BUTTONS (Google Drive & Dropbox) */
    .cloud-buttons-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cloud-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }
    .cloud-btn:hover {
      transform: translateY(-2px) scale(1.08);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
      border-color: #cbd5e1;
    }
    .google-drive-btn:hover {
      border-color: #2684FC;
    }
    .dropbox-btn:hover {
      border-color: #0061FF;
    }

    .drop-hint {
      font-size: 16px;
      font-weight: 600;
      color: #64748b;
      margin: 4px 0 0;
    }
    .dropzone-limits {
      font-size: 13.5px;
      color: #94a3b8;
      margin: 0;
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

  openGoogleDrive(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    window.open('https://drive.google.com/', '_blank', 'noopener,noreferrer');
  }

  openDropbox(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    window.open('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');
  }
}
