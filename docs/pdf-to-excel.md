# PDF to Excel (XLSX) Conversion Engine Documentation

## 1. Overview & Architecture

The **PDF to Excel** engine extracts structured tabular data from PDF documents into genuine, editable Microsoft Excel spreadsheets (`.xlsx`). Numeric values remain numbers (so formulas like `=SUM()` work directly), dates remain dates, merged headers are preserved, and columns are properly aligned.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PROCESSING PIPELINE                           │
└────────────────────────────────────────────────────────────────────────┘
 [PDF Files Uploaded]
         │
         ▼
 1. Validation & Magic Bytes Check (%PDF-, non-zero, unencrypted)
         │
         ▼
 2. Layout & Segment Extraction (Shared analyze.mjs with raw segments)
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
 3. Lattice Table Detector                4. Stream Table Detector
    (Ruling line intersections,               (Whitespace projection,
     cell bounding boxes, merged spans)        baseline clustering, alignment)
         │                                         │
         └───────────────────┬─────────────────────┘
                             │
                             ▼
 5. Header Detection & Cross-Page Table Merging
    (Deduplicates repeated headers across page breaks)
                             │
                             ▼
 6. Column-Aware Cell Typing (typing.ts)
    (Numbers, Indian notation, decimals, dates, currency, percent)
                             │
                             ▼
 7. ExcelJS Workbook Construction (build.ts)
    (Formula injection defense, autoFilter, freeze header, borders)
                             │
                             ▼
 8. Ephemeral Volatile Job Store (10-minute auto-expiry, delete on download)
```

---

## 2. Table Detection Engine

The engine combines two complementary strategies to ensure maximum coverage across different document layouts:

### A. Lattice Detection (`detectLatticeTables`)
Used for ruled and bordered tables (invoices, tax forms, data grids):
1. **Ruling Lines Collection**: Collects explicit horizontal and vertical lines from PDF path operations (using `analyze.mjs`), as well as thin filled/stroked rectangle edges.
2. **Coordinate Snapping**: Snaps coordinates within a 3.0 pt tolerance to handle slight rendering misalignments.
3. **Intersection & Cell Synthesis**: Computes intersections between horizontal and vertical lines to identify candidate rectangular cells.
4. **Cell Spans (ColSpan & RowSpan)**: Merges adjacent grid areas lacking internal dividing lines into multi-column and multi-row merged cells.
5. **Text Assignment**: Maps extracted text segments to cells based on geometric containment, computing run-level styling (bold, italic, font size, text alignment).

### B. Stream Detection (`detectStreamTables`)
Used for borderless tables (bank statements, transaction logs, financial reports):
1. **Baseline Clustering**: Clusters text segments sharing horizontal baselines into rows (`y` within $0.35 \times \text{fontSize}$).
2. **Contiguous Row Grouping**: Groups multi-column rows separated by typical table line spacing ($\le \max(38\text{pt}, 3.5 \times \text{fontSize})$).
3. **Column Projection**: Clusters the left and right horizontal boundaries of text runs across rows to locate consistent column channels.
4. **Wrapped Line Continuations**: Detects multi-line descriptions within cells without breaking tabular row indexing.
5. **Right-Aligned Numeric Columns**: Aligns numeric and currency columns by right edge rather than left edge.

### C. Cross-Page Table Merging (`mergeCrossPageTables`)
When a table spans across consecutive pages:
1. Verifies column count equality and column width matching ($\le 4\text{pt}$ tolerance).
2. Detects repeated header rows on subsequent pages and removes duplicate header rows.
3. Merges the underlying cell grids into a unified table.

---

## 3. Cell Typing & Data Normalization

Cells are pre-typed on a column-wide basis (`typeColumnCells`) to prevent false-positive conversions:

1. **Numbers**:
   - Standard grouping: `1,250.50`, `1000000`.
   - Indian numbering system: `1,50,000` (1.5 Lakhs), `1,25,00,000` (1.25 Crores).
   - Decimal comma formats: `1.250,50` and `1250,50`.
   - Currency prefixes/suffixes: `$`, `€`, `£`, `₹`, `¥`, `CHF`, `USD`, `INR`.
   - Accounting parentheses negatives: `(150.00)` $\rightarrow$ `-150.00`.
   - Percentage notation: `15.5%` $\rightarrow$ numeric `0.155` with `0.0%` Excel formatting.
2. **Dates**:
   - Supported delimiters: `/`, `-`, `.`.
   - Formats: ISO (`YYYY-MM-DD`), `DD/MM/YYYY`, `MM/DD/YYYY`.
   - Column-wide date inference: If day $> 12$ appears anywhere in the column, disambiguates `DD/MM/YYYY` vs `MM/DD/YYYY` for the entire column.
3. **Text Protection**:
   - Product codes / identifiers containing mixed alphanumeric characters (`PRD-01`, `A123`) remain strings.
   - Numbers with leading zeros (`00123`, `0712345678`) remain strings.
   - Numbers with $> 15$ digits (credit card / IBAN numbers) remain strings to prevent IEEE 754 precision loss.
4. **Security & Formula Injection Prevention**:
   - Cell strings starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with `'` (`sanitizeFormulaInjection`) to prevent formula injection execution when opened in Excel.

