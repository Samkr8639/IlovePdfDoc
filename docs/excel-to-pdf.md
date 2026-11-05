# Excel to PDF Architecture & Technical Specification

## Overview

The **Excel to PDF** engine provides high-fidelity, paginated, and secure conversion of spreadsheet documents into standard and archival PDF files. It supports Microsoft Excel (`.xlsx`, `.xlsm`, `.xls`), OpenDocument Spreadsheet (`.ods`), and delimited text files (`.csv`, `.tsv`).

Tables are formatted as they appear when printed from Excel: columns are not truncated, numbers and leading zeros are preserved, formulas use stored calculation values, and formatting styles carry over accurately.

---

## Architecture

The system consists of three distinct layers across the monorepo:

1. **Contracts (`packages/contracts`)**:
   - Strongly-typed request options, Zod validation schemas (`excelToPdfOptionsSchema`), and standardized response interfaces (`ExcelToPdfJobResponse`, `ConvertedExcelFileItem`).
2. **API Backend (`apps/api`)**:
   - General-purpose LibreOffice runner (`services/office-to-pdf`) shared between `calc` and `writer` profiles.
   - Multi-tier validation pipeline (`validate.ts`) with zip-bomb guards, encryption checks, and cell/sheet count guards.
   - In-memory spreadsheet normalizer (`normalize-xlsx.ts`) performing security sanitization, used-range trimming, page setup, and sheet filtering.
   - Robust CSV/TSV converter (`csv-handler.ts`) detecting encodings (UTF-8, UTF-16, Windows-1252), delimiters (comma, semicolon, tab), and neutralizing formula execution.
   - PDF post-processing (`services/excel-to-pdf/index.ts`) using `pdf-lib` for metadata stamping, blank page removal, and multi-file merging.
   - RESTful Express endpoints (`/api/v1/excel-to-pdf/convert`, `/jobs/:jobId/download`, `/jobs/:jobId`) backed by a bounded concurrency pool and ephemeral 10-minute job storage.
3. **Web Frontend (`apps/web`)**:
   - Angular standalone component (`app-excel-to-pdf`) built on the Ocean Workspace design palette.
   - Client-side in-browser sheet inspector (`sheet-names.ts`) using JSZip and `DOMParser` without uploading files.
   - Reactive UI driven by Angular signals and computed view-models.
   - Responsive multi-device layout (tested at 1440px desktop, 1024px tablet, and 390px mobile).

---

## Security Hardening & Zero-Trust Sandbox

### 1. Stripping Malicious Payloads (Defense in Depth)
Before LibreOffice Calc ever opens an uploaded workbook, `normalizeXlsx` inspects and strips dangerous components in-memory:
- **VBA & Macros**: Removes `xl/vbaProject.bin`, `xl/vbaProjectSignature.bin`, and Excel 4 macro sheets (`xl/macrosheets/*`, `xl/dialogsheets/*`).
- **External Data Connections**: Removes `xl/externalLinks/*`, `xl/connections.xml`, `xl/queryTables/*`, and external pivot cache definitions.
- **OLE Objects**: Removes `xl/embeddings/*` and external taskpane/webextension parts.
- **Formula Injection & DDE**: Neutralizes dangerous formulas starting with DDE commands (`cmd|`, `'[..]`, `|`), `WEBSERVICE(`, `FILTERXML(`, and `RTD(`. The formula is replaced by its stored cached calculation value, ensuring that no remote code or process execution can occur.
- **External Relationships**: Rewrites relationships with `TargetMode="External"` to avoid external entity resolution or remote resource fetching.

### 2. CSV / TSV Injection Protection
When converting delimited text files:
- All cell contents starting with `=`, `+`, `-`, or `@` are explicitly styled and treated as raw text strings (`numFmt = '@'`).
- Leading zeros (e.g., `001234`) are preserved as text.
- No formula expression is evaluated by the server.

### 3. Isolated LibreOffice Calc Profile
LibreOffice runs with:
- An ephemeral random profile directory (`etp-<uuid>-profile`) destroyed upon job completion.
- `registrymodifications.xcu` configured with:
  - `RecalculateOnLoad: 0`: Forces Calc to never recalculate formulas on load; cached Excel values are rendered as displayed.
  - `UpdateLinks: 0`: External links are never updated.
  - `MacroSecurityLevel: 3`: Highest macro security level (macros completely disabled).
  - `EnableJava: false`: Java runtime execution disabled.
- Execution via `execFile` with an argument array (never passing through a shell command line).
- Environment isolation: `http_proxy=http://127.0.0.1:0`, blocking all outbound socket connections.
- Concurrency pool: max 2 simultaneous conversions, bounded queue of 20 with `503 SERVER_BUSY` + `Retry-After: 5` header.

