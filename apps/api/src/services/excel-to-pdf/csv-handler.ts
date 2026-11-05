import ExcelJS from 'exceljs';

export interface CsvConversionResult {
  xlsxBuffer: Buffer;
  encoding: string;
  delimiter: string;
  rowCount: number;
  colCount: number;
  warnings: string[];
}

export function detectEncoding(buffer: Buffer): { encoding: BufferEncoding; label: string; text: string } {
  // Check BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return {
      encoding: 'utf8',
      label: 'UTF-8 with BOM',
      text: buffer.subarray(3).toString('utf8')
    };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return {
      encoding: 'utf16le',
      label: 'UTF-16LE',
      text: buffer.subarray(2).toString('utf16le')
    };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    // Node doesn't support utf16be natively in Buffer.toString, convert endianness
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i < buffer.length - 1; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return {
      encoding: 'utf16le',
      label: 'UTF-16BE',
      text: swapped.toString('utf16le')
    };
  }

  // Try decoding as UTF-8
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = decoder.decode(buffer);
    return {
      encoding: 'utf8',
      label: 'UTF-8',
      text
    };
  } catch {
    // Fallback to latin1 / Windows-1252
    return {
      encoding: 'latin1',
      label: 'Windows-1252 / ISO-8859-1',
      text: buffer.toString('latin1')
    };
  }
}

export function detectDelimiter(text: string, defaultDelimiter = ','): string {
  const sampleLines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 20);
  if (sampleLines.length === 0) return defaultDelimiter;

  const candidates = [',', ';', '\t', '|'];
  let bestDelimiter = defaultDelimiter;
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = sampleLines.map(line => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === delim && !inQuotes) count++;
      }
      return count;
    });

    const nonZero = counts.filter(c => c > 0);
    if (nonZero.length > 0) {
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      // Variance
      const variance = nonZero.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / nonZero.length;
      const score = (nonZero.length / sampleLines.length) * 10 - variance;
      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delim;
      }
    }
  }

  return bestDelimiter;
}

export function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

export async function convertCsvToXlsxBuffer(
  buffer: Buffer,
  filename: string
): Promise<CsvConversionResult> {
  const isTsv = filename.toLowerCase().endsWith('.tsv');
  const { label: encodingLabel, text } = detectEncoding(buffer);
  const delimiter = isTsv ? '\t' : detectDelimiter(text, ',');

  const rows = parseDelimitedText(text, delimiter);
  const rowCount = rows.length;
  let maxCols = 0;
  for (const r of rows) {
    if (r.length > maxCols) maxCols = r.length;
  }

  const warnings: string[] = [
    `Detected CSV encoding: ${encodingLabel}, delimiter: ${delimiter === '\t' ? 'TAB' : `'${delimiter}'`}`
  ];

  const wb = new ExcelJS.Workbook();
  const baseName = filename.replace(/\.[^/.]+$/, '').substring(0, 31) || 'Sheet1';
  const ws = wb.addWorksheet(baseName);

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const rowData = rows[rIdx];
    const row = ws.getRow(rIdx + 1);

    for (let cIdx = 0; cIdx < rowData.length; cIdx++) {
      const rawVal = rowData[cIdx];
      const cell = row.getCell(cIdx + 1);

      // CRITICAL SECURITY RULE: FORMULA EVALUATION DISABLED
      // If cell begins with '=', '+', '-', '@', treat STRICTLY as plain text!
      if (/^[=+\-@]/.test(rawVal)) {
        cell.value = rawVal;
        cell.numFmt = '@'; // Text format
      } else if (/^0\d+$/.test(rawVal)) {
        // Preserve leading zeros (e.g. 001234) as text
        cell.value = rawVal;
        cell.numFmt = '@';
      } else if (/^-?\d+(\.\d+)?$/.test(rawVal) && rawVal.length < 15) {
        // Pure numeric without leading zero
        const num = parseFloat(rawVal);
        cell.value = isNaN(num) ? rawVal : num;
      } else {
        cell.value = rawVal;
      }
    }
    row.commit();
  }

  // Page setup defaults for CSV:
  // Landscape when >= 8 columns, fit-all-columns-on-one-page, repeat header row
  ws.pageSetup = {
    orientation: maxCols >= 8 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9, // A4
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    },
    showGridLines: true
  };

  if (rows.length >= 2) {
    ws.pageSetup.printTitlesRow = '1:1';
  }

  const xlsxBuffer = Buffer.from(await wb.xlsx.writeBuffer());

  return {
    xlsxBuffer,
    encoding: encodingLabel,
    delimiter,
    rowCount,
    colCount: maxCols,
    warnings
  };
}
