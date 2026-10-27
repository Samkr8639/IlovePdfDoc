import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  activeMenu = signal<'convert' | 'all' | null>(null);
  mobileMenuOpen = signal<boolean>(false);
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
  }
}
