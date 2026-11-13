import { describe, it, expect, beforeAll } from 'vitest';

declare const require: any;
declare const __dirname: string;
declare const Buffer: { byteLength(str: string, enc: string): number };

describe('PreBootstrapLoader & Token Consistency', () => {
  let indexHtml: string;
  let stylesCss: string;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    const indexHtmlPath = path.resolve(__dirname, '../../../index.html');
    const stylesCssPath = path.resolve(__dirname, '../../../styles.css');
    indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
    stylesCss = fs.readFileSync(stylesCssPath, 'utf-8');
  });

  it('should include the critical pre-loader style element in index.html', () => {
    expect(indexHtml).toContain('<style id="pt-pre-loader-styles">');
    const styleMatch = indexHtml.match(/<style id="pt-pre-loader-styles">([\s\S]*?)<\/style>/);
    expect(styleMatch).toBeTruthy();

    const cssContent = styleMatch![1];
    // Must be compact critical CSS (< 4KB unminified)
    expect(Buffer.byteLength(cssContent, 'utf8')).toBeLessThan(4096);
  });

  it('should include the preloader DOM and noscript fallback inside <app-root>', () => {
    expect(indexHtml).toContain('id="pt-app-preloader"');
    expect(indexHtml).toContain('class="pt-loader-logo"');
    expect(indexHtml).toContain('id="pt-loader-text"');
    expect(indexHtml).toContain('id="pt-loader-fallback"');
    expect(indexHtml).toContain('<noscript>');
  });

  it('should align preloader hex color values with styles.css design tokens', () => {
    const styleMatch = indexHtml.match(/<style id="pt-pre-loader-styles">([\s\S]*?)<\/style>/);
    expect(styleMatch).toBeTruthy();
    const preloaderCss = styleMatch![1];

    // Key design tokens in Ocean Workspace
    const expectedTokens = [
      { name: '--pt-navy', hex: '#14213D' },
      { name: '--pt-teal-700', hex: '#0F766E' },
      { name: '--pt-teal-600', hex: '#14B8A6' },
      { name: '--pt-teal-50', hex: '#E6F5F3' },
      { name: '--pt-muted', hex: '#4B5563' }
    ];

    for (const token of expectedTokens) {
      // Must be present in styles.css design tokens
      expect(stylesCss).toContain(`${token.name}: ${token.hex}`);
      // Must be used in preloader CSS
      expect(preloaderCss.toUpperCase()).toContain(token.hex.toUpperCase());
    }
  });

  it('should include client-side timeout fallback in inline script', () => {
    expect(indexHtml).toContain('__pt_app_bootstrapped');
    expect(indexHtml).toContain('15000');
  });
});
