# PDF to PowerPoint (PPTX) Conversion Engine Documentation

## 1. Overview & Architecture

The **PDF to PowerPoint** tool converts PDF documents into editable Microsoft PowerPoint presentations (`.pptx`) with visual layout fidelity (1 slide per PDF page).

### Processing Pipeline
1. **Upload & Ingestion (`POST /api/v1/pdf-to-powerpoint/convert`)**
   - Memory storage via `multer` (up to 10 files, max 50 MB each).
   - Validates `%PDF-` magic bytes and structural integrity with `pdf-lib`.
   - Rejects encrypted/password-protected PDFs with code `ENCRYPTED_PDF` (422).
2. **Layout Extraction (`src/services/pdf-layout/analyze.mjs`)**
   - Shared layout scanner utilizing `pdfjs-dist` (v5 legacy).
   - Extracts exact page geometries, text blocks, fonts, styling, stroke/fill rectangles, lines, and raster images.
   - Detects right-aligned and center-aligned columns, unwraps affine text matrices, and merges dotted/dashed borders.
3. **PowerPoint Reconstruction (`src/services/pdf-to-powerpoint/build.ts`)**
   - Built using MIT-licensed `pptxgenjs` (v4).
   - Dynamic slide dimensions in inches (`points / 72`) with PowerPoint 1–56 inch constraint clamping.
   - Preserves Z-order: Boxes → Lines → Images → Text blocks.
   - Baseline calculation: `top = baselineY - (lineHeight * 0.8)` for exact visual alignment.
   - Generates genuine editable PowerPoint text boxes (`slide.addText`) with run-level font, color, bold, and italic attributes.
4. **Premium OCR Mode (`src/services/ocr/`)**
   - Renders pages to 200 DPI PNG images using `@napi-rs/canvas`.
   - Runs Tesseract OCR to extract word/line coordinates.
   - Synthesizes slides with full-bleed raster background and editable overlaid text boxes.
5. **Job Lifecycle & Storage**
   - In-memory volatile job store with 10-minute auto-expiry.
   - Results are automatically purged immediately upon single download (`GET /jobs/:jobId/download/:fileId`) or ZIP download (`GET /jobs/:jobId/download`).

---

## 2. API Endpoints

### `POST /api/v1/pdf-to-powerpoint/convert`
- **Request:** `multipart/form-data`
  - `files`: PDF file(s) (1 to 10 files, max 50MB each).
  - `mode`: `'no_ocr'` (default) | `'ocr'` (Premium).
  - `slideSize`: `'match_pdf'` (default) | `'widescreen_16_9'`.
  - `ocrLanguage`: OCR language code (default `'eng'`).
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "status": "completed",
      "mode": "no_ocr",
      "slideSize": "match_pdf",
      "totalFiles": 1,
      "files": [
        {
          "id": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
          "originalFilename": "presentation.pdf",
          "pptxFilename": "presentation.pptx",
          "slideCount": 12,
          "originalSizeBytes": 524288,
          "pptxSizeBytes": 128450,
          "downloadUrl": "/api/v1/pdf-to-powerpoint/jobs/f47ac10b.../download/c9bf9e57..."
        }
      ],
      "warnings": []
    }
  }
  ```

### `GET /api/v1/pdf-to-powerpoint/jobs/:jobId/download`
- Downloads bundled ZIP file for multi-file batches. Deletes job from volatile memory.

### `GET /api/v1/pdf-to-powerpoint/jobs/:jobId/download/:fileId`
- Downloads individual `.pptx` presentation. Deletes job from volatile memory.

---

## 3. Error Codes & HTTP Statuses

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `NO_FILES_UPLOADED` | 400 | No files included in multipart upload payload. |
| `ZERO_BYTE_FILE` | 400 | Uploaded file has a size of 0 bytes. |
| `INVALID_PDF_HEADER` | 400 | Missing `%PDF-` signature magic bytes. |
| `TOO_MANY_FILES` | 400 | Exceeded maximum upload limit of 10 files. |
| `INVALID_OPTIONS` | 400 | Zod schema validation failed for options. |
| `PREMIUM_REQUIRED` | 403 | OCR mode requested while OCR feature flag is disabled or unauthenticated. |
| `FILE_TOO_LARGE` | 413 | File exceeds 50 MB threshold. |
| `TOO_MANY_PAGES` | 413 | Document exceeds 100-page limit. |
| `ENCRYPTED_PDF` | 422 | Password-protected or encrypted PDF. |
| `CORRUPTED_PDF` | 422 | Corrupted PDF xref or structure that failed parser. |
| `RATE_LIMIT_EXCEEDED` | 429 | Exceeded 10 conversions per 15-minute rate limit window. |
| `JOB_NOT_FOUND` | 404 | Conversion job expired (10m retention) or already downloaded. |

---

## 4. Known Limits & Boundaries

1. **Fixed-Layout Geometry**: Presentations preserve original visual layout via absolute positioning rather than reflowable templates.
2. **Curved Vector Art**: Complex Bézier curve paths and clipping masks are omitted (reported in conversion `warnings`).
3. **Rotated Text / Vertical Writing**: Vertical/rotated CJK text runs are normalized to standard left-to-right runs.
4. **Font Embedding**: PowerPoint OpenXML spec does not permit embedding arbitrary system TrueType fonts inside `.pptx` via client-side generators. Viewer machines substitute missing fonts with closest matching installed fallbacks (Arial, Calibri, Georgia).
5. **OCR Fidelity**: OCR quality depends directly on scanner DPI and source image contrast.

---

## 5. Verification & Testing

### Running API Test Suite
```bash
npm --workspace=apps/api test
```
Runs 10 suites including:
- `tests/pdf-to-powerpoint.spec.ts` (API route, uploads, limits, error codes, job store deletion).
- `tests/pdf-to-powerpoint-layout.spec.ts` (DrawingML XML assertions, slide sizes in EMU, text positioning, vector rules).
- `tests/pdf-layout.spec.ts` (Shared scanner regression tests).

### Running Web Test Suite
```bash
npm --workspace=apps/web test -- --watch=false
```
Runs 13 test suites (78 tests) verifying signal reactivity, cancel behavior, URL revocation, and UI flow.
