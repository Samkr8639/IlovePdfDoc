import {
  Component,
  inject,
  ElementRef,
  ViewChild,
  HostListener,
  AfterViewInit,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UploadConsentService } from '../../../core/services/upload-consent.service';

@Component({
  selector: 'app-upload-consent-dialog',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './upload-consent-dialog.component.html',
  styleUrl: './upload-consent-dialog.component.css'
})
export class UploadConsentDialogComponent implements AfterViewInit {
  readonly consentService = inject(UploadConsentService);
  private elementRef = inject(ElementRef);

  @ViewChild('confirmButton') confirmButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('dialogContainer') dialogContainer!: ElementRef<HTMLDivElement>;

  readonly dontAskAgain = signal<boolean>(false);

  ngAfterViewInit(): void {
    if (this.confirmButton) {
      setTimeout(() => this.confirmButton.nativeElement.focus(), 50);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.consentService.state()) {
      event.preventDefault();
      this.cancel();
    }
  }

  @HostListener('keydown', ['$event'])
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.dialogContainer) return;

    const focusableElements = this.dialogContainer.nativeElement.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  toggleDontAskAgain(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dontAskAgain.set(input.checked);
  }

  confirm(): void {
    this.consentService.confirm(this.dontAskAgain());
  }

  cancel(): void {
    this.consentService.cancel();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }
}
