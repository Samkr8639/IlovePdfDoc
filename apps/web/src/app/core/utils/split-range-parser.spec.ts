import { describe, it, expect } from 'vitest';
import { SplitRangeParser } from './split-range-parser';

describe('SplitRangeParser', () => {
  it('should parse simple single page numbers', () => {
    const res = SplitRangeParser.parse('1, 3, 5', 10);
    expect(res.isValid).toBe(true);
    expect(res.ranges).toEqual([
      { from: 1, to: 1 },
      { from: 3, to: 3 },
      { from: 5, to: 5 }
    ]);
    expect(res.pageNumbers).toEqual([1, 3, 5]);
    expect(res.errors.length).toBe(0);
  });

  it('should parse inclusive ranges and mixed expressions', () => {
    const res = SplitRangeParser.parse('1-3, 5, 8-10', 10);
    expect(res.isValid).toBe(true);
    expect(res.ranges).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
      { from: 8, to: 10 }
    ]);
    expect(res.pageNumbers).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it('should trim surrounding whitespace properly', () => {
    const res = SplitRangeParser.parse('   2 - 4 ,   7   ', 10);
    expect(res.isValid).toBe(true);
    expect(res.ranges).toEqual([
      { from: 2, to: 4 },
      { from: 7, to: 7 }
    ]);
  });

  it('should reject empty or whitespace-only expressions', () => {
    const res = SplitRangeParser.parse('   ', 10);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('empty');
  });

  it('should reject non-integer and malformed ranges', () => {
    const res1 = SplitRangeParser.parse('abc', 10);
    expect(res1.isValid).toBe(false);

    const res2 = SplitRangeParser.parse('1-2-3', 10);
    expect(res2.isValid).toBe(false);
    expect(res2.errors[0]).toContain('Invalid range format');
  });

  it('should reject zero and negative page numbers', () => {
    const res1 = SplitRangeParser.parse('0', 10);
    expect(res1.isValid).toBe(false);
    expect(res1.errors[0]).toContain('less than 1');

    const res2 = SplitRangeParser.parse('0-4', 10);
    expect(res2.isValid).toBe(false);
  });

  it('should reject start page greater than end page', () => {
    const res = SplitRangeParser.parse('5-2', 10);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('start page (5) cannot be greater than end page (2)');
  });

  it('should reject page numbers exceeding document total pages', () => {
    const res = SplitRangeParser.parse('1-5, 12', 10);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('exceeds document total (10)');
  });

  it('should detect duplicate ranges and overlapping pages with warnings', () => {
    const res = SplitRangeParser.parse('1-3, 2-4, 1-3', 10);
    expect(res.isValid).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings.some(w => w.includes('Duplicate range'))).toBe(true);
  });

  it('should generate fixed ranges including final partial group', () => {
    const ranges = SplitRangeParser.generateFixedRanges(10, 3);
    expect(ranges).toEqual([
      { from: 1, to: 3 },
      { from: 4, to: 6 },
      { from: 7, to: 9 },
      { from: 10, to: 10 }
    ]);
  });

  it('should format ranges array back to string', () => {
    const formatted = SplitRangeParser.formatRanges([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
      { from: 7, to: 9 }
    ]);
    expect(formatted).toBe('1-3, 5, 7-9');
  });
});
