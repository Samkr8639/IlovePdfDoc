import { Component, input, output } from '@angular/core';
import { ValidatedPdfFile } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.css'
})
export class FileListComponent {
  readonly files = input.required<ValidatedPdfFile[]>();
  readonly moveUp = output<number>();
  readonly moveDown = output<number>();
  readonly removeFile = output<number>();
}
