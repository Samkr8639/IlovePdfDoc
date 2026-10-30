import { Component, input, output, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToolRegistryService } from '../../../core/services/tool-registry.service';

@Component({
  selector: 'app-dropzone',
  standalone: true,
  templateUrl: './dropzone.component.html',
  styleUrl: './dropzone.component.css'
})
export class DropzoneComponent {
  private readonly router = inject(Router, { optional: true });
  private readonly toolRegistry = inject(ToolRegistryService, { optional: true });

  readonly title = input<string>('Drag PDF file here');
  readonly subtitle = input<string>('');
  readonly acceptedTypes = input<string>('.pdf,application/pdf');
  readonly multiple = input<boolean>(true);
  readonly limitInfo = input<string>('Max 5 files, 800MB each');
  readonly ariaLabel = input<string>('Upload documents dropzone');
  readonly toolName = input<string>('');
  readonly toolDescription = input<string>('');

  readonly filesSelected = output<File[]>();

  isDragOver = signal<boolean>(false);

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
      this.filesSelected.emit(toEmit);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const toEmit = this.multiple() ? files : [files[0]];
      this.filesSelected.emit(toEmit);
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
