import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="container header-inner">
        <a routerLink="/" class="brand">
          <div class="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <span class="brand-name">Paper<span class="brand-highlight">Flow</span></span>
        </a>

        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">Explore Tools</a>
          <a routerLink="/merge-pdf" routerLinkActive="active" class="nav-item">Merge PDF</a>
          <a routerLink="/split-pdf" routerLinkActive="active" class="nav-item">Split PDF</a>
          <a routerLink="/rotate-pdf" routerLinkActive="active" class="nav-item">Rotate PDF</a>
          <a routerLink="/images-to-pdf" routerLinkActive="active" class="nav-item">JPG to PDF</a>
        </nav>

        <div class="header-actions">
          <div class="badge-privacy">
            <span>Client-Side Privacy</span>
          </div>
          <button class="mobile-toggle" (click)="toggleMobileMenu()" aria-label="Toggle menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      @if (mobileMenuOpen()) {
        <div class="mobile-menu">
          <a routerLink="/" (click)="closeMobileMenu()" class="mobile-nav-item">Explore Tools</a>
          <a routerLink="/merge-pdf" (click)="closeMobileMenu()" class="mobile-nav-item">Merge PDF</a>
          <a routerLink="/split-pdf" (click)="closeMobileMenu()" class="mobile-nav-item">Split PDF</a>
          <a routerLink="/rotate-pdf" (click)="closeMobileMenu()" class="mobile-nav-item">Rotate PDF</a>
          <a routerLink="/images-to-pdf" (click)="closeMobileMenu()" class="mobile-nav-item">JPG to PDF</a>
        </div>
      }
    </header>
  `,
  styles: [`
    .header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--surface-border);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 70px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }
    .brand-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--primary-gradient);
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
    }
    .brand-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }
    .brand-highlight {
      color: var(--primary-600);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-item {
      padding: 8px 14px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      border-radius: 8px;
      transition: all 0.15s ease;
    }
    .nav-item:hover {
      color: var(--text-main);
      background-color: var(--surface-card-hover);
    }
    .nav-item.active {
      color: var(--primary-600);
      background-color: var(--primary-50);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .mobile-toggle {
      display: none;
      padding: 6px;
      color: var(--text-main);
    }
    .mobile-menu {
      display: flex;
      flex-direction: column;
      padding: 16px 24px 20px;
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border);
    }
    .mobile-nav-item {
      padding: 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-main);
      border-bottom: 1px solid var(--surface-border-subtle);
    }
    @media (max-width: 860px) {
      .nav-links {
        display: none;
      }
      .mobile-toggle {
        display: block;
      }
    }
  `]
})
export class HeaderComponent {
  mobileMenuOpen = signal<boolean>(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
