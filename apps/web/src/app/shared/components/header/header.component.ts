import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `
    <header class="header">
      <div class="container header-inner">
        <!-- LOGO (Dribbble PDF flow Logo style) -->
        <a routerLink="/" class="brand">
          <div class="brand-badge">
            <span class="pdf-tag">PDF</span>
          </div>
          <span class="brand-flow">flow</span>
        </a>

        <!-- CENTER NAVIGATION WITH HOVER-ACTIVATED DROPDOWNS -->
        <nav class="nav-links">
          <!-- Convert from PDF -->
          <div class="nav-dropdown" (mouseenter)="openMenu('from')" (mouseleave)="closeMenu()">
            <button type="button" class="nav-item">
              <span>Convert from PDF</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            @if (activeMenu() === 'from') {
              <div class="dropdown-pane">
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <span class="dropdown-icon-pill icon-red">PDF</span>
                  <span class="dropdown-arrow">→</span>
                  <span class="dropdown-icon-pill icon-blue">DOC</span>
                  <span class="dropdown-label">PDF to Word</span>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <span class="dropdown-icon-pill icon-red">PDF</span>
                  <span class="dropdown-arrow">→</span>
                  <span class="dropdown-icon-pill icon-purple">JPG</span>
                  <span class="dropdown-label">PDF to JPG</span>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <span class="dropdown-icon-pill icon-red">PDF</span>
                  <span class="dropdown-arrow">→</span>
                  <span class="dropdown-icon-pill icon-green">XLS</span>
                  <span class="dropdown-label">PDF to Excel</span>
                </a>
              </div>
            }
          </div>

          <!-- Convert to PDF -->
          <div class="nav-dropdown" (mouseenter)="openMenu('to')" (mouseleave)="closeMenu()">
            <button type="button" class="nav-item">
              <span>Convert to PDF</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            @if (activeMenu() === 'to') {
              <div class="dropdown-pane">
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <span class="dropdown-icon-pill icon-blue">DOC</span>
                  <span class="dropdown-arrow">→</span>
                  <span class="dropdown-icon-pill icon-red">PDF</span>
                  <span class="dropdown-label">Word to PDF</span>
                </a>
                <a routerLink="/images-to-pdf" (click)="closeMenu()" class="dropdown-item">
                  <span class="dropdown-icon-pill icon-purple">JPG</span>
                  <span class="dropdown-arrow">→</span>
                  <span class="dropdown-icon-pill icon-red">PDF</span>
                  <span class="dropdown-label">JPG to PDF</span>
                </a>
              </div>
            }
          </div>

          <!-- PDF tools -->
          <div class="nav-dropdown" (mouseenter)="openMenu('tools')" (mouseleave)="closeMenu()">
            <button type="button" class="nav-item">
              <span>PDF tools</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            @if (activeMenu() === 'tools') {
              <div class="dropdown-pane">
                <a routerLink="/merge-pdf" (click)="closeMenu()" class="dropdown-item">
                  <span class="tool-dot red-dot"></span>
                  <span class="dropdown-label">Merge PDF</span>
                  <span class="badge-mini">In-Browser</span>
                </a>
                <a routerLink="/split-pdf" (click)="closeMenu()" class="dropdown-item">
                  <span class="tool-dot orange-dot"></span>
                  <span class="dropdown-label">Split PDF</span>
                </a>
                <a routerLink="/rotate-pdf" (click)="closeMenu()" class="dropdown-item">
                  <span class="tool-dot blue-dot"></span>
                  <span class="dropdown-label">Rotate PDF</span>
                </a>
                <a routerLink="/compress-pdf" (click)="closeMenu()" class="dropdown-item">
                  <span class="tool-dot emerald-dot"></span>
                  <span class="dropdown-label">Compress PDF</span>
                </a>
              </div>
            }
          </div>

          <!-- PDF security -->
          <div class="nav-dropdown" (mouseenter)="openMenu('security')" (mouseleave)="closeMenu()">
            <button type="button" class="nav-item">
              <span>PDF security</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            @if (activeMenu() === 'security') {
              <div class="dropdown-pane">
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <span class="tool-dot green-dot"></span>
                  <span class="dropdown-label">Protect PDF</span>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <span class="tool-dot yellow-dot"></span>
                  <span class="dropdown-label">Unlock PDF</span>
                </a>
              </div>
            }
          </div>
        </nav>

        <!-- RIGHT USER PROFILE (Dribbble Mark Trainer Style) -->
        <div class="header-right">
          <div class="user-profile-chip">
            <div class="user-avatar">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80" alt="Mark Trainer" />
            </div>
            <div class="user-info">
              <span class="user-name">Mark Trainer</span>
              <span class="user-email">mark&#64;mail.com</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="user-chevron">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
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

      <!-- MOBILE ACCORDION -->
      @if (mobileMenuOpen()) {
        <div class="mobile-menu">
          <a routerLink="/" (click)="closeMobileMenu()" class="mobile-nav-item">Popular Services</a>
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
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 72px;
    }
    
    /* BRAND LOGO */
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }
    .brand-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      background: var(--coral-600);
      border-radius: 8px;
      line-height: 1;
      box-shadow: 0 2px 6px rgba(229, 57, 53, 0.25);
    }
    .pdf-tag {
      font-size: 13px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.02em;
    }
    .brand-flow {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text-main);
      font-family: var(--font-display);
    }

    /* CENTER NAVIGATION */
    .nav-links {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-dropdown {
      position: relative;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      border-radius: 8px;
      transition: all 0.15s ease;
    }
    .nav-item:hover {
      color: var(--text-main);
      background-color: var(--coral-50);
    }

    /* DROPDOWN MENU */
    .dropdown-pane {
      position: absolute;
      top: 100%;
      left: 0;
      width: 240px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      padding: 8px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      gap: 4px;
      animation: dropFade 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 60;
    }
    @keyframes dropFade {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      transition: all 0.15s ease;
    }
    .dropdown-item:hover {
      background: var(--coral-50);
      color: var(--coral-600);
    }
    .dropdown-icon-pill {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
      color: #fff;
    }
    .icon-red { background: var(--coral-600); }
    .icon-blue { background: #2563eb; }
    .icon-purple { background: #7c3aed; }
    .icon-green { background: #16a34a; }
    .dropdown-arrow {
      font-size: 12px;
      color: var(--text-light);
    }
    .dropdown-label {
      flex: 1;
    }
    .badge-mini {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 9999px;
      background: var(--emerald-50);
      color: var(--emerald-700);
      font-weight: 700;
    }
    .tool-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .red-dot { background: var(--coral-600); }
    .orange-dot { background: #f97316; }
    .blue-dot { background: #3b82f6; }
    .emerald-dot { background: #10b981; }
    .green-dot { background: #16a34a; }
    .yellow-dot { background: #eab308; }

    /* USER PROFILE CHIP (Mark Trainer) */
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .user-profile-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px 6px 8px;
      border-radius: 9999px;
      border: 1px solid var(--surface-border);
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .user-profile-chip:hover {
      border-color: var(--coral-300);
      background: var(--coral-50);
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
    }
    .user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .user-info {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
      text-align: left;
    }
    .user-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
    }
    .user-email {
      font-size: 11px;
      color: var(--text-muted);
    }
    .user-chevron {
      color: var(--text-light);
    }

    /* MOBILE TOGGLE */
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
      font-size: 15px;
      font-weight: 600;
      color: var(--text-main);
      border-bottom: 1px solid var(--surface-border-subtle);
    }

    @media (max-width: 992px) {
      .nav-links {
        display: none;
      }
      .mobile-toggle {
        display: block;
      }
      .user-info {
        display: none;
      }
    }
  `]
})
export class HeaderComponent {
  activeMenu = signal<string | null>(null);
  mobileMenuOpen = signal<boolean>(false);

  openMenu(name: string): void {
    this.activeMenu.set(name);
  }

  closeMenu(): void {
    this.activeMenu.set(null);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
