import { zipSync, AsyncZipDeflate, Zip } from 'fflate';

export interface ZipEntryInput {
  name: string;
  blob: Blob;
}

/**
 * Creates a ZIP archive from a collection of files using fflate.
 * Streams each entry through compression chunks to keep memory bounded.
 */
export async function createStreamingZip(files: ZipEntryInput[]): Promise<Blob> {
  if (files.length === 0) {
    return new Blob([], { type: 'application/zip' });
  }

  const chunks: Uint8Array[] = [];

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      throw err;
    }
    if (chunk) {
      chunks.push(chunk);
    }
  });

  for (const file of files) {
    const arrayBuffer = await file.blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    await new Promise<void>((resolve, reject) => {
      const entry = new AsyncZipDeflate(file.name, { level: 6 });
      zip.add(entry);

      entry.push(data, true);
      resolve();
    });
  }

  zip.end();

  return new Blob(chunks as any[], { type: 'application/zip' });
}
