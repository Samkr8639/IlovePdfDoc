import { Component, inject, signal, computed } from '@angular/core';
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
          <!-- Real Interactive Language Selector -->
          <button
            type="button"
            class="lang-selector-chip"
            (click)="openLanguageModal()"
            aria-label="Select your language"
          >
            <span class="lang-flag-icon">{{ currentLang().flag }}</span>
            <span class="lang-name-label">{{ currentLang().nativeName }}</span>
            <span class="chevron-sm">▾</span>
          </button>

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

      <!-- LANGUAGE SELECTOR MODAL DIALOG -->
      @if (isModalOpen()) {
        <div class="lang-modal-backdrop" (click)="closeLanguageModal()">
          <div class="lang-modal-dialog" (click)="$event.stopPropagation()">
            <!-- Modal Header -->
            <div class="lang-modal-header">
              <div class="modal-title-box">
                <div class="modal-globe-badge">🌐</div>
                <div>
                  <h3 class="modal-title">Select Your Native Language</h3>
                  <p class="modal-subtitle">Instantly translate the entire website into your native language</p>
                </div>
              </div>
              <button
                type="button"
                class="modal-close-btn"
                (click)="closeLanguageModal()"
                aria-label="Close language selector"
              >
                ✕
              </button>
            </div>

            <!-- Search input -->
            <div class="lang-search-box">
              <svg class="search-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                class="lang-search-input"
                placeholder="Search by language name or country (e.g. Hindi, Español, Français)..."
                [value]="searchQuery()"
                (input)="onSearch($event)"
              />
              @if (searchQuery()) {
                <button type="button" class="clear-search-btn" (click)="clearSearch()">✕</button>
              }
            </div>

            <!-- Language Cards Grid -->
            <div class="lang-grid-scroll">
              <div class="lang-cards-grid">
                @for (lang of filteredLanguages(); track lang.code) {
                  <button
                    type="button"
                    class="lang-card-item"
                    [class.active-lang-item]="currentLang().code === lang.code"
                    (click)="selectLanguage(lang.code)"
                  >
                    <span class="lang-flag-emoji">{{ lang.flag }}</span>
                    <div class="lang-labels">
                      <span class="native-label">{{ lang.nativeName }}</span>
                      <span class="english-label">{{ lang.name }}</span>
                    </div>
                    @if (currentLang().code === lang.code) {
                      <span class="check-icon">✓</span>
                    }
                  </button>
                }
              </div>

              @if (filteredLanguages().length === 0) {
                <div class="no-results-msg">
                  <p>No language found matching "<strong>{{ searchQuery() }}</strong>"</p>
                </div>
              }
            </div>

            <!-- Modal Footer -->
            <div class="lang-modal-footer">
              <span class="modal-footer-hint">✨ 100% In-browser instant native translation</span>
            </div>
          </div>
        </div>
      }
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
    }
    .sub-bar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }
    .lang-selector-chip {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 7px 16px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 600;
      color: #f1f5f9;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .lang-selector-chip:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.3);
      color: #ffffff;
      transform: translateY(-1px);
    }
    .lang-flag-icon {
      font-size: 16px;
      line-height: 1;
    }
    .lang-name-label {
      font-weight: 700;
    }
    .chevron-sm {
      font-size: 10px;
      color: #94a3b8;
      transition: transform 0.2s ease;
    }
    .lang-selector-chip:hover .chevron-sm {
      transform: translateY(1px);
      color: #ffffff;
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

    /* LANGUAGE SELECTOR MODAL DIALOG */
    .lang-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .lang-modal-dialog {
      background: #ffffff;
      color: #0f172a;
      width: 100%;
      max-width: 680px;
      max-height: 85vh;
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: dialogPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes dialogPop {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .lang-modal-header {
      padding: 24px 28px 18px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
    }
    .modal-title-box {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .modal-globe-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #fef2f2;
      border: 1px solid #fee2e2;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }
    .modal-title {
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 3px;
      letter-spacing: -0.01em;
    }
    .modal-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .modal-close-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      transition: all 0.18s ease;
      cursor: pointer;
      border: none;
    }
    .modal-close-btn:hover {
      background: #e2e8f0;
      color: #0f172a;
      transform: rotate(90deg);
    }

    /* SEARCH BOX */
    .lang-search-box {
      padding: 14px 28px;
      position: relative;
      display: flex;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
      background: #f8fafc;
    }
    .search-svg {
      position: absolute;
      left: 42px;
      color: #94a3b8;
      pointer-events: none;
    }
    .lang-search-input {
      width: 100%;
      padding: 11px 40px 11px 44px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      font-size: 14px;
      color: #0f172a;
      background: #ffffff;
      outline: none;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .lang-search-input:focus {
      border-color: #E53238;
      box-shadow: 0 0 0 3px rgba(229, 50, 56, 0.15);
    }
    .clear-search-btn {
      position: absolute;
      right: 42px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      cursor: pointer;
      border: none;
    }
    .clear-search-btn:hover {
      background: #cbd5e1;
      color: #0f172a;
    }

    /* GRID SCROLL */
    .lang-grid-scroll {
      padding: 20px 28px;
      overflow-y: auto;
      max-height: 420px;
    }
    .lang-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .lang-card-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      text-align: left;
      transition: all 0.18s ease;
      position: relative;
    }
    .lang-card-item:hover {
      border-color: #fca5a5;
      background: #fff5f5;
      transform: translateY(-1px);
    }
    .lang-card-item.active-lang-item {
      border-color: #E53238;
      background: #fef2f2;
      box-shadow: 0 0 0 1px #E53238;
    }
    .lang-flag-emoji {
      font-size: 22px;
      line-height: 1;
    }
    .lang-labels {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .native-label {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .english-label {
      font-size: 11.5px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .check-icon {
      font-size: 14px;
      font-weight: 900;
      color: #E53238;
      margin-left: auto;
    }
    .no-results-msg {
      text-align: center;
      padding: 36px 0;
      color: #64748b;
      font-size: 14px;
    }

    .lang-modal-footer {
      padding: 14px 28px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-footer-hint {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }

    @media (max-width: 1024px) {
      .footer-main-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .lang-cards-grid {
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
        align-items: center;
        text-align: center;
      }
      .lang-cards-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class FooterComponent {
  private translationService = inject(TranslationService);
  isModalOpen = signal<boolean>(false);
  searchQuery = signal<string>('');

  get currentLang() {
    return this.translationService.currentLanguage;
  }

  filteredLanguages = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.translationService.languages;
    return this.translationService.languages.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  openLanguageModal(): void {
    this.searchQuery.set('');
    this.isModalOpen.set(true);
  }

  closeLanguageModal(): void {
    this.isModalOpen.set(false);
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  selectLanguage(langCode: string): void {
    this.translationService.setLanguage(langCode);
    this.closeLanguageModal();
  }
}

