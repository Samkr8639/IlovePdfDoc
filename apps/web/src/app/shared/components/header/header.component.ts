import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  private readonly elementRef = inject(ElementRef);

  activeMenu = signal<'convert' | 'all' | null>(null);
  mobileMenuOpen = signal<boolean>(false);
  mobileConvertOpen = signal<boolean>(false);
  mobileAllOpen = signal<boolean>(false);
  private closeTimer: any = null;

  openMenu(menu: 'convert' | 'all'): void {
    this.cancelCloseMenu();
    this.activeMenu.set(menu);
  }

  toggleMenu(menu: 'convert' | 'all'): void {
    if (this.activeMenu() === menu) {
      this.closeMenu();
    } else {
      this.openMenu(menu);
    }
  }

  scheduleCloseMenu(): void {
    this.closeTimer = setTimeout(() => {
      this.activeMenu.set(null);
    }, 220);
  }

  cancelCloseMenu(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  closeMenu(): void {
    this.cancelCloseMenu();
    this.activeMenu.set(null);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    this.mobileConvertOpen.set(false);
    this.mobileAllOpen.set(false);
  }

  toggleMobileSection(section: 'convert' | 'all'): void {
    if (section === 'convert') {
      this.mobileConvertOpen.set(!this.mobileConvertOpen());
    } else {
      this.mobileAllOpen.set(!this.mobileAllOpen());
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
    this.closeMobileMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }
}
