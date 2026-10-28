import { Component, inject, signal, ElementRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  private translationService = inject(TranslationService);
  private elementRef = inject(ElementRef);
  isMenuOpen = signal<boolean>(false);
  readonly currentYear = new Date().getFullYear();

  // Mobile accordion state for footer columns
  openSection = signal<string | null>(null);

  // Exact 3 columns matching reference design
  readonly col1 = this.translationService.languages.slice(0, 9);
  readonly col2 = this.translationService.languages.slice(9, 18);
  readonly col3 = this.translationService.languages.slice(18, 26);

  get currentLang() {
    return this.translationService.currentLanguage;
  }

  toggleSection(section: string): void {
    if (this.openSection() === section) {
      this.openSection.set(null);
    } else {
      this.openSection.set(section);
    }
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  selectLanguage(langCode: string): void {
    this.translationService.setLanguage(langCode);
    this.isMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isMenuOpen.set(false);
  }
}
