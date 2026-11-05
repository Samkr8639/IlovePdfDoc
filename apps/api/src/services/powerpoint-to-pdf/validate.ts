import * as path from 'path';
import JSZip from 'jszip';
import { AppError } from '../../middleware/errorHandler';

export interface ValidatedPowerPointFile {
  buffer: Buffer;
  originalname: string;
  extension: '.pptx' | '.ppt' | '.ppsx' | '.pps' | '.pptm' | '.odp';
  isZipBased: boolean;
  slideCountEstimate?: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.pptx', '.ppt', '.ppsx', '.pps', '.pptm', '.odp']);

const MAX_ZIP_ENTRIES = 10000;
const MAX_UNCOMPRESSED_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_COMPRESSION_RATIO = 100;
const MAX_SLIDES_DEFAULT = 300;

export function getMaxSlidesLimit(): number {
  const envVal = process.env['PPT_MAX_SLIDES'];
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return MAX_SLIDES_DEFAULT;
}

export async function validatePowerPointFile(
  buffer: Buffer,
  originalname: string
): Promise<ValidatedPowerPointFile> {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The file '${originalname}' is empty.`);
  }

  const ext = path.extname(originalname).toLowerCase() as any;
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `Unsupported file type '${ext}'. Please upload a PowerPoint (.pptx, .ppt, .ppsx, .pps, .pptm) or OpenDocument Presentation (.odp) file.`
    );
  }

  // 1. OLE2 check for legacy .ppt / .pps
  if (ext === '.ppt' || ext === '.pps') {
    if (
      buffer.length < 8 ||
      buffer[0] !== 0xd0 ||
      buffer[1] !== 0xcf ||
      buffer[2] !== 0x11 ||
      buffer[3] !== 0xe0 ||
      buffer[4] !== 0xa1 ||
      buffer[5] !== 0xb1 ||
      buffer[6] !== 0x1a ||
      buffer[7] !== 0xe1
    ) {
      throw new AppError(
        415,
        'UNSUPPORTED_FILE',
        `The file '${originalname}' is not a valid legacy PowerPoint 97-2003 presentation.`
      );
    }

    // Check for OLE encryption
    const headerString = buffer.subarray(0, Math.min(buffer.length, 65536)).toString('binary');
    if (headerString.includes('EncryptedPackage') || headerString.includes('EncryptionInfo')) {
      throw new AppError(
        422,
        'ENCRYPTED_DOCUMENT',
        `The file '${originalname}' is password-protected and cannot be converted.`
      );
    }

    return {
      buffer,
      originalname,
      extension: ext,
      isZipBased: false
    };
  }

  // 2. ZIP-based formats (.pptx, .pptm, .ppsx, .odp)
  // Check ZIP magic bytes (PK..)
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `The file '${originalname}' is not a valid presentation document archive.`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `The presentation archive '${originalname}' is corrupted or damaged.`
    );
  }

  // 3. Zip bomb & path traversal guards
  const entries = Object.keys(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new AppError(
      413,
      'FILE_TOO_COMPLEX',
      `The archive '${originalname}' contains too many entries (${entries.length} > ${MAX_ZIP_ENTRIES}).`
    );
  }

  let totalUncompressedSize = 0;
  for (const entryName of entries) {
    // Path traversal check
    if (
      entryName.includes('../') ||
      entryName.includes('..\\') ||
      path.isAbsolute(entryName) ||
      entryName.startsWith('/') ||
      entryName.startsWith('\\')
    ) {
      throw new AppError(
        413,
        'FILE_TOO_COMPLEX',
        `Malicious path traversal entry detected in '${originalname}': '${entryName}'`
      );
    }

    const zipObj = zip.files[entryName];
    if (zipObj && !zipObj.dir) {
      const uncomp = (zipObj as any)._data?.uncompressedSize || 0;
      totalUncompressedSize += uncomp;

      const comp = (zipObj as any)._data?.compressedSize || 1;
      if (comp > 0 && uncomp / comp > MAX_COMPRESSION_RATIO && uncomp > 10 * 1024 * 1024) {
        throw new AppError(
          413,
          'FILE_TOO_COMPLEX',
          `Suspicious compression ratio detected in '${originalname}'.`
        );
      }
    }
  }

  if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE_BYTES) {
    throw new AppError(
      413,
      'FILE_TOO_COMPLEX',
      `The uncompressed size of '${originalname}' exceeds the safety limit of 500 MB.`
    );
  }

  // 4. Check for Encrypted Documents
  if (zip.file('EncryptedPackage') || zip.file('EncryptionInfo')) {
    throw new AppError(
      422,
      'ENCRYPTED_DOCUMENT',
      `The presentation '${originalname}' is password-encrypted and cannot be converted.`
    );
  }

  // Check OpenDocument (.odp)
  if (ext === '.odp') {
    const mimeFile = zip.file('mimetype');
    if (mimeFile) {
      const mime = (await mimeFile.async('text')).trim();
      if (!mime.startsWith('application/vnd.oasis.opendocument.presentation')) {
        throw new AppError(
          415,
          'UNSUPPORTED_FILE',
          `The file '${originalname}' has an invalid OpenDocument presentation MIME type: ${mime}`
        );
      }
    } else {
      throw new AppError(
        415,
        'UNSUPPORTED_FILE',
        `The OpenDocument file '${originalname}' is missing its mimetype header.`
      );
    }

    // Check ODF encryption manifest
    const manifestFile = zip.file('META-INF/manifest.xml');
    if (manifestFile) {
      const manifestXml = await manifestFile.async('text');
      if (manifestXml.includes('manifest:encryption-data')) {
        throw new AppError(
          422,
          'ENCRYPTED_DOCUMENT',
          `The OpenDocument file '${originalname}' is password-encrypted and cannot be converted.`
        );
      }
    }

    return {
      buffer,
      originalname,
      extension: '.odp',
      isZipBased: true
    };
  }

  // 5. OOXML formats (.pptx, .pptm, .ppsx)
  const contentTypesFile = zip.file('[Content_Types].xml');
  const presentationFile = zip.file('ppt/presentation.xml');

  if (!contentTypesFile || !presentationFile) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `The file '${originalname}' is missing required PowerPoint OOXML structure ([Content_Types].xml or ppt/presentation.xml).`
    );
  }

  // Validate Content_Types XML
  const contentTypesXml = await contentTypesFile.async('text');
  if (
    !contentTypesXml.includes('presentationml') &&
    !contentTypesXml.includes('presentation.main')
  ) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `The file '${originalname}' does not appear to be a valid PowerPoint presentation package.`
    );
  }

  // 6. Slide count estimate & limit enforcement
  const presentationXml = await presentationFile.async('text');
  const sldIdMatches = presentationXml.match(/<p:sldId\b/gi);
  const slideCount = sldIdMatches ? sldIdMatches.length : 0;

  const maxSlides = getMaxSlidesLimit();
  if (slideCount > maxSlides) {
    throw new AppError(
      413,
      'FILE_TOO_COMPLEX',
      `The presentation '${originalname}' contains ${slideCount} slides, which exceeds the limit of ${maxSlides} slides.`
    );
  }

  return {
    buffer,
    originalname,
    extension: ext,
    isZipBased: true,
    slideCountEstimate: slideCount
  };
}

