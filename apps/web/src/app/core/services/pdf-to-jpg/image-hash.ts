/**
 * Fast content hashing for deduplicating extracted images.
 */

/**
 * Computes a fast 32-bit FNV-1a hash over binary data with sample stepping for large streams.
 */
export function computeImageHash(
  data: Uint8Array,
  width: number,
  height: number
): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;

  // Mix width and height
  h1 ^= width;
  h1 = Math.imul(h1, 0x01000193);
  h2 ^= height;
  h2 = Math.imul(h2, 0x85ebca6b);

  const len = data.length;
  // Step through data (sample if huge > 256KB to maintain high throughput)
  const step = len > 262144 ? Math.floor(len / 65536) : 1;

  for (let i = 0; i < len; i += step) {
    const byte = data[i];
    h1 ^= byte;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= byte;
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const lenHex = len.toString(16).padStart(8, '0');

  return `${hex1}-${hex2}-${lenHex}`;
}

