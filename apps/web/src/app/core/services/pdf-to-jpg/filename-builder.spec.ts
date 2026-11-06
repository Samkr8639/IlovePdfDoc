import { describe, it, expect } from 'vitest';
import {
  sanitizeBaseName,
  buildPageFilename,
  buildExtractedImageFilename,
  buildZipFilename,
  buildCombinedFilename
} from './filename-builder';

describe('filename-builder', () => {
  it('sanitizes filenames while keeping letters, digits, and safe unicode en-dash', () => {
    expect(sanitizeBaseName('Annual_Report–2026.pdf')).toBe('Annual_Report–2026');
    expect(sanitizeBaseName('../../malicious/path.pdf')).toBe('.maliciouspath');
    expect(sanitizeBaseName('file:with*invalid|chars?.pdf')).toBe('filewithinvalidchars');
  });

  it('builds zero-padded page filenames', () => {
    expect(buildPageFilename('Report.pdf', 5, 20)).toBe('Report-page-005.jpg');
    expect(buildPageFilename('Report.pdf', 123, 1000)).toBe('Report-page-0123.jpg');
  });

  it('builds zero-padded extracted image filenames', () => {
    expect(buildExtractedImageFilename('Brochure.pdf', 3, 2, 25)).toBe('Brochure-img-p003-02.jpg');
  });

  it('builds appropriate zip filenames', () => {
    expect(buildZipFilename('Document.pdf', 'convert_pages')).toBe('Document-jpg.zip');
    expect(buildZipFilename('Document.pdf', 'extract_images')).toBe('Document-images.zip');
  });

  it('builds combined long image filename', () => {
    expect(buildCombinedFilename('Invoice.pdf')).toBe('Invoice-combined.jpg');
  });
});

