import JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { ExcelToPdfOptions } from '@paperflow/contracts';

export interface NormalizeXlsxResult {
  buffer: Buffer;
  sheetNames: string[];
  selectedSheetNames: string[];
  warnings: string[];
  hasFormulasWithoutCachedValues: boolean;
}

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: false, // Prevents entity expansion / billion laughs
  allowBooleanAttributes: true
};

const XML_BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: false,
  suppressBooleanAttributes: false
};

export async function normalizeXlsx(
  buffer: Buffer,
  options: ExcelToPdfOptions = {}
): Promise<NormalizeXlsxResult> {
  const zip = await JSZip.loadAsync(buffer);
  const warnings: string[] = [];
  let hasFormulasWithoutCachedValues = false;

  // ────────────────────────────────────────────────────────────
  // 1. Security Stripping (defense in depth)
  // ────────────────────────────────────────────────────────────

  // 1.1 Remove VBA project files
  const vbaFiles = ['xl/vbaProject.bin', 'xl/vbaProjectSignature.bin'];
  for (const vba of vbaFiles) {
    if (zip.file(vba)) {
      zip.remove(vba);
      warnings.push(`Embedded VBA macros ('${vba}') were removed for security.`);
    }
  }

  // 1.2 Remove Excel 4.0 Macrosheets and Dialogsheets
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith('xl/macrosheets/') || name.startsWith('xl/dialogsheets/')) {
      zip.remove(name);
      warnings.push(`Legacy macro/dialog sheet ('${name}') was removed for security.`);
    }
    // Remove external data connections and query tables
    if (
      name.startsWith('xl/externalLinks/') ||
      name === 'xl/connections.xml' ||
      name.startsWith('xl/queryTables/') ||
      name.startsWith('xl/pivotCache/') ||
      name.startsWith('xl/embeddings/') ||
      name.startsWith('xl/webextensions/')
    ) {
      zip.remove(name);
      warnings.push(`External connection/embedded resource ('${name}') was removed for security.`);
    }
  }

  // 1.3 Sanitize Relationships (TargetMode="External")
  for (const name of Object.keys(zip.files)) {
    if (name.endsWith('.rels')) {
      const relsFile = zip.file(name);
      if (relsFile) {
        let relsXml = await relsFile.async('text');
        if (relsXml.includes('TargetMode="External"')) {
          const parser = new XMLParser(XML_PARSER_OPTIONS);
          const builder = new XMLBuilder(XML_BUILDER_OPTIONS);
          try {
            const parsed = parser.parse(relsXml);
            if (parsed.Relationships && parsed.Relationships.Relationship) {
              const relList = Array.isArray(parsed.Relationships.Relationship)
                ? parsed.Relationships.Relationship
                : [parsed.Relationships.Relationship];

              const filteredRelList = relList.filter((rel: any) => {
                if (rel['@_TargetMode'] === 'External') {
                  const target = String(rel['@_Target'] || '').toLowerCase();
                  // Allow only http, https, mailto
                  if (
                    target.startsWith('http://') ||
                    target.startsWith('https://') ||
                    target.startsWith('mailto:')
                  ) {
                    return true;
                  }
                  warnings.push(`Neutralized unsafe external hyperlink target: ${target}`);
                  return false;
                }
                return true;
              });

              parsed.Relationships.Relationship = filteredRelList;
              zip.file(name, builder.build(parsed));
            }
          } catch {
            // Keep going if relationship XML parse fails
          }
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 2. Parse xl/workbook.xml & Sheet Selection
  // ────────────────────────────────────────────────────────────

  const wbFile = zip.file('xl/workbook.xml');
  if (!wbFile) {
    return {
      buffer,
      sheetNames: [],
      selectedSheetNames: [],
      warnings,
      hasFormulasWithoutCachedValues
    };
  }

  const parser = new XMLParser(XML_PARSER_OPTIONS);
  const builder = new XMLBuilder(XML_BUILDER_OPTIONS);

  const wbXml = await wbFile.async('text');
  const wbObj = parser.parse(wbXml);

  // Remove externalReferences in workbook.xml
  if (wbObj.workbook && wbObj.workbook.externalReferences) {
    delete wbObj.workbook.externalReferences;
    warnings.push('External references in workbook were removed for security.');
  }

  // Read sheets list
  const sheetsNode = wbObj.workbook?.sheets?.sheet;
  const sheetList = Array.isArray(sheetsNode) ? sheetsNode : sheetsNode ? [sheetsNode] : [];

  const allSheetNames: string[] = [];
  const selectedSheetNames: string[] = [];
  const sheetRelMap: Map<string, { name: string; rId: string; state?: string }> = new Map();

  for (const s of sheetList) {
    const sName = String(s['@_name'] || '');
    const rId = String(s['@_r:id'] || s['@_id'] || '');
    const state = s['@_state'] || 'visible';
    allSheetNames.push(sName);
    sheetRelMap.set(rId, { name: sName, rId, state });
  }

  // Determine which sheets to include based on options
  const sheetOpt = options.sheets || { mode: 'all', includeHidden: false };
  let firstVisibleSelected = false;

  for (let idx = 0; idx < sheetList.length; idx++) {
    const s = sheetList[idx];
    const sName = String(s['@_name'] || '');
    const originalState = s['@_state'] || 'visible';

    let shouldInclude = true;

    if (sheetOpt.mode === 'first') {
      if (!firstVisibleSelected && (originalState === 'visible' || sheetOpt.includeHidden)) {
        shouldInclude = true;
        firstVisibleSelected = true;
      } else {
        shouldInclude = false;
      }
    } else if (sheetOpt.mode === 'selected' && sheetOpt.names && sheetOpt.names.length > 0) {
      shouldInclude = sheetOpt.names.includes(sName);
    } else {
      // mode === 'all'
      shouldInclude = true;
    }

    if (!sheetOpt.includeHidden && originalState === 'hidden') {
      shouldInclude = false;
    }

    if (shouldInclude) {
      delete s['@_state']; // Make visible
      selectedSheetNames.push(sName);
    } else {
      s['@_state'] = 'hidden';
    }
  }

  // If no sheets remained visible (e.g. invalid selected names), make the first sheet visible
  if (selectedSheetNames.length === 0 && sheetList.length > 0) {
    delete sheetList[0]['@_state'];
    selectedSheetNames.push(String(sheetList[0]['@_name'] || 'Sheet1'));
  }

  // Set activeTab in workbookView to first visible sheet
  const firstVisibleIdx = sheetList.findIndex((s: any) => !s['@_state'] || s['@_state'] === 'visible');
  if (firstVisibleIdx !== -1) {
    if (!wbObj.workbook.bookViews) {
      wbObj.workbook.bookViews = { workbookView: { '@_activeTab': firstVisibleIdx } };
    } else if (wbObj.workbook.bookViews.workbookView) {
      const bv = Array.isArray(wbObj.workbook.bookViews.workbookView)
        ? wbObj.workbook.bookViews.workbookView[0]
        : wbObj.workbook.bookViews.workbookView;
      bv['@_activeTab'] = firstVisibleIdx;
    }
  }

  // ────────────────────────────────────────────────────────────
  // 3. Process Worksheets (Used Range, Page Setup, Security)
  // ────────────────────────────────────────────────────────────

  // Get sheet targets from xl/_rels/workbook.xml.rels
  const wbRelsFile = zip.file('xl/_rels/workbook.xml.rels');
  const targetMap: Map<string, string> = new Map(); // rId -> path
  if (wbRelsFile) {
    const wbRelsXml = await wbRelsFile.async('text');
    const relsParsed = parser.parse(wbRelsXml);
    const rList = Array.isArray(relsParsed?.Relationships?.Relationship)
      ? relsParsed.Relationships.Relationship
      : [relsParsed?.Relationships?.Relationship].filter(Boolean);

    for (const r of rList) {
      const rId = r['@_Id'];
      const target = r['@_Target'];
      if (rId && target) {
        const fullPath = target.startsWith('/') ? target.substring(1) : `xl/${target}`;
        targetMap.set(rId, fullPath);
      }
    }
  }

  // Prepare definedNames list in workbook.xml for Print_Area and Print_Titles
  if (!wbObj.workbook.definedNames) {
    wbObj.workbook.definedNames = { definedName: [] };
  } else if (!Array.isArray(wbObj.workbook.definedNames.definedName)) {
    wbObj.workbook.definedNames.definedName = [wbObj.workbook.definedNames.definedName];
  }
  const definedNamesList: any[] = wbObj.workbook.definedNames.definedName;

  for (let sIdx = 0; sIdx < sheetList.length; sIdx++) {
    const s = sheetList[sIdx];
    const rId = String(s['@_r:id'] || s['@_id'] || '');
    const sheetName = String(s['@_name'] || `Sheet${sIdx + 1}`);
    const sheetPath = targetMap.get(rId) || `xl/worksheets/sheet${sIdx + 1}.xml`;

    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) continue;

    const sheetXml = await sheetFile.async('text');
    const sheetObj = parser.parse(sheetXml);
    if (!sheetObj.worksheet) continue;

    const ws = sheetObj.worksheet;

    // 3.1 DDE & Dangerous Formula Sanitization
    let minRow = 0;
    let maxRow = 0;
    let minCol = 0;
    let maxCol = 0;
    let hasContent = false;
    let headerRowCandidate: number | null = null;
    const textRowsCount: Map<number, number> = new Map();

    if (ws.sheetData && ws.sheetData.row) {
      const rowList = Array.isArray(ws.sheetData.row) ? ws.sheetData.row : [ws.sheetData.row];

      for (const row of rowList) {
        const rNum = parseInt(row['@_r'] || '0', 10);
        if (!row.c) continue;
        const cellList = Array.isArray(row.c) ? row.c : [row.c];

        let textCellsInRow = 0;

        for (const cell of cellList) {
          const cellRef = cell['@_r'] || '';
          const colNum = colRefToNum(cellRef);

          // Check if cell has actual content (value, formula, inline string)
          const hasVal = cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '';
          const hasF = cell.f !== undefined && cell.f !== null;
          const hasIs = cell.is !== undefined;

          if (hasVal || hasF || hasIs) {
            hasContent = true;
            if (minRow === 0 || rNum < minRow) minRow = rNum;
            if (rNum > maxRow) maxRow = rNum;
            if (minCol === 0 || colNum < minCol) minCol = colNum;
            if (colNum > maxCol) maxCol = colNum;
          }

          if (cell['@_t'] === 's' || hasIs || (hasVal && typeof cell.v === 'string' && isNaN(Number(cell.v)))) {
            textCellsInRow++;
          }

          // Check for formula evaluation / security
          if (hasF) {
            const fStr = typeof cell.f === 'string' ? cell.f : (cell.f['#text'] || '');
            const fUpper = fStr.toUpperCase();

            // Detect DDE, WEBSERVICE, FILTERXML with URL, cmd
            if (
              fStr.startsWith("'[") ||
              fStr.includes('|') ||
              fUpper.includes('CMD|') ||
              fUpper.includes('WEBSERVICE(') ||
              (fUpper.includes('FILTERXML(') && fUpper.includes('HTTP')) ||
              fUpper.includes('RTD(')
            ) {
              // Neutralize formula: keep cached value only
              delete cell.f;
              warnings.push(`Neutralized potentially unsafe external formula in ${sheetName}!${cellRef}`);
            }

            // Check if formula has no cached result <v>
            if (!hasVal) {
              hasFormulasWithoutCachedValues = true;
            }
          }
        }

        if (textCellsInRow >= 2 && !headerRowCandidate && rNum > 0) {
          headerRowCandidate = rNum;
        }
      }
    }

    // 3.2 Used-range Print Area Trimming (when trimEmpty is true)
    if (options.trimEmpty !== false && hasContent && maxRow > 0 && maxCol > 0) {
      // Check if file already defines a print area for this sheet
      const hasExistingPrintArea = definedNamesList.some(
        (dn: any) => dn['@_name'] === '_xlnm.Print_Area' && dn['@_localSheetId'] === String(sIdx)
      );

      if (!hasExistingPrintArea) {
        const areaRef = `${sheetName}!$${numToColRef(minCol)}$${minRow}:$${numToColRef(maxCol)}$${maxRow}`;
        definedNamesList.push({
          '@_name': '_xlnm.Print_Area',
          '@_localSheetId': String(sIdx),
          '#text': areaRef
        });
      }
    }

    // 3.3 Repeat Header Row (Print Titles)
    if (options.repeatHeader && headerRowCandidate && (maxRow - minRow >= 2)) {
      const hasExistingPrintTitles = definedNamesList.some(
        (dn: any) => dn['@_name'] === '_xlnm.Print_Titles' && dn['@_localSheetId'] === String(sIdx)
      );
      if (!hasExistingPrintTitles) {
        const titleRef = `${sheetName}!$${headerRowCandidate}:$${headerRowCandidate}`;
        definedNamesList.push({
          '@_name': '_xlnm.Print_Titles',
          '@_localSheetId': String(sIdx),
          '#text': titleRef
        });
      }
    }

    // 3.4 Page Setup: Paper Size & Orientation
    if (!ws.pageSetup) {
      ws.pageSetup = {};
    }

    // Paper Size mapping
    if (options.pageSize && options.pageSize !== 'as_file') {
      const paperMap: Record<string, string> = {
        letter: '1',
        legal: '5',
        a3: '8',
        a4: '9'
      };
      if (paperMap[options.pageSize]) {
        ws.pageSetup['@_paperSize'] = paperMap[options.pageSize];
      }
    }

    // Orientation
    if (options.orientation && options.orientation !== 'as_file') {
      if (options.orientation === 'auto') {
        // Compare content width in cols vs height in rows
        const colsCount = maxCol - minCol + 1;
        const rowsCount = maxRow - minRow + 1;
        ws.pageSetup['@_orientation'] = colsCount > rowsCount || colsCount >= 8 ? 'landscape' : 'portrait';
      } else {
        ws.pageSetup['@_orientation'] = options.orientation;
      }
    }

    // Margins
    if (options.margins && options.margins !== 'as_file') {
      if (!ws.pageMargins) ws.pageMargins = {};
      if (options.margins === 'narrow') {
        ws.pageMargins['@_left'] = '0.25';
        ws.pageMargins['@_right'] = '0.25';
        ws.pageMargins['@_top'] = '0.75';
        ws.pageMargins['@_bottom'] = '0.75';
        ws.pageMargins['@_header'] = '0.3';
        ws.pageMargins['@_footer'] = '0.3';
      } else if (options.margins === 'wide') {
        ws.pageMargins['@_left'] = '1.0';
        ws.pageMargins['@_right'] = '1.0';
        ws.pageMargins['@_top'] = '1.0';
        ws.pageMargins['@_bottom'] = '1.0';
        ws.pageMargins['@_header'] = '0.5';
        ws.pageMargins['@_footer'] = '0.5';
      } else if (options.margins === 'normal') {
        ws.pageMargins['@_left'] = '0.7';
        ws.pageMargins['@_right'] = '0.7';
        ws.pageMargins['@_top'] = '0.75';
        ws.pageMargins['@_bottom'] = '0.75';
        ws.pageMargins['@_header'] = '0.3';
        ws.pageMargins['@_footer'] = '0.3';
      }
    }

    // Scaling
    if (options.scaling && options.scaling !== 'as_file') {
      if (!ws.sheetPr) ws.sheetPr = {};
      if (!ws.sheetPr.pageSetUpPr) ws.sheetPr.pageSetUpPr = {};

      if (options.scaling === 'fit_width') {
        ws.sheetPr.pageSetUpPr['@_fitToPage'] = '1';
        ws.pageSetup['@_fitToWidth'] = '1';
        ws.pageSetup['@_fitToHeight'] = '0';
        delete ws.pageSetup['@_scale'];
      } else if (options.scaling === 'fit_page') {
        ws.sheetPr.pageSetUpPr['@_fitToPage'] = '1';
        ws.pageSetup['@_fitToWidth'] = '1';
        ws.pageSetup['@_fitToHeight'] = '1';
        delete ws.pageSetup['@_scale'];
      } else if (options.scaling === 'custom' && options.customScale) {
        ws.sheetPr.pageSetUpPr['@_fitToPage'] = '0';
        ws.pageSetup['@_scale'] = String(options.customScale);
        delete ws.pageSetup['@_fitToWidth'];
        delete ws.pageSetup['@_fitToHeight'];
      }
    }

    // Checkboxes: Gridlines and Headings
    if (options.gridlines || options.headings) {
      if (!ws.printOptions) ws.printOptions = {};
      if (options.gridlines) ws.printOptions['@_gridLines'] = '1';
      if (options.headings) ws.printOptions['@_headings'] = '1';
    }

    // Page numbers in header/footer
    if (options.pageNumbers) {
      if (!ws.headerFooter) ws.headerFooter = {};
      ws.headerFooter.oddFooter = '&P of &N';
    }

    zip.file(sheetPath, builder.build(sheetObj));
  }

  if (hasFormulasWithoutCachedValues) {
    warnings.push('Some formulas had no stored results and were calculated by the converter');
  }

  // Save updated xl/workbook.xml
  zip.file('xl/workbook.xml', builder.build(wbObj));

  const updatedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    buffer: updatedBuffer,
    sheetNames: allSheetNames,
    selectedSheetNames,
    warnings,
    hasFormulasWithoutCachedValues
  };
}

function colRefToNum(cellRef: string): number {
  const match = cellRef.match(/^[A-Z]+/i);
  if (!match) return 1;
  const str = match[0].toUpperCase();
  let col = 0;
  for (let i = 0; i < str.length; i++) {
    col = col * 26 + (str.charCodeAt(i) - 64);
  }
  return col;
}

function numToColRef(num: number): string {
  let col = '';
  let n = num;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col || 'A';
}
