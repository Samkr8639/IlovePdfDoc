/**
 * Watermark Token Service
 * Dynamic token evaluation for text watermarks:
 * {page}, {pages}, {date}, {filename}
 * Supports case-insensitivity, localization, and per-page variation detection.
 */

import { Injectable } from '@angular/core';

export interface WatermarkTokenContext {
  pageNumber: number; // 1-based
  totalPages: number;
  filename: string;
  date?: Date;
  locale?: string;
  dateOptions?: Intl.DateTimeFormatOptions;
}

@Injectable({
  providedIn: 'root'
})
export class WatermarkTokenService {
  private static readonly TOKEN_PATTERN = /\{(page|pages|date|filename)\}/gi;
  private static readonly PER_PAGE_TOKEN = /\{page\}/i;

  /**
   * Checks whether the template string contains any dynamic watermark tokens.
   */
  hasDynamicTokens(template: string): boolean {
    if (!template) return false;
    return /\{(page|pages|date|filename)\}/i.test(template);
  }

  /**
   * Checks whether the template contains {page}, requiring per-page text layout.
   */
  hasPerPageToken(template: string): boolean {
    if (!template) return false;
    return WatermarkTokenService.PER_PAGE_TOKEN.test(template);
  }

  /**
   * Evaluates all tokens in the template for a given page context.
   */
  evaluate(template: string, context: WatermarkTokenContext): string {
    if (!template) return '';

    const cleanFilename = this.sanitizeFilename(context.filename);
    const dateObj = context.date || new Date();
    const locale = context.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

    const dateOptions: Intl.DateTimeFormatOptions = context.dateOptions || {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };

    let formattedDate = '';
    try {
      formattedDate = new Intl.DateTimeFormat(locale, dateOptions).format(dateObj);
    } catch {
      formattedDate = dateObj.toISOString().slice(0, 10);
    }

    return template.replace(WatermarkTokenService.TOKEN_PATTERN, (match, tokenName) => {
      const lower = tokenName.toLowerCase();
      switch (lower) {
        case 'page':
          return String(Math.max(1, context.pageNumber));
        case 'pages':
          return String(Math.max(1, context.totalPages));
        case 'date':
          return formattedDate;
        case 'filename':
          return cleanFilename;
        default:
          return match;
      }
    });
  }

  /**
   * Extracts clean document title from filename by stripping path and .pdf extension.
   */
  sanitizeFilename(rawFilename: string): string {
    if (!rawFilename) return 'Document';
    const basename = rawFilename.split(/[/\\]/).pop() || rawFilename;
    return basename.replace(/\.pdf$/i, '').trim() || 'Document';
  }
}
