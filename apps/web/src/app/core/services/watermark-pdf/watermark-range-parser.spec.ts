import { describe, it, expect } from 'vitest';
import { parseWatermarkPages } from './watermark-range-parser';

describe('Watermark Range Parser', () => {
  it('selects all pages when mode is all', () => {
    const res = parseWatermarkPages('all', '', 'all', 5);
    expect(res.isValid).toBe(true);
    expect(res.pageIndices).toEqual([0, 1, 2, 3, 4]);
    expect(res.selectedPagesCount).toBe(5);
    expect(res.summaryText).toBe('Will be added to 5 of 5 pages');
  });

  it('filters all pages by odd and even presets', () => {
    const oddRes = parseWatermarkPages('all', '', 'odd', 5);
    expect(oddRes.pageIndices).toEqual([0, 2, 4]); // pages 1, 3, 5

    const evenRes = parseWatermarkPages('all', '', 'even', 5);
    expect(evenRes.pageIndices).toEqual([1, 3]); // pages 2, 4
  });

  it('filters first and last page presets', () => {
    const firstRes = parseWatermarkPages('all', '', 'first', 10);
    expect(firstRes.pageIndices).toEqual([0]);

    const lastRes = parseWatermarkPages('all', '', 'last', 10);
    expect(lastRes.pageIndices).toEqual([9]);
  });

  it('parses custom forgiving ranges with commas and whitespace', () => {
    const res = parseWatermarkPages('custom', '1-3, 5, 8-10', 'all', 12);
    expect(res.isValid).toBe(true);
    expect(res.pageIndices).toEqual([0, 1, 2, 4, 7, 8, 9]);
    expect(res.selectedPagesCount).toBe(7);
  });

  it('normalizes reverse ranges like 5-3 to 3-5', () => {
    const res = parseWatermarkPages('custom', '5-3', 'all', 10);
    expect(res.isValid).toBe(true);
    expect(res.pageIndices).toEqual([2, 3, 4]);
  });

  it('handles overlapping ranges and deduplicates page numbers', () => {
    const res = parseWatermarkPages('custom', '1-4, 2-3, 4', 'all', 10);
    expect(res.isValid).toBe(true);
    expect(res.pageIndices).toEqual([0, 1, 2, 3]);
  });

  it('clamps pages exceeding total pages and reports clamping', () => {
    const res = parseWatermarkPages('custom', '1-3, 10, 15', 'all', 5);
    expect(res.isValid).toBe(true);
    expect(res.pageIndices).toEqual([0, 1, 2]);
    expect(res.clampedMessage).toContain('10, 15');
    expect(res.clampedMessage).toContain('exceed total (5)');
  });

  it('rejects invalid inputs cleanly with clear error message', () => {
    const resEmpty = parseWatermarkPages('custom', '', 'all', 5);
    expect(resEmpty.isValid).toBe(false);
    expect(resEmpty.errorMessage).toContain('Please enter page numbers');

    const resInvalid = parseWatermarkPages('custom', 'abc, 2-x', 'all', 5);
    expect(resInvalid.isValid).toBe(false);
    expect(resInvalid.errorMessage).toContain('Invalid page format');
  });

  it('handles zero total pages gracefully', () => {
    const res = parseWatermarkPages('all', '', 'all', 0);
    expect(res.isValid).toBe(false);
    expect(res.pageIndices).toEqual([]);
  });
});
