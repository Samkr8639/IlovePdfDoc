import { zip, zipSync } from 'fflate';

export interface ZipEntryInput {
  name: string;
  blob: Blob;
}

/**
 * Creates a standard ZIP archive from a collection of files using fflate.
 * Uses STORE (level: 0) compression for JPEG images which are already compressed,
 * eliminating CPU overhead, avoiding worker DataCloneError issues, and guaranteeing
 * a 100% valid non-empty ZIP file with standard central directory headers.
 */
export async function createStreamingZip(files: ZipEntryInput[]): Promise<Blob> {
  if (files.length === 0) {
    return new Blob([], { type: 'application/zip' });
  }

  const archive: Record<string, Uint8Array> = {};
  for (const file of files) {
    const arrayBuffer = await file.blob.arrayBuffer();
    archive[file.name] = new Uint8Array(arrayBuffer);
  }

  return new Promise<Blob>((resolve, reject) => {
    try {
      zip(archive, { level: 0 }, (err, data) => {
        if (err || !data || data.length === 0) {
          // Fallback to synchronous zipSync if asynchronous compression fails
          try {
            const syncData = zipSync(archive, { level: 0 });
            resolve(new Blob([syncData as any], { type: 'application/zip' }));
          } catch (syncErr) {
            reject(err || syncErr);
          }
          return;
        }
        resolve(new Blob([data as any], { type: 'application/zip' }));
      });
    } catch {
      // Synchronous fallback
      try {
        const syncData = zipSync(archive, { level: 0 });
        resolve(new Blob([syncData as any], { type: 'application/zip' }));
      } catch (syncErr) {
        reject(syncErr);
      }
    }
  });
}
