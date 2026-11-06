/**
 * Filename sanitization and generation utilities for PDF to JPG conversion.
 */

/**
 * Sanitizes a base filename:
 * - Keeps letters, digits, and safe punctuation: hyphen '-', en-dash '–', underscore '_', dot '.'
 * - Strips directory traversal ('..'), forward/back slashes, and control characters
 * - Caps base name at 120 characters
 */
export function sanitizeBaseName(filename: string): string {
  if (!filename) return 'document';

  // Strip extension if present
  let base = filename.replace(/\.[^/.]+$/, '');

  // Strip control characters (0x00-0x1F, 0x7F) and path separators
  base = base.replace(/[\x00-\x1f\x7f/\\?%*:|"<>]/g, '');

  // Strip path traversal dots
  base = base.replace(/\.{2,}/g, '.');

  // Collapse consecutive whitespace
  base = base.trim().replace(/\s+/g, '_');

  if (!base) base = 'document';

  // Cap at 120 characters
  if (base.length > 120) {
    base = base.substring(0, 120);
  }

  return base;
}

/**
 * Builds page JPG filename: e.g. "Invoice-page-001.jpg"
 */
export function buildPageFilename(
  originalFilename: string,
  pageNumber: number,
  totalPages: number
): string {
  const base = sanitizeBaseName(originalFilename);
  const padWidth = Math.max(3, String(totalPages).length);
  const paddedNum = String(pageNumber).padStart(padWidth, '0');
  return `${base}-page-${paddedNum}.jpg`;
}

/**
 * Builds extracted image filename: e.g. "Report-img-p003-01.jpg"
 */
export function buildExtractedImageFilename(
  originalFilename: string,
  pageNumber: number,
  imageIndexOnPage: number,
  totalPages: number
): string {
  const base = sanitizeBaseName(originalFilename);
  const padWidth = Math.max(3, String(totalPages).length);
  const paddedPage = String(pageNumber).padStart(padWidth, '0');
  const paddedIdx = String(imageIndexOnPage).padStart(2, '0');
  return `${base}-img-p${paddedPage}-${paddedIdx}.jpg`;
}

/**
 * Builds ZIP filename: e.g. "Invoice-jpg.zip" or "Invoice-images.zip"
 */
export function buildZipFilename(
  originalFilename: string,
  mode: 'convert_pages' | 'extract_images'
): string {
  const base = sanitizeBaseName(originalFilename);
  return mode === 'convert_pages' ? `${base}-jpg.zip` : `${base}-images.zip`;
}

/**
 * Builds combined long image filename: e.g. "Invoice-combined.jpg"
 */
export function buildCombinedFilename(originalFilename: string): string {
  const base = sanitizeBaseName(originalFilename);
  return `${base}-combined.jpg`;
}

