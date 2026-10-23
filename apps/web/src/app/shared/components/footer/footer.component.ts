import { Component, inject, signal, ElementRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer-enterprise">
      <div class="container footer-main-grid">
        <!-- Col 1: PRODUCT -->
        <div class="footer-nav-col">
          <h4 class="footer-col-head">PRODUCT</h4>
          <ul class="footer-nav-list">
            <li><a routerLink="/" class="footer-item">PDF flow Home</a></li>
            <li><a routerLink="/merge-pdf" class="footer-item">Merge PDF</a></li>
            <li><a routerLink="/split-pdf" class="footer-item">Split PDF</a></li>
            <li><a routerLink="/compress-pdf" class="footer-item">Compress PDF</a></li>
            <li><a routerLink="/pdf-to-word" class="footer-item">PDF to Word</a></li>
            <li><a routerLink="/protect-pdf" class="footer-item">PDF Security</a></li>
          </ul>
        </div>

        <!-- Col 2: RESOURCE -->
        <div class="footer-nav-col">
          <h4 class="footer-col-head">RESOURCE</h4>
          <ul class="footer-nav-list">
            <li><a routerLink="/" class="footer-item">Web PDF Studio</a></li>
            <li><a routerLink="/" class="footer-item">Client-Side Engine</a></li>
            <li><a routerLink="/" class="footer-item">Browser Extensions</a></li>
            <li><a routerLink="/" class="footer-item">Help & Tutorials</a></li>
            <li><a routerLink="/" class="footer-item">Release Changelog</a></li>
            <li><a routerLink="/" class="footer-item">System Status</a></li>
          </ul>
        </div>

        <!-- Col 3: SOLUTIONS -->
        <div class="footer-nav-col">
          <h4 class="footer-col-head">SOLUTIONS</h4>
          <ul class="footer-nav-list">
            <li><a routerLink="/" class="footer-item">Individual & Freelance</a></li>
            <li><a routerLink="/" class="footer-item">Education & Students</a></li>
            <li><a routerLink="/" class="footer-item">Legal & Contracts</a></li>
            <li><a routerLink="/" class="footer-item">Financial Records</a></li>
            <li><a routerLink="/" class="footer-item">Academic Research</a></li>
            <li><a routerLink="/" class="footer-item">Government Forms</a></li>
          </ul>
        </div>

        <!-- Col 4: LEGAL -->
        <div class="footer-nav-col">
          <h4 class="footer-col-head">LEGAL</h4>
          <ul class="footer-nav-list">
            <li><a routerLink="/" class="footer-item">Privacy Policy</a></li>
            <li><a routerLink="/" class="footer-item">Terms & Conditions</a></li>
            <li><a routerLink="/" class="footer-item">GDPR Compliance</a></li>
            <li><a routerLink="/" class="footer-item">Security Whitepaper</a></li>
            <li><a routerLink="/" class="footer-item">Cookie Settings</a></li>
          </ul>
        </div>

        <!-- Col 5: COMPANY -->
        <div class="footer-nav-col">
          <h4 class="footer-col-head">COMPANY</h4>
          <ul class="footer-nav-list">
            <li><a routerLink="/" class="footer-item">About us</a></li>
            <li><a routerLink="/" class="footer-item">Contact & Support</a></li>
            <li><a routerLink="/" class="footer-item">Blog & Guides</a></li>
            <li><a routerLink="/" class="footer-item">Press & Media Kit</a></li>
            <li><a routerLink="/" class="footer-item">Careers</a></li>
            <li><a routerLink="/" class="footer-item">Community Forum</a></li>
          </ul>
        </div>
      </div>

      <!-- FOOTER BOTTOM BAR (Language selector, Copyright, Socials) -->
      <div class="footer-sub-bar">
        <div class="container sub-bar-inner">
          <!-- Real Language Dropup Selector (Exact UI matching Reference) -->
          <div class="lang-dropup-container notranslate skiptranslate" translate="no">
            <button
              type="button"
              class="lang-selector-btn notranslate skiptranslate"
              translate="no"
              (click)="toggleMenu($event)"
              [class.active]="isMenuOpen()"
              aria-label="Select Language"
            >
              <svg class="globe-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"></path>
              </svg>
              <span class="lang-label notranslate" translate="no">{{ currentLang().nativeName }}</span>
              <svg class="chevron-svg" [class.chevron-rotate]="isMenuOpen()" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <!-- 3-Column Upward Flyout Dropdown -->
            @if (isMenuOpen()) {
              <div class="lang-dropup-menu notranslate skiptranslate" translate="no" (click)="$event.stopPropagation()">
                <div class="lang-dropup-grid notranslate" translate="no">
                  <!-- Column 1 -->
                  <div class="lang-menu-col notranslate" translate="no">
                    @for (lang of col1; track lang.code) {
                      <button
                        type="button"
                        class="lang-menu-item notranslate skiptranslate"
                        translate="no"
                        [class.active-item]="currentLang().code === lang.code"
                        (click)="selectLanguage(lang.code)"
                      >
                        <span class="item-check" [class.visible]="currentLang().code === lang.code">✓</span>
                        <span class="item-text notranslate" translate="no">{{ lang.nativeName }}</span>
                      </button>
                    }
                  </div>

                  <!-- Column 2 -->
                  <div class="lang-menu-col notranslate" translate="no">
                    @for (lang of col2; track lang.code) {
                      <button
                        type="button"
                        class="lang-menu-item notranslate skiptranslate"
                        translate="no"
                        [class.active-item]="currentLang().code === lang.code"
                        (click)="selectLanguage(lang.code)"
                      >
                        <span class="item-check" [class.visible]="currentLang().code === lang.code">✓</span>
                        <span class="item-text notranslate" translate="no">{{ lang.nativeName }}</span>
                      </button>
                    }
                  </div>

                  <!-- Column 3 -->
                  <div class="lang-menu-col notranslate" translate="no">
                    @for (lang of col3; track lang.code) {
                      <button
                        type="button"
                        class="lang-menu-item notranslate skiptranslate"
                        translate="no"
                        [class.active-item]="currentLang().code === lang.code"
                        (click)="selectLanguage(lang.code)"
                      >
                        <span class="item-check" [class.visible]="currentLang().code === lang.code">✓</span>
                        <span class="item-text notranslate" translate="no">{{ lang.nativeName }}</span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="copyright-text">
            © 2026 PDF flow. All rights reserved. 100% In-Browser Privacy Guarantee.
          </div>

          <div class="social-icons-row">
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="X Twitter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="Facebook">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer-enterprise {
      background: #1e242d;
      color: #94a3b8;
      padding-top: 64px;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .footer-main-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 36px;
      padding-bottom: 56px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .footer-nav-col {
      display: flex;
      flex-direction: column;
    }
    .footer-col-head {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #ffffff;
      margin: 0 0 20px;
    }
    .footer-nav-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .footer-item {
      font-size: 13.5px;
      color: #94a3b8;
      text-decoration: none;
      transition: all 0.18s ease;
    }
    .footer-item:hover {
      color: #ffffff;
      transform: translateX(3px);
    }

    /* FOOTER SUB BAR */
    .footer-sub-bar {
      background: #171b22;
      padding: 20px 0;
      position: relative;
    }
    .sub-bar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }

    /* 3-COLUMN LANGUAGE DROPUP SELECTOR */
    .lang-dropup-container {
      position: relative;
      display: inline-block;
    }
    .lang-selector-btn {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 7px 14px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 7px;
      font-size: 13.5px;
      font-weight: 600;
      color: #ffffff;
      cursor: pointer;
      transition: all 0.18s ease;
      font-family: inherit;
    }
    .lang-selector-btn:hover,
    .lang-selector-btn.active {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.5);
    }
    .globe-icon-svg {
      color: #cbd5e1;
      flex-shrink: 0;
    }
    .lang-label {
      font-size: 13.5px;
      color: #ffffff;
    }
    .chevron-svg {
      color: #94a3b8;
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .chevron-rotate {
      transform: rotate(180deg);
      color: #ffffff;
    }

    /* WHITE DROPUP MENU PANEL (Exact look from reference image) */
    .lang-dropup-menu {
      position: absolute;
      bottom: calc(100% + 12px);
      left: 0;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3), 0 2px 10px rgba(0, 0, 0, 0.08);
      padding: 24px 30px;
      width: 650px;
      z-index: 100;
      animation: dropupFadeIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes dropupFadeIn {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .lang-dropup-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 24px;
    }
    .lang-menu-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .lang-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: transparent;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      cursor: pointer;
      text-align: left;
      transition: all 0.14s ease;
      font-family: inherit;
    }
    .lang-menu-item:hover {
      color: #E53238;
      background: #fef2f2;
    }
    .lang-menu-item.active-item {
      font-weight: 700;
      color: #0f172a;
    }
    .item-check {
      width: 14px;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      visibility: hidden;
      flex-shrink: 0;
    }
    .item-check.visible {
      visibility: visible;
    }
    .item-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .copyright-text {
      font-size: 13px;
      color: #64748b;
    }
    .social-icons-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .social-icon {
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.18s ease;
    }
    .social-icon:hover {
      color: #ffffff;
      transform: translateY(-2px);
    }

    @media (max-width: 1024px) {
      .footer-main-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .lang-dropup-menu {
        width: calc(100vw - 32px);
        max-width: 520px;
        padding: 18px 20px;
      }
      .lang-dropup-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .footer-main-grid {
        grid-template-columns: 1fr;
        gap: 32px;
      }
      .sub-bar-inner {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `]
})
export class FooterComponent {
  private translationService = inject(TranslationService);
  private elementRef = inject(ElementRef);
  isMenuOpen = signal<boolean>(false);

  // Exact 3 columns matching reference image
  readonly col1 = this.translationService.languages.slice(0, 9);
  readonly col2 = this.translationService.languages.slice(9, 18);
  readonly col3 = this.translationService.languages.slice(18, 26);

  get currentLang() {
    return this.translationService.currentLanguage;
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
}

