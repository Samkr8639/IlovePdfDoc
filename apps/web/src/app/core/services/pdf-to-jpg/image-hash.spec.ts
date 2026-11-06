import { describe, it, expect } from 'vitest';
import { computeImageHash } from './image-hash';

describe('image-hash', () => {
  it('generates deterministic hash for identical binary buffers', () => {
    const buf1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const buf2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(computeImageHash(buf1, 100, 100)).toBe(computeImageHash(buf2, 100, 100));
  });

  it('generates different hash for different dimensions or contents', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const hashA = computeImageHash(buf, 100, 100);
    const hashB = computeImageHash(buf, 200, 100);
    expect(hashA).not.toBe(hashB);
  });
});
