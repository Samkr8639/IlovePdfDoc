import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `
    <header class="header">
      <div class="header-inner">
        <!-- 1. BRAND LOGO (Exact iLovePDF signature logo style) -->
        <a routerLink="/" class="brand-logo" (click)="closeMenu()">
          <span class="logo-i">I</span>
          <svg class="logo-heart" width="22" height="20" viewBox="0 0 24 24" fill="#E53238" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span class="logo-pdf">PDF&DOC</span>
        </a>

        <!-- 2. MAIN NAVIGATION LINKS -->
        <nav class="nav-links">
          <!-- MERGE PDF (Direct Link) -->
          <a routerLink="/merge-pdf" class="nav-link" (click)="closeMenu()">MERGE PDF</a>

          <!-- SPLIT PDF (Direct Link) -->
          <a routerLink="/split-pdf" class="nav-link" (click)="closeMenu()">SPLIT PDF</a>

          <!-- COMPRESS PDF (Direct Link) -->
          <a routerLink="/compress-pdf" class="nav-link" (click)="closeMenu()">COMPRESS PDF</a>

          <!-- CONVERT PDF (2-Column Dropdown matching Image 2) -->
          <div
            class="nav-dropdown-wrap"
            (mouseenter)="openMenu('convert')"
            (mouseleave)="scheduleCloseMenu()"
          >
            <button
              type="button"
              class="nav-dropdown-trigger"
              [class.active]="activeMenu() === 'convert'"
              (click)="toggleMenu('convert')"
            >
              <span>CONVERT PDF</span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="dropdown-chevron"
                [class.chevron-up]="activeMenu() === 'convert'"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <!-- CONVERT PDF 2-COLUMN DROPDOWN PANEL -->
            @if (activeMenu() === 'convert') {
              <div
                class="convert-dropdown-pane"
                (mouseenter)="cancelCloseMenu()"
                (mouseleave)="closeMenu()"
              >
                <div class="dropdown-top-arrow convert-arrow"></div>
                <div class="convert-grid">
                  <!-- Column 1: CONVERT TO PDF -->
                  <div class="convert-col">
                    <h4 class="convert-col-title">CONVERT TO PDF</h4>
                    <ul class="convert-list">
                      <li>
                        <a routerLink="/images-to-pdf" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-yellow">JPG</span>
                          <span class="item-name">JPG to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/word-to-pdf" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-blue">W</span>
                          <span class="item-name">WORD to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/powerpoint-to-pdf" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-orange">P</span>
                          <span class="item-name">POWERPOINT to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/excel-to-pdf" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-green">X</span>
                          <span class="item-name">EXCEL to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/html-to-pdf" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-amber">&lt;/&gt;</span>
                          <span class="item-name">HTML to PDF</span>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <!-- Column 2: CONVERT FROM PDF -->
                  <div class="convert-col">
                    <h4 class="convert-col-title">CONVERT FROM PDF</h4>
                    <ul class="convert-list">
                      <li>
                        <a routerLink="/pdf-to-jpg" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-yellow">JPG</span>
                          <span class="item-name">PDF to JPG</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-blue">W</span>
                          <span class="item-name">PDF to WORD</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-powerpoint" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-orange">P</span>
                          <span class="item-name">PDF to POWERPOINT</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-excel" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-green">X</span>
                          <span class="item-name">PDF to EXCEL</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="menu-item-link">
                          <span class="icon-chip chip-slate">PDF/A</span>
                          <span class="item-name">PDF to PDF/A</span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- ALL PDF TOOLS (7-Column Mega Menu matching Image 1) -->
          <div
            class="nav-dropdown-wrap mega-wrap"
            (mouseenter)="openMenu('all')"
            (mouseleave)="scheduleCloseMenu()"
          >
            <button
              type="button"
              class="nav-dropdown-trigger"
              [class.active]="activeMenu() === 'all'"
              (click)="toggleMenu('all')"
            >
              <span>ALL PDF TOOLS</span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="dropdown-chevron"
                [class.chevron-up]="activeMenu() === 'all'"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <!-- 7-COLUMN MEGA-MENU PANEL -->
            @if (activeMenu() === 'all') {
              <div
                class="mega-menu-pane"
                (mouseenter)="cancelCloseMenu()"
                (mouseleave)="closeMenu()"
              >
                <div class="dropdown-top-arrow mega-arrow"></div>
                <div class="mega-grid">
                  <!-- COL 1: ORGANIZE PDF -->
                  <div class="mega-col">
                    <h4 class="mega-col-title">ORGANIZE PDF</h4>
                    <ul class="mega-list">
                      <li>
                        <a routerLink="/merge-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="2" width="10" height="10" rx="2" fill="#E53238" />
                            <rect x="12" y="12" width="10" height="10" rx="2" fill="#E53238" />
                          </svg>
                          <span class="mega-name">Merge PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/split-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="2" width="10" height="10" rx="2" fill="#E53238" />
                            <line x1="8" y1="8" x2="4" y2="4" stroke="white" stroke-width="1.8" />
                          </svg>
                          <span class="mega-name">Split PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/split-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="3" stroke="#E53238" stroke-width="2"/>
                            <line x1="8" y1="8" x2="16" y2="16" stroke="#E53238" stroke-width="2"/>
                            <line x1="16" y1="8" x2="8" y2="16" stroke="#E53238" stroke-width="2"/>
                          </svg>
                          <span class="mega-name">Remove pages</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/split-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="3" fill="#FEE2E2"/>
                            <path d="M12 7v10M8 11l4-4 4 4" stroke="#E53238" stroke-width="2"/>
                          </svg>
                          <span class="mega-name">Extract pages</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/merge-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="2" width="8" height="8" rx="2" fill="#E53238"/>
                            <rect x="14" y="2" width="8" height="8" rx="2" fill="#E53238"/>
                            <rect x="2" y="14" width="8" height="8" rx="2" fill="#E53238"/>
                            <rect x="14" y="14" width="8" height="8" rx="2" fill="#E53238"/>
                          </svg>
                          <span class="mega-name">Organize PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/images-to-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="3" stroke="#E53238" stroke-width="1.8"/>
                            <circle cx="12" cy="12" r="4" fill="#E53238"/>
                          </svg>
                          <span class="mega-name">Scan to PDF</span>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <!-- COL 2: OPTIMIZE PDF -->
                  <div class="mega-col">
                    <h4 class="mega-col-title">OPTIMIZE PDF</h4>
                    <ul class="mega-list">
                      <li>
                        <a routerLink="/compress-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="2" width="8" height="8" rx="2" fill="#10B981" />
                            <rect x="14" y="2" width="8" height="8" rx="2" fill="#10B981" />
                            <rect x="2" y="14" width="8" height="8" rx="2" fill="#10B981" />
                            <rect x="14" y="14" width="8" height="8" rx="2" fill="#10B981" />
                          </svg>
                          <span class="mega-name">Compress PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/compress-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                          </svg>
                          <span class="mega-name">Repair PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="3" stroke="#10B981" stroke-width="2"/>
                            <text x="12" y="15" font-size="8" font-weight="900" fill="#10B981" text-anchor="middle">OCR</text>
                          </svg>
                          <span class="mega-name">OCR PDF</span>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <!-- COL 3: CONVERT TO PDF -->
                  <div class="mega-col">
                    <h4 class="mega-col-title">CONVERT TO PDF</h4>
                    <ul class="mega-list">
                      <li>
                        <a routerLink="/images-to-pdf" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-yellow">JPG</span>
                          <span class="mega-name">JPG to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/word-to-pdf" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-blue">W</span>
                          <span class="mega-name">WORD to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/powerpoint-to-pdf" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-orange">P</span>
                          <span class="mega-name">POWERPOINT to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/excel-to-pdf" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-green">X</span>
                          <span class="mega-name">EXCEL to PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/html-to-pdf" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-amber">&lt;/&gt;</span>
                          <span class="mega-name">HTML to PDF</span>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <!-- COL 4: CONVERT FROM PDF -->
                  <div class="mega-col">
                    <h4 class="mega-col-title">CONVERT FROM PDF</h4>
                    <ul class="mega-list">
                      <li>
                        <a routerLink="/pdf-to-jpg" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-yellow">JPG</span>
                          <span class="mega-name">PDF to JPG</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-blue">W</span>
                          <span class="mega-name">PDF to WORD</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-powerpoint" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-orange">P</span>
                          <span class="mega-name">PDF to POWERPOINT</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-excel" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-green">X</span>
                          <span class="mega-name">PDF to EXCEL</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="mega-item-link">
                          <span class="icon-chip chip-slate">PDF/A</span>
                          <span class="mega-name">PDF to PDF/A</span>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <!-- COL 5: EDIT PDF -->
                  <div class="mega-col">
                    <h4 class="mega-col-title">EDIT PDF</h4>
                    <ul class="mega-list">
                      <li>
                        <a routerLink="/rotate-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                          </svg>
                          <span class="mega-name">Rotate PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/edit-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="3" fill="#F5F3FF"/>
                            <text x="12" y="15" font-size="9" font-weight="800" fill="#7C3AED" text-anchor="middle">123</text>
                          </svg>
                          <span class="mega-name">Add page numbers</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/watermark-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke="#7C3AED" stroke-width="2" stroke-dasharray="2 2"/>
                            <text x="12" y="15" font-size="8" font-weight="900" fill="#7C3AED" text-anchor="middle">★</text>
                          </svg>
                          <span class="mega-name">Add watermark</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/edit-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2">
                            <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
                            <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
                          </svg>
                          <span class="mega-name">Crop PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/edit-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          <span class="mega-name">Edit PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/edit-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2">
                            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                            <line x1="7" y1="8" x2="17" y2="8"></line>
                            <line x1="7" y1="12" x2="13" y2="12"></line>
                          </svg>
                          <span class="mega-name">PDF Forms</span>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <!-- COL 6: PDF SECURITY -->
                  <div class="mega-col">
                    <h4 class="mega-col-title">PDF SECURITY</h4>
                    <ul class="mega-list">
                      <li>
                        <a routerLink="/unlock-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                          </svg>
                          <span class="mega-name">Unlock PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/protect-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          <span class="mega-name">Protect PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/sign-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2">
                            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                            <path d="M2 2l7.586 7.586"></path>
                          </svg>
                          <span class="mega-name">Sign PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/protect-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="5" width="18" height="14" rx="2" stroke="#2563EB" stroke-width="2"/>
                            <rect x="6" y="9" width="12" height="6" fill="#2563EB"/>
                          </svg>
                          <span class="mega-name">Redact PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/merge-pdf" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2">
                            <rect x="2" y="3" width="9" height="18" rx="2"></rect>
                            <rect x="13" y="3" width="9" height="18" rx="2"></rect>
                          </svg>
                          <span class="mega-name">Compare PDF</span>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <!-- COL 7: PDF INTELLIGENCE -->
                  <div class="mega-col">
                    <h4 class="mega-col-title">PDF INTELLIGENCE</h4>
                    <ul class="mega-list">
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                          </svg>
                          <span class="mega-name">AI Summarizer</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                          </svg>
                          <span class="mega-name">Translate PDF</span>
                        </a>
                      </li>
                      <li>
                        <a routerLink="/pdf-to-word" (click)="closeMenu()" class="mega-item-link">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#8B5CF6" stroke-width="2"/>
                            <text x="12" y="15" font-size="8" font-weight="900" fill="#8B5CF6" text-anchor="middle">MD</text>
                          </svg>
                          <span class="mega-name">PDF to Markdown</span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            }
          </div>
        </nav>

        <!-- 3. RIGHT HEADER ITEMS (Login, Sign up, 9-dot grid icon) -->
        <div class="header-right">
          <!-- Login link -->
          <a routerLink="/" class="nav-login-link">Login</a>

          <!-- Sign up red button -->
          <a routerLink="/" class="nav-signup-btn">Sign up</a>

          <!-- 9-Dot Grid App Launcher Icon -->
          <div class="apps-launcher-wrap">
            <button
              type="button"
              class="apps-grid-btn"
              (click)="toggleMenu('apps')"
              title="PDF flow Desktop, Mobile & Apps"
              aria-label="Applications"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="4" cy="4" r="2.2"/>
                <circle cx="12" cy="4" r="2.2"/>
                <circle cx="20" cy="4" r="2.2"/>
                <circle cx="4" cy="12" r="2.2"/>
                <circle cx="12" cy="12" r="2.2"/>
                <circle cx="20" cy="12" r="2.2"/>
                <circle cx="4" cy="20" r="2.2"/>
                <circle cx="12" cy="20" r="2.2"/>
                <circle cx="20" cy="20" r="2.2"/>
              </svg>
            </button>

            @if (activeMenu() === 'apps') {
              <div class="apps-dropdown-pane" (mouseleave)="closeMenu()">
                <div class="apps-dropdown-title">PDF flow Ecosystem</div>
                <a routerLink="/" (click)="closeMenu()" class="app-row-item">
                  <span class="app-icon-wrap">💻</span>
                  <div>
                    <strong>PDF Desktop App</strong>
                    <p>Process offline on Windows & Mac</p>
                  </div>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="app-row-item">
                  <span class="app-icon-wrap">📱</span>
                  <div>
                    <strong>PDF Mobile App</strong>
                    <p>iOS & Android scan and sign</p>
                  </div>
                </a>
                <a routerLink="/" (click)="closeMenu()" class="app-row-item">
                  <span class="app-icon-wrap">⚡</span>
                  <div>
                    <strong>Developer REST API</strong>
                    <p>Automate document workflows</p>
                  </div>
                </a>
              </div>
            }
          </div>

          <!-- Mobile Hamburger Toggle -->
          <button class="mobile-toggle" (click)="toggleMobileMenu()" aria-label="Toggle menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- MOBILE DRAWER -->
      @if (mobileMenuOpen()) {
        <div class="mobile-drawer">
          <div class="mobile-links-list">
            <a routerLink="/merge-pdf" (click)="closeMobileMenu()" class="mobile-link">MERGE PDF</a>
            <a routerLink="/split-pdf" (click)="closeMobileMenu()" class="mobile-link">SPLIT PDF</a>
            <a routerLink="/compress-pdf" (click)="closeMobileMenu()" class="mobile-link">COMPRESS PDF</a>
            <a routerLink="/pdf-to-word" (click)="closeMobileMenu()" class="mobile-link">PDF TO WORD</a>
            <a routerLink="/images-to-pdf" (click)="closeMobileMenu()" class="mobile-link">JPG TO PDF</a>
            <a routerLink="/rotate-pdf" (click)="closeMobileMenu()" class="mobile-link">ROTATE PDF</a>
            <a routerLink="/protect-pdf" (click)="closeMobileMenu()" class="mobile-link">PROTECT PDF</a>
          </div>
          <div class="mobile-auth-row">
            <a routerLink="/" (click)="closeMobileMenu()" class="mobile-login-btn">Login</a>
            <a routerLink="/" (click)="closeMobileMenu()" class="mobile-signup-btn">Sign up</a>
          </div>
        </div>
      }
    </header>
  `,
  styles: [`
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #ffffff;
      border-bottom: 1px solid #eef0f3;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 68px;
      padding: 0 32px;
      max-width: 1720px;
      margin: 0 auto;
      position: relative;
    }

    /* 1. BRAND LOGO (Exact iLovePDF signature look) */
    .brand-logo {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      text-decoration: none;
      user-select: none;
      flex-shrink: 0;
      margin-right: 28px;
    }
    .logo-i {
      font-size: 26px;
      font-weight: 900;
      color: #111827;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .logo-heart {
      display: block;
      margin: 0 1px;
      animation: heartbeat 2.8s infinite ease-in-out;
    }
    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      14% { transform: scale(1.18); }
      28% { transform: scale(1); }
      42% { transform: scale(1.12); }
      70% { transform: scale(1); }
    }
    .logo-pdf {
      font-size: 26px;
      font-weight: 900;
      color: #111827;
      letter-spacing: -0.04em;
      line-height: 1;
    }

    /* 2. MAIN NAV LINKS */
    .nav-links {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
    }
    .nav-link,
    .nav-dropdown-trigger {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 8px 14px;
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #1f2937;
      text-decoration: none;
      border-radius: 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.18s ease;
    }
    .nav-link:hover,
    .nav-dropdown-trigger:hover,
    .nav-dropdown-trigger.active {
      color: #E53238;
      background: #fef2f2;
    }
    .dropdown-chevron {
      transition: transform 0.2s ease;
      color: #6b7280;
    }
    .chevron-up {
      transform: rotate(180deg);
      color: #E53238;
    }

    /* DROPDOWNS WRAPPER */
    .nav-dropdown-wrap {
      position: relative;
    }

    /* Dropdown top little pointer arrow */
    .dropdown-top-arrow {
      position: absolute;
      top: -8px;
      width: 16px;
      height: 16px;
      background: #ffffff;
      transform: rotate(45deg);
      border-left: 1px solid #e5e7eb;
      border-top: 1px solid #e5e7eb;
      z-index: 101;
    }
    .convert-arrow {
      left: 36px;
    }
    .mega-arrow {
      left: 54px;
    }

    /* CONVERT PDF (2-COLUMN DROPDOWN PANEL) */
    .convert-dropdown-pane {
      position: absolute;
      top: calc(100% + 10px);
      left: 0;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04);
      padding: 24px 28px;
      width: 480px;
      z-index: 100;
      animation: menuFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .convert-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    .convert-col-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #64748b;
      margin: 0 0 14px;
      text-transform: uppercase;
    }
    .convert-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .menu-item-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 6px;
      border-radius: 6px;
      text-decoration: none;
      color: #1e293b;
      font-size: 13.5px;
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .menu-item-link:hover {
      color: #E53238;
      background: #fef2f2;
      transform: translateX(3px);
    }

    /* CHIP BADGES FOR CONVERSION ICONS */
    .icon-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 5px;
      font-size: 9px;
      font-weight: 900;
      flex-shrink: 0;
      line-height: 1;
    }
    .chip-yellow { background: #FEF08A; color: #854D0E; }
    .chip-blue   { background: #2B579A; color: #FFFFFF; }
    .chip-orange { background: #D24726; color: #FFFFFF; }
    .chip-green  { background: #217346; color: #FFFFFF; }
    .chip-amber  { background: #FDE68A; color: #92400E; font-family: monospace; }
    .chip-slate  { background: #E2E8F0; color: #334155; font-size: 7.5px; }

    /* ALL PDF TOOLS (7-COLUMN FULL-WIDTH MEGA MENU) */
    .mega-wrap {
      position: static;
    }
    .mega-menu-pane {
      position: absolute;
      top: calc(100% + 10px);
      left: 24px;
      right: 24px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 20px 48px -8px rgba(0, 0, 0, 0.14), 0 4px 16px rgba(0, 0, 0, 0.04);
      padding: 28px 32px;
      z-index: 100;
      animation: menuFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .mega-arrow {
      left: 490px;
    }
    .mega-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 20px;
    }
    .mega-col-title {
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #64748b;
      margin: 0 0 16px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .mega-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .mega-item-link {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 4px 6px;
      border-radius: 6px;
      text-decoration: none;
      color: #1e293b;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .mega-item-link:hover {
      color: #E53238;
      background: #fef2f2;
      transform: translateX(3px);
    }
    .mega-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @keyframes menuFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* 3. RIGHT HEADER CONTROLS */
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }
    .nav-login-link {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    .nav-login-link:hover {
      color: #111827;
      background: #f3f4f6;
    }
    .nav-signup-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #E53238;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      padding: 8px 20px;
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(229, 50, 56, 0.25);
      transition: all 0.18s ease;
    }
    .nav-signup-btn:hover {
      background: #d3282e;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(229, 50, 56, 0.35);
    }

    /* 9-DOT GRID LAUNCHER */
    .apps-launcher-wrap {
      position: relative;
    }
    .apps-grid-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 8px;
      color: #4b5563;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .apps-grid-btn:hover {
      color: #111827;
      background: #f3f4f6;
    }
    .apps-dropdown-pane {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 270px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
      padding: 16px;
      z-index: 100;
      animation: menuFadeIn 0.18s ease;
    }
    .apps-dropdown-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    .app-row-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 10px;
      border-radius: 8px;
      text-decoration: none;
      color: #1e293b;
      font-size: 13px;
      transition: all 0.15s ease;
    }
    .app-row-item:hover {
      background: #f8fafc;
      color: #E53238;
    }
    .app-icon-wrap {
      font-size: 18px;
    }
    .app-row-item strong {
      display: block;
      font-size: 13.5px;
      font-weight: 700;
    }
    .app-row-item p {
      margin: 0;
      font-size: 11px;
      color: #64748b;
    }

    /* MOBILE TOGGLE */
    .mobile-toggle {
      display: none;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      color: #1f2937;
      background: none;
      border: none;
      cursor: pointer;
    }

    /* MOBILE DRAWER */
    .mobile-drawer {
      display: none;
      background: #ffffff;
      border-top: 1px solid #e5e7eb;
      padding: 20px 24px;
    }

    @media (max-width: 1240px) {
      .mega-arrow {
        left: 380px;
      }
      .mega-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    @media (max-width: 1024px) {
      .nav-links {
        display: none;
      }
      .mobile-toggle {
        display: flex;
      }
      .mobile-drawer {
        display: block;
      }
      .mobile-links-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      .mobile-link {
        font-size: 15px;
        font-weight: 700;
        color: #111827;
        text-decoration: none;
      }
      .mobile-auth-row {
        display: flex;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid #f1f5f9;
      }
      .mobile-login-btn {
        flex: 1;
        text-align: center;
        padding: 10px;
        border-radius: 8px;
        background: #f3f4f6;
        color: #111827;
        font-weight: 700;
      }
      .mobile-signup-btn {
        flex: 1;
        text-align: center;
        padding: 10px;
        border-radius: 8px;
        background: #E53238;
        color: #ffffff;
        font-weight: 700;
      }
    }
  `]
})
export class HeaderComponent {
  activeMenu = signal<'convert' | 'all' | 'apps' | null>(null);
  mobileMenuOpen = signal<boolean>(false);
  private closeTimer: any = null;

  openMenu(menu: 'convert' | 'all' | 'apps'): void {
    this.cancelCloseMenu();
    this.activeMenu.set(menu);
  }

  toggleMenu(menu: 'convert' | 'all' | 'apps'): void {
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
