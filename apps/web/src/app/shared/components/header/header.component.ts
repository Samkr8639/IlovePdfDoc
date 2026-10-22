import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
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
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-name">Paper<span class="brand-highlight">Flow</span></span>
            <span class="brand-sub">PDF Toolkit</span>
          </div>
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
            <span>In-Browser Privacy</span>
          </div>

          <a href="https://github.com/Samkr8639/IlovePdfDoc" target="_blank" rel="noopener noreferrer" class="github-btn" title="View Source on GitHub">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>

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
      background: var(--surface-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--surface-border);
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.03);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 72px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
    }
    .brand-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--primary-gradient);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
      position: relative;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
      line-height: 1.1;
    }
    .brand-highlight {
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .brand-sub {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-top: 1px;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(241, 245, 249, 0.7);
      padding: 4px 6px;
      border-radius: 9999px;
      border: 1px solid rgba(226, 232, 240, 0.8);
    }
    .nav-item {
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      border-radius: 9999px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .nav-item:hover {
      color: var(--text-main);
      background-color: rgba(255, 255, 255, 0.9);
    }
    .nav-item.active {
      color: var(--primary-600);
      background-color: #ffffff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .github-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #ffffff;
      color: var(--text-main);
      border: 1px solid var(--surface-border);
      transition: all 0.2s ease;
      box-shadow: var(--shadow-sm);
    }
    .github-btn:hover {
      background: var(--surface-card-hover);
      border-color: #cbd5e1;
      transform: translateY(-1px);
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
    @media (max-width: 900px) {
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
