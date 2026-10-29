import { describe, it, expect } from '@jest/globals';
import { sanitizeSheetName, getUniqueSheetName, cutAtWordBoundary } from '../src/services/pdf-to-excel/build';

describe('PDF to Excel: Sheet Naming & Word Boundary Truncation (Step 6)', () => {
  it('cuts sheet names at word boundaries instead of mid-word', () => {
    const longName = 'Impulse Decisions Auction Portal Developer Brief';
    const sanitized = sanitizeSheetName(longName);
    expect(sanitized.length).toBeLessThanOrEqual(31);
    // Should NOT end in partial word like 'Porta'
    expect(sanitized).not.toMatch(/Porta$/);
    // Should end at a word boundary
    expect(['Impulse Decisions Auction', 'Impulse Decisions Auction Portal']).toContain(sanitized);
  });

  it('preserves short sheet names intact', () => {
    expect(sanitizeSheetName('Payments')).toBe('Payments');
    expect(sanitizeSheetName('P1 – Table 1')).toBe('P1 – Table 1');
  });

  it('generates unique sheet names capped at 31 chars at word boundaries', () => {
    const existing = new Set<string>();
    const name1 = getUniqueSheetName('Impulse Decisions Auction Portal', existing);
    const name2 = getUniqueSheetName('Impulse Decisions Auction Portal', existing);
    const name3 = getUniqueSheetName('Impulse Decisions Auction Portal', existing);

    expect(name1.length).toBeLessThanOrEqual(31);
    expect(name2.length).toBeLessThanOrEqual(31);
    expect(name3.length).toBeLessThanOrEqual(31);

    expect(name1).not.toBe(name2);
    expect(name2).not.toBe(name3);
    expect(name2).toContain('(2)');
    expect(name3).toContain('(3)');
  });

  it('formats fallback sheet names as P{page} – Table {n}', () => {
    const page = 2;
    const tableIndex = 1;
    const defaultName = `P${page} – Table ${tableIndex}`;
    expect(sanitizeSheetName(defaultName)).toBe('P2 – Table 1');
  });
});
