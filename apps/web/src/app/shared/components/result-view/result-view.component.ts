import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { MergeResult } from '../../../core/services/browser-pdf.service';

@Component({
  selector: 'app-result-view',
  imports: [RouterLink],
  templateUrl: './result-view.component.html',
  styleUrl: './result-view.component.css'
})
export class ResultViewComponent {
  private sanitizer = inject(DomSanitizer);

  result = input.required<MergeResult>();
  title = input<string>('PDFs Merged Successfully!');
  subtitle = input<string>('Your files have been combined into a high-quality PDF document directly in your browser memory.');
  downloadLabel = input<string>('Download Merged PDF');
  savingsText = input<string | null>(null);
  restartLabel = input<string>('Process Another File');
  reset = output<void>();

  showPreview = signal<boolean>(false);
  copied = signal<boolean>(false);

  safeUrl = computed<SafeUrl>(() => {
    return this.sanitizer.bypassSecurityTrustUrl(this.result().url);
  });

  previewUrl = computed<SafeResourceUrl>(() => {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.result().url);
  });

  isZipArchive = computed<boolean>(() => {
    return this.result()?.filename?.toLowerCase().endsWith('.zip') || false;
  });

  compressedItems = computed<any[]>(() => {
    return (this.result() as any)?.items || [];
  });

  sanitizeUrl(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  downloadFile(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const res = this.result();
    if (!res) return;

    try {
      const anchor = document.createElement('a');
      anchor.href = res.url;
      anchor.download = res.filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      // Fallback
    }
  }

  openGoogleDrive(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.open('https://drive.google.com/', '_blank', 'noopener,noreferrer');
  }

  openDropbox(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.open('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');
  }

  copyShareLink(): void {
    const url = this.result().url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 3000);
      });
    }
  }

  shareOnTwitter(): void {
    const text = encodeURIComponent('Just merged multiple PDFs instantly and privately in browser with PDF flow! Check it out:');
    const url = encodeURIComponent(window.location.origin);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer');
  }

  shareOnLinkedIn(): void {
    const url = encodeURIComponent(window.location.origin);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener,noreferrer');
  }

  shareOnFacebook(): void {
    const url = encodeURIComponent(window.location.origin);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer');
  }

  shareOnWhatsApp(): void {
    const text = encodeURIComponent('Merge PDFs privately and free with PDF flow: ' + window.location.origin);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}
