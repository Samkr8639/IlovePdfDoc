import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="container footer-content">
        <div class="footer-brand-col">
          <div class="brand">
            <span class="brand-name">Paper<span class="brand-highlight">Flow</span></span>
          </div>
          <p class="brand-tagline">
            Fast, secure, and 100% private online document tools. All core operations execute directly inside your browser memory.
          </p>
          <div class="privacy-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shield-icon">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Zero file uploads for client-side tools.</span>
          </div>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">Organize PDF</h4>
          <a routerLink="/merge-pdf" class="footer-link">Merge PDF</a>
          <a routerLink="/split-pdf" class="footer-link">Split PDF</a>
          <a routerLink="/rotate-pdf" class="footer-link">Rotate PDF</a>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">Convert</h4>
          <a routerLink="/images-to-pdf" class="footer-link">JPG to PDF</a>
          <a routerLink="/compress-pdf" class="footer-link">Compress PDF</a>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">Security & Info</h4>
          <span class="footer-link text-dim">100% Free Tier</span>
          <span class="footer-link text-dim">Open Architecture</span>
          <span class="footer-link text-dim">Client-Side Engine</span>
        </div>
      </div>

      <div class="container footer-bottom">
        <p class="copyright">© 2026 PaperFlow. All rights reserved. Open-source local-first PDF platform.</p>
        <div class="bottom-links">
          <span>Privacy Guaranteed</span>
          <span>•</span>
          <span>No Credit Card Required</span>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      background-color: #ffffff;
      border-top: 1px solid var(--surface-border);
      padding: 64px 0 32px;
      margin-top: 80px;
    }
    .footer-content {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 40px;
      padding-bottom: 48px;
      border-bottom: 1px solid var(--surface-border-subtle);
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-main);
    }
    .brand-highlight {
      color: var(--primary-600);
    }
    .brand-tagline {
      margin-top: 12px;
      font-size: 14px;
      color: var(--text-muted);
      max-width: 320px;
      line-height: 1.6;
    }
    .privacy-note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--emerald-700);
    }
    .shield-icon {
      color: var(--emerald-600);
    }
    .col-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-main);
      margin-bottom: 16px;
    }
    .footer-links-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .footer-link {
      font-size: 14px;
      color: var(--text-muted);
      transition: color 0.15s ease;
    }
    .footer-link:hover {
      color: var(--primary-600);
    }
    .text-dim {
      opacity: 0.7;
    }
    .footer-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 32px;
      font-size: 13px;
      color: var(--text-light);
    }
    .bottom-links {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    @media (max-width: 768px) {
      .footer-content {
        grid-template-columns: 1fr;
        gap: 32px;
      }
      .footer-bottom {
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }
    }
  `]
})
export class FooterComponent {}