---

## 4. API Specification

### `POST /api/v1/pdf-to-excel/convert`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `files`: One or more PDF files (max 10 files, 50MB each).
  - `mode`: `'no_ocr'` (default) | `'ocr'` (Premium).
  - `sheetLayout`: `'sheet_per_table'` (default) | `'sheet_per_page'` | `'single_sheet'`.
  - `multiFileOutput`: `'separate_workbooks'` (default) | `'one_workbook'`.
  - `pages`: Page range filter (e.g. `'1-3,5'`).
  - `detectTypes`: Boolean (default `true`).
  - `keepFormatting`: Boolean (default `true`).
  - `includeText`: Boolean (default `false`).
  - `mergeAcrossPages`: Boolean (default `true`).
- **Response**: `ApiResponse<PdfToExcelResponse>`

```json
{
  "success": true,
  "data": {
    "jobId": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    "isZip": false,
    "downloadUrl": "/api/v1/pdf-to-excel/jobs/f81d4fae.../download",
    "filename": "financial_report.xlsx",
    "sizeBytes": 14250,
    "formattedSize": "13.9 KB",
    "files": [
      {
        "filename": "financial_report.xlsx",
        "sheets": 1,
        "tables": 1,
        "rows": 8,
        "cells": 32,
        "downloadUrl": "/api/v1/pdf-to-excel/jobs/f81d4fae.../download"
      }
    ],
    "tables": [
      {
        "file": "financial_report.pdf",
        "page": 1,
        "sheet": "Table 1",
        "rows": 8,
        "cols": 4,
        "method": "stream",
        "confidence": 0.92,
        "preview": [
          ["Financial Metric", "FY 2024-25", "FY 2025-26", "Growth (%)"],
          ["Gross Operating Revenue", "12500000", "14550000", "0.164"]
        ]
      }
    ],
    "warnings": []
  }
}
```

### `GET /api/v1/pdf-to-excel/jobs/:jobId`
Retrieves job metadata, status, and table previews.

### `GET /api/v1/pdf-to-excel/jobs/:jobId/download`
Downloads the converted `.xlsx` workbook (or `.zip` archive). **Deletes the job immediately on download.**

### `GET /api/v1/pdf-to-excel/jobs/:jobId/download/:fileId`
Downloads a specific `.xlsx` file from a multi-file batch.

### `DELETE /api/v1/pdf-to-excel/jobs/:jobId`
Allows immediate manual cleanup of volatile server memory.

---

## 5. Error Codes & HTTP Statuses

| Error Code | Status | Reason |
|:---|:---|:---|
| `NO_FILES_UPLOADED` | 400 | No files present in request body. |
| `INVALID_PDF_HEADER` | 400 | File is missing `%PDF-` signature magic bytes. |
| `ZERO_BYTE_FILE` | 400 | Uploaded file has 0 bytes. |
| `TOO_MANY_FILES` | 400 | Uploaded more than 10 files. |
| `INVALID_PAGE_RANGE` | 400 | Page range string out of bounds. |
| `INVALID_OPTIONS` | 400 | Zod schema validation failed. |
| `PREMIUM_REQUIRED` | 403 | OCR mode requested without premium entitlement. |
| `TOO_MANY_PAGES` | 413 | Document has more than 100 pages. |
| `FILE_TOO_LARGE` | 413 | File exceeds 50MB. |
| `TOO_LARGE` | 413 | Workbook cell count exceeds 2,000,000 cells. |
| `ENCRYPTED_PDF` | 422 | Document is password-protected or encrypted. |
| `CORRUPTED_PDF` | 422 | PDF structure is damaged or unreadable. |
| `NO_TABLES_FOUND` | 422 | Document has no tabular content or selectable text. |
| `RATE_LIMIT_EXCEEDED`| 429 | Exceeded conversion rate limit (10 / 15 min). |
| `JOB_NOT_FOUND` | 404 | Job expired or already downloaded. |
| `DOWNLOAD_EXPIRED` | 404 | Download link expired or already retrieved. |

---

## 6. Retention & Privacy Model

- **Memory-Only Processing**: All conversion logic operates in volatile RAM buffers. No files or spreadsheets are written to persistent disk.
- **Ephemeral Job Store**: Jobs are held in memory for a maximum of 10 minutes.
- **Single-Use Download**: Job buffers are purged immediately upon first download.
- **Zero Third-Party Telemetry**: Document contents and cell text are never logged or transmitted to third parties.
