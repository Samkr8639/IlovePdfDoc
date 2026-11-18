import { Component, input, output, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToolRegistryService } from '../../../core/services/tool-registry.service';

export interface UploadProgressItem {
  name: string;
  size: string;
  progress: number;
  isComplete: boolean;
}

@Component({
  selector: 'app-dropzone',
  standalone: true,
  templateUrl: './dropzone.component.html',
  styleUrl: './dropzone.component.css'
})
export class DropzoneComponent {
  private readonly router = inject(Router, { optional: true });
  private readonly toolRegistry = inject(ToolRegistryService, { optional: true });

  readonly title = input<string>('Select PDF file');
  readonly subtitle = input<string>('');
  readonly acceptedTypes = input<string>('.pdf,application/pdf');
  readonly multiple = input<boolean>(true);
  readonly limitInfo = input<string>('Max 5 files, 800MB each');
  readonly ariaLabel = input<string>('Upload documents dropzone');
  readonly toolName = input<string>('');
  readonly toolDescription = input<string>('');

  readonly filesSelected = output<File[]>();

  isDragOver = signal<boolean>(false);
  isShooting = signal<boolean>(false);
  isSwishing = signal<boolean>(false);
  showScorePopup = signal<boolean>(false);
  scoreBump = signal<boolean>(false);
  uploadedCount = signal<number>(0);
  activeUpload = signal<UploadProgressItem | null>(null);

  readonly currentRoute = computed(() => {
    return this.router?.url?.split('?')[0] || '/';
  });

  readonly effectiveToolName = computed(() => {
    if (this.toolName()) {
      return this.toolName();
    }
    const route = this.currentRoute().replace(/^\//, '');
    return route ? route.replace(/-/g, '_') : 'pdf_tool';
  });

  readonly effectiveToolDescription = computed(() => {
    if (this.toolDescription()) {
      return this.toolDescription();
    }
    const tool = this.toolRegistry?.getToolByRoute(this.currentRoute());
    return tool?.shortDescription || this.title() || 'Upload and process documents';
  });

  private formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

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
      const toEmit = this.multiple() ? files : [files[0]];
      this.playUploadSequence(toEmit);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const toEmit = this.multiple() ? files : [files[0]];
      input.value = '';
      this.playUploadSequence(toEmit);
    }
  }

  /**
   * Plays the basketball shot animation, score increment, and progress bar
   * before emitting filesSelected to the parent container.
   */
  private playUploadSequence(files: File[]): void {
    const primaryFile = files[0];
    const sizeStr = this.formatFileSize(primaryFile.size);

    this.isShooting.set(true);
    this.activeUpload.set({
      name: primaryFile.name,
      size: sizeStr,
      progress: 20,
      isComplete: false
    });

    // Arc shot phase -> hits basket at 380ms
    setTimeout(() => {
      this.isSwishing.set(true);
      this.showScorePopup.set(true);
      this.uploadedCount.update(c => c + files.length);
      this.scoreBump.set(true);
      this.activeUpload.update(u => u ? { ...u, progress: 68 } : null);
    }, 380);

    // Swish settles & upload reaches 100%
    setTimeout(() => {
      this.isSwishing.set(false);
      this.activeUpload.update(u => u ? { ...u, progress: 100, isComplete: true } : null);
    }, 650);

    // Finish and emit files to parent
    setTimeout(() => {
      this.showScorePopup.set(false);
      this.scoreBump.set(false);
      this.isShooting.set(false);
      this.filesSelected.emit(files);
    }, 850);
  }

  /**
   * Interactive playful "take the shot" demo from the reference video!
   */
  takeInteractiveShot(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.isShooting()) return;

    this.isShooting.set(true);
    this.activeUpload.set({
      name: 'final fileeeeee',
      size: '2.4 MB',
      progress: 25,
      isComplete: false
    });

    setTimeout(() => {
      this.isSwishing.set(true);
      this.showScorePopup.set(true);
      this.uploadedCount.update(c => c + 1);
      this.scoreBump.set(true);
      this.activeUpload.update(u => u ? { ...u, progress: 75 } : null);
    }, 380);

    setTimeout(() => {
      this.isSwishing.set(false);
      this.activeUpload.update(u => u ? { ...u, progress: 100, isComplete: true } : null);
    }, 650);

    setTimeout(() => {
      this.showScorePopup.set(false);
      this.scoreBump.set(false);
      this.isShooting.set(false);
    }, 1400);
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
