import { describe, it, expect } from 'vitest';
import { createStreamingZip, ZipEntryInput } from './streaming-zip';
import { unzipSync } from 'fflate';

describe('streaming-zip', () => {
  it('returns an empty blob when given an empty files array', async () => {
    const result = await createStreamingZip([]);
    expect(result.size).toBe(0);
    expect(result.type).toBe('application/zip');
  });

  it('generates a valid, non-empty ZIP archive containing all files', async () => {
    const file1: ZipEntryInput = {
      name: 'page-01.jpg',
      blob: new Blob(['fake jpeg binary data 1'], { type: 'image/jpeg' })
    };
    const file2: ZipEntryInput = {
      name: 'page-02.jpg',
      blob: new Blob(['fake jpeg binary data 2'], { type: 'image/jpeg' })
    };

    const zipBlob = await createStreamingZip([file1, file2]);

    expect(zipBlob.size).toBeGreaterThan(0);
    expect(zipBlob.type).toBe('application/zip');

    // Verify ZIP structure by unzipping with fflate
    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
    const unzipped = unzipSync(zipBytes);

    const keys = Object.keys(unzipped);
    expect(keys).toContain('page-01.jpg');
    expect(keys).toContain('page-02.jpg');

    const content1 = new TextDecoder().decode(unzipped['page-01.jpg']);
    const content2 = new TextDecoder().decode(unzipped['page-02.jpg']);
    expect(content1).toBe('fake jpeg binary data 1');
    expect(content2).toBe('fake jpeg binary data 2');
  });
});
