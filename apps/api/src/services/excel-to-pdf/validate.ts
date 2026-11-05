import * as path from 'path';
import JSZip from 'jszip';
import { AppError } from '../../middleware/errorHandler';

export interface ValidatedExcelFile {
  buffer: Buffer;
  originalname: string;
  extension: '.xlsx' | '.xlsm' | '.xls' | '.ods' | '.csv' | '.tsv';
  isZipBased: boolean;
  sheetCountEstimate?: number;
  cellCountEstimate?: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls', '.ods', '.csv', '.tsv']);

const MAX_ZIP_ENTRIES = 5000;
const MAX_UNCOMPRESSED_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const MAX_COMPRESSION_RATIO = 100;
const MAX_CELL_LIMIT = 5000000; // 5,000,000 cells max
const MAX_SHEET_LIMIT = 100;

export async function validateSpreadsheetFile(
  buffer: Buffer,
  originalname: string
): Promise<ValidatedExcelFile> {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The file '${originalname}' is empty.`);
  }

  const ext = path.extname(originalname).toLowerCase() as any;
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `Unsupported file type '${ext}'. Please upload an Excel (.xlsx, .xlsm, .xls), OpenDocument (.ods), or CSV/TSV spreadsheet.`
    );
  }

  // 1. OLE2 check for legacy .xls
  if (ext === '.xls') {
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
        `The file '${originalname}' is not a valid legacy Excel 97-2003 (.xls) workbook.`
      );
    }

    // Check for OLE encryption
    const hex = buffer.subarray(0, Math.min(buffer.length, 65536)).toString('binary');
    if (hex.includes('EncryptedPackage') || hex.includes('EncryptionInfo')) {
      throw new AppError(
        422,
        'ENCRYPTED_DOCUMENT',
        `The file '${originalname}' is password-protected and cannot be converted.`
      );
    }

    return {
      buffer,
      originalname,
      extension: '.xls',
      isZipBased: false
    };
  }

  // 2. CSV / TSV validation (Text, reject binary files)
  if (ext === '.csv' || ext === '.tsv') {
    // Check for binary characters (NUL byte or excessive non-printable control chars)
    const sampleLen = Math.min(buffer.length, 8192);
    let controlCount = 0;
    for (let i = 0; i < sampleLen; i++) {
      const b = buffer[i];
      if (b === 0) {
        throw new AppError(
          415,
          'UNSUPPORTED_FILE',
          `The file '${originalname}' contains binary data and is not a valid text spreadsheet.`
        );
      }
      // Control characters other than TAB (9), LF (10), CR (13)
      if (b < 32 && b !== 9 && b !== 10 && b !== 13) {
        controlCount++;
      }
    }
    if (controlCount / sampleLen > 0.01) {
      throw new AppError(
        415,
        'UNSUPPORTED_FILE',
        `The file '${originalname}' is not a valid text-delimited spreadsheet.`
      );
    }

    return {
      buffer,
      originalname,
      extension: ext,
      isZipBased: false
    };
  }

  // 3. ZIP-based formats (.xlsx, .xlsm, .ods)
  // Check ZIP magic bytes (PK..)
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `The file '${originalname}' is not a valid spreadsheet document archive.`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `The archive of '${originalname}' is corrupted or damaged.`
    );
  }

  // ZIP BOMB & Path Traversal Guard
  const entries = Object.keys(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new AppError(
      413,
      'FILE_TOO_COMPLEX',
      `The document '${originalname}' contains too many internal components (${entries.length}).`
    );
  }

  let totalUncompressed = 0;
  for (const entryName of entries) {
    // Path traversal check
    if (
      entryName.includes('../') ||
      entryName.includes('..\\') ||
      path.isAbsolute(entryName)
    ) {
      throw new AppError(
        413,
        'FILE_TOO_COMPLEX',
        `The document '${originalname}' contains forbidden path traversal entries.`
      );
    }

    const zipObj = zip.files[entryName];
    if (zipObj && (zipObj as any)._data) {
      const uncomp = (zipObj as any)._data.uncompressedSize || 0;
      const comp = (zipObj as any)._data.compressedSize || 1;
      totalUncompressed += uncomp;

      if (comp > 0 && uncomp / comp > MAX_COMPRESSION_RATIO && uncomp > 1024 * 1024) {
        throw new AppError(
          413,
          'FILE_TOO_COMPLEX',
          `The document '${originalname}' contains an excessively compressed component (potential decompression bomb).`
        );
      }
    }
  }

  if (totalUncompressed > MAX_UNCOMPRESSED_SIZE_BYTES) {
    throw new AppError(
      413,
      'FILE_TOO_COMPLEX',
      `The uncompressed size of '${originalname}' exceeds the safety limit (300MB).`
    );
  }

  // Encryption Check:
  // OOXML EncryptionInfo / EncryptedPackage
  if (zip.file('EncryptionInfo') || zip.file('EncryptedPackage')) {
    throw new AppError(
      422,
      'ENCRYPTED_DOCUMENT',
      `The file '${originalname}' is encrypted and cannot be converted without a password.`
    );
  }

  // ODS Encryption check (META-INF/manifest.xml containing manifest:encryption-data)
  if (ext === '.ods') {
    const manifestFile = zip.file('META-INF/manifest.xml');
    if (manifestFile) {
      const manifestXml = await manifestFile.async('text');
      if (manifestXml.includes('manifest:encryption-data')) {
        throw new AppError(
          422,
          'ENCRYPTED_DOCUMENT',
          `The OpenDocument spreadsheet '${originalname}' is password-encrypted.`
        );
      }
    }

    // Verify ODS mimetype or content.xml
    const mimeFile = zip.file('mimetype');
    const contentXml = zip.file('content.xml');
    if (!contentXml && !mimeFile) {
      throw new AppError(
        415,
        'UNSUPPORTED_FILE',
        `The file '${originalname}' is not a valid OpenDocument spreadsheet.`
      );
    }

    return {
      buffer,
      originalname,
      extension: '.ods',
      isZipBased: true
    };
  }

  // XLSX / XLSM checks
  const contentTypes = zip.file('[Content_Types].xml');
  const workbookXml = zip.file('xl/workbook.xml');
  if (!contentTypes || !workbookXml) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `The file '${originalname}' does not appear to be a valid Microsoft Excel workbook.`
    );
  }

  // Count sheets and estimate cells
  const wbXmlText = await workbookXml.async('text');
  const sheetMatches = wbXmlText.match(/<sheet\b/g);
  const sheetCount = sheetMatches ? sheetMatches.length : 1;
  if (sheetCount > MAX_SHEET_LIMIT) {
    throw new AppError(
      413,
      'FILE_TOO_COMPLEX',
      `The workbook '${originalname}' contains ${sheetCount} sheets, exceeding the maximum limit of ${MAX_SHEET_LIMIT}.`
    );
  }

  // Estimate total cell count from worksheet dimension tags
  let totalEstimatedCells = 0;
  for (const entryName of entries) {
    if (entryName.startsWith('xl/worksheets/sheet') && entryName.endsWith('.xml')) {
      const sheetFile = zip.file(entryName);
      if (sheetFile) {
        const text = await sheetFile.async('text');
        // Match <dimension ref="A1:Z100"/>
        const dimMatch = text.match(/<dimension\s+ref="([A-Z0-9]+):([A-Z0-9]+)"/i);
        if (dimMatch) {
          const cells = calculateCellCount(dimMatch[1], dimMatch[2]);
          totalEstimatedCells += cells;
        } else {
          // Count <c tags
          const cMatches = text.match(/<c\b/g);
          totalEstimatedCells += cMatches ? cMatches.length : 0;
        }
      }
    }
  }

  if (totalEstimatedCells > MAX_CELL_LIMIT) {
    throw new AppError(
      413,
      'FILE_TOO_COMPLEX',
      `The workbook '${originalname}' contains approximately ${totalEstimatedCells.toLocaleString()} cells, exceeding the safety limit of ${MAX_CELL_LIMIT.toLocaleString()} cells.`
    );
  }

  return {
    buffer,
    originalname,
    extension: ext,
    isZipBased: true,
    sheetCountEstimate: sheetCount,
    cellCountEstimate: totalEstimatedCells
  };
}

function calculateCellCount(refStart: string, refEnd: string): number {
  const parseCell = (cellRef: string) => {
    const colMatch = cellRef.match(/[A-Z]+/i);
    const rowMatch = cellRef.match(/\d+/);
    if (!colMatch || !rowMatch) return { col: 1, row: 1 };

    let col = 0;
    const colStr = colMatch[0].toUpperCase();
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    const row = parseInt(rowMatch[0], 10);
    return { col, row };
  };

  const start = parseCell(refStart);
  const end = parseCell(refEnd);
  const cols = Math.max(1, Math.abs(end.col - start.col) + 1);
  const rows = Math.max(1, Math.abs(end.row - start.row) + 1);

  // If huge formatted empty ranges like row 1048576, don't trigger bomb error just from dimension tag
  // unless both rows and cols are huge
  if (rows > 1000000 && cols <= 10) {
    return 10000;
  }
  return cols * rows;
}