### 4. Ephemeral Job Retention & Auto-Deletion
- Converted PDF/ZIP files are held in an in-memory ephemeral store for a maximum of 10 minutes.
- When the client downloads the converted file via `/download`, the job is immediately purged from the store (`delete on download`).
- An active cleanup interval purges expired jobs every 60 seconds.

---

## Options & Conversion Parameters

| Option | Values | Engine Implementation | Description |
| :--- | :--- | :--- | :--- |
| `output` | `pdf` (default) \| `pdfa` | `SelectPdfVersion: 2` (PDF/A-2b) | Standard viewing PDF or ISO-compliant archival PDF/A-2b. |
| `sheets.mode` | `all` \| `first` \| `selected` | Workbook sheet `state="hidden"` | Converts all visible sheets, first sheet only, or specific selected sheets. |
| `pageSize` | `as_file` \| `a4` \| `letter` \| `legal` \| `a3` | `<pageSetup paperSize="X"/>` | Controls paper dimension (A4=9, Letter=1, Legal=5, A3=8). |
| `orientation` | `as_file` \| `auto` \| `portrait` \| `landscape` | `<pageSetup orientation="..."/>` | `auto` compares used column width against row height to pick landscape when wide. |
| `scaling` | `as_file` \| `fit_width` \| `fit_page` \| `custom` | `fitToWidth=1, fitToHeight=0` / `SinglePageSheets` | `fit_width` fits all columns across 1 page wide while rows flow; `fit_page` fits 1 page per sheet. |
| `margins` | `as_file` \| `narrow` \| `normal` \| `wide` | `<pageMargins .../>` | Adjusts printable margins (Narrow: 0.25", Normal: 0.75", Wide: 1.0"). |
| `gridlines` | `true` \| `false` | `<printOptions gridLines="1"/>` | Displays cell gridlines in output PDF. |
| `headings` | `true` \| `false` | `<printOptions headings="1"/>` | Prints row numbers and column letters. |
| `repeatHeader` | `true` \| `false` | `_xlnm.Print_Titles` (`1:1`) | Repeats top header row on every page when sheet spans multiple pages. |
| `bookmarks` | `true` \| `false` | `ExportBookmarks: true` | Creates interactive PDF bookmarks for each sheet name. |
| `trimEmpty` | `true` \| `false` | `_xlnm.Print_Area` computation | Calculates true used range and clips print area to prevent blank pages. |
| `merge` | `true` \| `false` | `pdf-lib` PDF merging | Concatenates multiple spreadsheets into a single unified PDF file. |

---

## Error Handling & HTTP Status Codes

| HTTP Status | Error Code | Trigger Condition |
| :--- | :--- | :--- |
| **400** | `NO_FILES_UPLOADED` | No files attached in multipart form request. |
| **400** | `ZERO_BYTE_FILE` | Uploaded spreadsheet file has 0 bytes. |
| **400** | `INVALID_OPTIONS` | Request body options failed Zod schema validation. |
| **404** | `DOWNLOAD_EXPIRED` | Job ID not found or already downloaded / expired. |
| **413** | `FILE_TOO_LARGE` | Single file exceeds 50 MB limit. |
| **413** | `FILE_TOO_COMPLEX` | Zip bomb detected (compression ratio > 100:1) or cell count > 5,000,000. |
| **415** | `UNSUPPORTED_FILE` | Extension or MIME magic does not match valid spreadsheet formats. |
| **422** | `ENCRYPTED_DOCUMENT` | Password-protected or encrypted workbook rejected. |
| **422** | `CONVERSION_FAILED` | LibreOffice Calc failed to export or process document. |
| **503** | `SERVER_BUSY` | Engine queue saturated (concurrency limit reached); includes `Retry-After: 5`. |
| **503** | `ENGINE_UNAVAILABLE` | LibreOffice Calc binary is not found on the system. |
| **504** | `CONVERSION_TIMEOUT` | Process execution exceeded timeout (90 seconds). |

---

## Performance & Benchmarks

Benchmarked on Windows 11 / Node.js 24 / LibreOffice 26.8:

| Document Type | Pages | Conversion Time | Output Size | Memory Peak |
| :--- | :--- | :--- | :--- | :--- |
| Single sheet report (`.xlsx`, 50 rows × 8 cols) | 1 | 1.25s | 42 KB | ~45 MB |
| Multi-sheet financial workbook (`.xlsx`, 3 sheets) | 3 | 1.48s | 88 KB | ~52 MB |
| Wide inventory table with `fit_width` (`.xlsx`, 18 cols × 200 rows) | 4 | 1.62s | 114 KB | ~58 MB |
| Delimited CSV dataset (`.csv`, 5,000 rows) | 8 | 1.35s | 165 KB | ~60 MB |
| Multi-file batch merge (2 workbooks into 1 merged PDF) | 4 | 2.45s | 128 KB | ~75 MB |
