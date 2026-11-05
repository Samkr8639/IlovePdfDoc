import JSZip from 'jszip';

export interface SheetInfo {
  name: string;
  hidden: boolean;
}

/**
 * Inspects a spreadsheet file client-side in the browser using JSZip and DOMParser
 * WITHOUT uploading the file to the server.
 */
export async function getSpreadsheetSheetNames(file: File): Promise<SheetInfo[]> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  // For CSV, TSV, or legacy binary XLS, return generic single sheet representation
  if (['.csv', '.tsv', '.xls'].includes(ext)) {
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    return [{ name: baseName || 'Sheet1', hidden: false }];
  }

  // OOXML: .xlsx, .xlsm
  if (['.xlsx', '.xlsm'].includes(ext)) {
    try {
      const zip = await JSZip.loadAsync(file);
      const workbookXml = await zip.file('xl/workbook.xml')?.async('text');
      if (!workbookXml) {
        return [{ name: 'Sheet1', hidden: false }];
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(workbookXml, 'application/xml');
      const sheetEls = Array.from(doc.getElementsByTagName('sheet'));

      if (sheetEls.length === 0) {
        // Try namespaced search
        const nsSheets = Array.from(doc.getElementsByTagNameNS('*', 'sheet'));
        if (nsSheets.length > 0) {
          return nsSheets.map(el => {
            const name = el.getAttribute('name') || 'Sheet';
            const state = el.getAttribute('state') || '';
            const hidden = state === 'hidden' || state === 'veryHidden';
            return { name, hidden };
          });
        }
      }

      return sheetEls.map(el => {
        const name = el.getAttribute('name') || 'Sheet';
        const state = el.getAttribute('state') || '';
        const hidden = state === 'hidden' || state === 'veryHidden';
        return { name, hidden };
      });
    } catch (err) {
      console.warn('Failed to inspect XLSX workbook sheets in browser:', err);
      return [{ name: 'Sheet1', hidden: false }];
    }
  }

  // ODF: .ods
  if (ext === '.ods') {
    try {
      const zip = await JSZip.loadAsync(file);
      const contentXml = await zip.file('content.xml')?.async('text');
      if (!contentXml) {
        return [{ name: 'Sheet1', hidden: false }];
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(contentXml, 'application/xml');
      const tables = Array.from(doc.getElementsByTagNameNS('*', 'table'));

      const sheets: SheetInfo[] = [];
      for (const table of tables) {
        const name = table.getAttribute('table:name') || table.getAttribute('name');
        if (name) {
          const visibility = table.getAttribute('table:visibility') || '';
          sheets.push({
            name,
            hidden: visibility === 'hidden'
          });
        }
      }

      return sheets.length > 0 ? sheets : [{ name: 'Sheet1', hidden: false }];
    } catch (err) {
      console.warn('Failed to inspect ODS content sheets in browser:', err);
      return [{ name: 'Sheet1', hidden: false }];
    }
  }

  return [{ name: 'Sheet1', hidden: false }];
}
