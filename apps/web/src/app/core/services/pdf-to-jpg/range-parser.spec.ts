import { describe, it, expect } from 'vitest';
import { parsePageRange, formatPageRange } from './range-parser';

describe('range-parser', () => {
  it('parses valid simple numbers and ranges', () => {
    const res = parsePageRange('1-3, 5, 8-10');
    expect(res.valid).toBe(true);
    expect(res.pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it('handles irregular whitespace and trailing commas cleanly', () => {
    const res = parsePageRange('  1 - 3 ,  5 , 7 - 8  ');
    expect(res.valid).toBe(true);
    expect(res.pages).toEqual([1, 2, 3, 5, 7, 8]);
  });

  it('deduplicates overlapping page selections and sorts them', () => {
    const res = parsePageRange('5, 1-3, 2-4, 5, 1');
    expect(res.valid).toBe(true);
    expect(res.pages).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects start greater than end (reverse range)', () => {
    const res = parsePageRange('5-2');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('cannot be greater than');
  });

  it('rejects invalid syntax with letters or special characters', () => {
    expect(parsePageRange('1-3, foo').valid).toBe(false);
    expect(parsePageRange('1..3').valid).toBe(false);
    expect(parsePageRange('').valid).toBe(false);
    expect(parsePageRange('   ').valid).toBe(false);
  });

  it('enforces totalPages boundary', () => {
    const res = parsePageRange('1-5, 8', 6);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('exceeds document page count');
  });

  it('formats array of numbers back to canonical range string', () => {
    expect(formatPageRange([1, 2, 3, 5, 8, 9, 10])).toBe('1-3, 5, 8-10');
    expect(formatPageRange([1])).toBe('1');
    expect(formatPageRange([1, 3, 5])).toBe('1, 3, 5');
    expect(formatPageRange([])).toBe('');
  });
});
