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
                  <div class="mini-format-pair">
                    <span class="mini-chip chip-red">PDF</span>
                    <span class="mini-arrow">→</span>
                    <span class="mini-chip chip-blue">DOC</span>
                  </div>
                  <span class="dropdown-label">PDF to Word</span>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <div class="mini-format-pair">
                    <span class="mini-chip chip-red">PDF</span>
                    <span class="mini-arrow">→</span>
                    <span class="mini-chip chip-purple">JPG</span>
                  </div>
                  <span class="dropdown-label">PDF to JPG</span>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <div class="mini-format-pair">
                    <span class="mini-chip chip-red">PDF</span>
                    <span class="mini-arrow">→</span>
                    <span class="mini-chip chip-green">XLS</span>
                  </div>
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
                  <div class="mini-format-pair">
                    <span class="mini-chip chip-blue">DOC</span>
                    <span class="mini-arrow">→</span>
                    <span class="mini-chip chip-red">PDF</span>
                  </div>
                  <span class="dropdown-label">Word to PDF</span>
                </a>
                <a routerLink="/images-to-pdf" (click)="closeMenu()" class="dropdown-item">
                  <div class="mini-format-pair">
                    <span class="mini-chip chip-purple">JPG</span>
                    <span class="mini-arrow">→</span>
                    <span class="mini-chip chip-red">PDF</span>
                  </div>
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
                  <!-- Video Fork Icon -->
                  <div class="menu-icon-chip red-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M7 4.5v3.5c0 3.2 5 4.8 5 8v3.5"/>
                      <path d="M17 4.5v3.5c0 3.2-5 4.8-5 8"/>
                    </svg>
                  </div>
                  <span class="dropdown-label">Merge PDF</span>
                  <span class="badge-mini">In-Browser</span>
                </a>
                <a routerLink="/split-pdf" (click)="closeMenu()" class="dropdown-item">
                  <div class="menu-icon-chip orange-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <circle cx="6" cy="6" r="3"></circle>
                      <circle cx="6" cy="18" r="3"></circle>
                      <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                      <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                      <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                    </svg>
                  </div>
                  <span class="dropdown-label">Split PDF</span>
                </a>
                <a routerLink="/rotate-pdf" (click)="closeMenu()" class="dropdown-item">
                  <div class="menu-icon-chip blue-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </div>
                  <span class="dropdown-label">Rotate PDF</span>
                </a>
                <a routerLink="/compress-pdf" (click)="closeMenu()" class="dropdown-item">
                  <!-- Video Inward Arrows Icon -->
                  <div class="menu-icon-chip coral-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="4 9 9 9 9 4"/>
                      <line x1="9" y1="9" x2="3" y2="3"/>
                      <polyline points="20 15 15 15 15 20"/>
                      <line x1="15" y1="15" x2="21" y2="21"/>
                    </svg>
                  </div>
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
                <a routerLink="/protect-pdf" (click)="closeMenu()" class="dropdown-item">
                  <!-- Video Green Padlock Icon -->
                  <div class="menu-icon-chip green-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="#16A34A"/>
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round"/>
                      <circle cx="12" cy="16" r="1.5" fill="#FFFFFF"/>
                    </svg>
                  </div>
                  <span class="dropdown-label">Protect PDF</span>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="dropdown-item">
                  <div class="menu-icon-chip amber-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="#F59E0B"/>
                      <path d="M8 11V7a4 4 0 0 1 7.5-2" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
                      <circle cx="12" cy="16" r="1.5" fill="#FFFFFF"/>
                    </svg>
                  </div>
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
    .mini-format-pair {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .mini-chip {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
      color: #ffffff;
      line-height: 1;
    }
    .chip-red { background: var(--coral-600); }
    .chip-blue { background: #2563eb; }
    .chip-purple { background: #7c3aed; }
    .chip-green { background: #16a34a; }
    .mini-arrow {
      font-size: 11px;
      color: var(--text-light);
    }
    .menu-icon-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .red-chip { color: var(--coral-600); background: var(--coral-50); }
    .orange-chip { color: #ea580c; background: #fff7ed; }
    .blue-chip { color: #2563eb; background: #eff6ff; }
    .coral-chip { color: var(--coral-600); background: var(--coral-50); }
    .green-chip { color: #16a34a; background: #f0fdf4; }
    .amber-chip { color: #d97706; background: #fffbeb; }
    .dropdown-label {
      flex: 1;
      font-size: 13px;
      font-weight: 600;
    }
    .badge-mini {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 9999px;
      background: var(--coral-50);
      color: var(--coral-700);
      font-weight: 700;
    }

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
