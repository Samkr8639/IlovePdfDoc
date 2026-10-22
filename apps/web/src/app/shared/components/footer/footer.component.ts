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
          <a routerLink="/" class="footer-brand">
            <div class="brand-badge">
              <span class="pdf-tag">PDF</span>
            </div>
            <span class="brand-flow">flow</span>
          </a>
          <p class="brand-tagline">
            Fast, secure, and 100% private document toolkit. All core operations execute directly inside your browser memory with zero network uploads.
          </p>
          <div class="privacy-note">
            <span class="privacy-dot"></span>
            <span>Zero file uploads • 100% Client-Side</span>
          </div>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">Popular Services</h4>
          <a routerLink="/merge-pdf" class="footer-link">PDF to Word</a>
          <a routerLink="/merge-pdf" class="footer-link">Word to PDF</a>
          <a routerLink="/images-to-pdf" class="footer-link">JPG to PDF</a>
          <a routerLink="/merge-pdf" class="footer-link">Merge PDF</a>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">PDF Tools</h4>
          <a routerLink="/split-pdf" class="footer-link">Split PDF</a>
          <a routerLink="/rotate-pdf" class="footer-link">Rotate PDF</a>
          <a routerLink="/compress-pdf" class="footer-link">Compress PDF</a>
          <a routerLink="/protect-pdf" class="footer-link">Protect PDF</a>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">Security & Terms</h4>
          <span class="footer-link text-dim">Client-Side Engine</span>
          <span class="footer-link text-dim">No Server Storage</span>
          <span class="footer-link text-dim">GDPR Compliant</span>
          <span class="footer-link text-dim">Open Architecture</span>
        </div>
      </div>

      <div class="container footer-bottom">
        <p class="copyright">© 2026 PDF flow. All rights reserved. Built with in-browser WebAssembly & Web APIs.</p>
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
      margin-top: 72px;
    }
    .footer-content {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 40px;
      padding-bottom: 48px;
      border-bottom: 1px solid var(--surface-border-subtle);
    }
    .footer-brand {
      display: inline-flex;
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
    .brand-tagline {
      margin-top: 14px;
      font-size: 14px;
      color: var(--text-muted);
      max-width: 320px;
      line-height: 1.6;
    }
    .privacy-note {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 5px 12px;
      border-radius: 9999px;
      background: var(--coral-50);
      border: 1px solid var(--coral-200);
      font-size: 12px;
      font-weight: 700;
      color: var(--coral-700);
    }
    .privacy-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--coral-600);
      box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.2);
    }
    .col-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-family: var(--font-display);
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
      font-weight: 500;
    }
    .footer-link:hover {
      color: var(--coral-600);
    }
    .text-dim {
      opacity: 0.7;
      cursor: default;
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
