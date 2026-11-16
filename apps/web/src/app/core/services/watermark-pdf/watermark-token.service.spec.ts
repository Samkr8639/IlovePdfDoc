import { describe, it, expect, beforeEach } from 'vitest';
import { WatermarkTokenService } from './watermark-token.service';

describe('WatermarkTokenService', () => {
  let service: WatermarkTokenService;

  beforeEach(() => {
    service = new WatermarkTokenService();
  });

  it('detects presence of dynamic tokens correctly', () => {
    expect(service.hasDynamicTokens('Page {page} of {pages}')).toBe(true);
    expect(service.hasDynamicTokens('Stamped on {DATE}')).toBe(true);
    expect(service.hasDynamicTokens('File: {filename}')).toBe(true);
    expect(service.hasDynamicTokens('CONFIDENTIAL')).toBe(false);
    expect(service.hasDynamicTokens('{unknown_token}')).toBe(false);
  });

  it('detects per-page variation token {page}', () => {
    expect(service.hasPerPageToken('Page {page} of {pages}')).toBe(true);
    expect(service.hasPerPageToken('Total {pages} pages')).toBe(false);
    expect(service.hasPerPageToken('{filename} - {date}')).toBe(false);
  });

  it('evaluates {page} and {pages} accurately', () => {
    const text = 'Page {page} of {pages}';
    const result = service.evaluate(text, {
      pageNumber: 3,
      totalPages: 10,
      filename: 'Sample.pdf'
    });
    expect(result).toBe('Page 3 of 10');
  });

  it('evaluates case-insensitive token variants', () => {
    const text = '{PAGE}/{PAGES} - {FILENAME}';
    const result = service.evaluate(text, {
      pageNumber: 5,
      totalPages: 8,
      filename: 'AnnualReport.pdf'
    });
    expect(result).toBe('5/8 - AnnualReport');
  });

  it('strips .pdf extension and path from {filename}', () => {
    const result = service.evaluate('Confidential: {filename}', {
      pageNumber: 1,
      totalPages: 1,
      filename: '/path/to/my-document.PDF'
    });
    expect(result).toBe('Confidential: my-document');
  });

  it('formats {date} using Intl localization', () => {
    const fixedDate = new Date(2026, 10, 16); // Nov 16, 2026
    const result = service.evaluate('Draft on {date}', {
      pageNumber: 1,
      totalPages: 1,
      filename: 'test.pdf',
      date: fixedDate,
      locale: 'en-US'
    });
    expect(result).toContain('Nov');
    expect(result).toContain('2026');
  });

  it('handles multiple occurrences and complex templates', () => {
    const template = '{filename} (p. {page}/{pages}) - {filename} {date}';
    const fixedDate = new Date(2026, 0, 15);
    const result = service.evaluate(template, {
      pageNumber: 2,
      totalPages: 15,
      filename: 'Specs.pdf',
      date: fixedDate,
      locale: 'en-US'
    });
    expect(result).toContain('Specs (p. 2/15) - Specs');
    expect(result).toContain('2026');
  });

  it('returns template unmodified if no tokens exist', () => {
    const plain = 'APPROVED FOR RELEASE';
    const result = service.evaluate(plain, {
      pageNumber: 1,
      totalPages: 1,
      filename: 'test.pdf'
    });
    expect(result).toBe('APPROVED FOR RELEASE');
  });
});
