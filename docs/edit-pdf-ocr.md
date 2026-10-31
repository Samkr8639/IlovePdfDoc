# Edit PDF & Cloud OCR Architecture and Specifications

## 1. Executive Summary
The Edit PDF tool provides an in-browser canvas document editor (`pdf.js` + `pdf-lib` + SVG overlay) with a privacy-first hybrid execution foundation. All standard editing (text insertion, freehand drawing, shapes, highlights, whiteouts, and signatures) executes 100% locally on the user's device. When optical character recognition (OCR) is explicitly requested via "Make text editable", the selected page subset is transmitted over TLS 1.3 to our ephemeral backend OCR engine, which recognizes layout and text, returns structured bounding boxes and words, and purges all document bytes immediately upon retrieval or after 10 minutes.

---

## 2. Hybrid Privacy Model & Guard Architecture

### 2.1 Principle of Least Privilege Data Transmission
- **Page-Subset Isolation**: The client extracts ONLY the selected pages using `pdf-lib` (`buildPageSubsetPdf(pdfBytes, pageIndexes)`). Non-selected pages are never sent to the network.
- **ServerActionGuard**: An impenetrable security boundary guaranteeing that no HTTP request containing document bytes can leave the browser without verifiable explicit consent.
- **UploadConsentDialog**: An accessible, focus-trapped, keyboard-navigable (`Escape` to cancel, `Tab` cycling) modal dialog informing the user:
  - Exact payload ("N pages of this PDF").
  - Technical purpose (OCR character recognition).
  - Volatile retention guarantee ("Deleted automatically after 10 minutes").
  - Link to Privacy Policy.
  - Optional session-scoped "Don't ask again in this session" (`sessionStorage` only, never persisted to disk).

---

## 3. OCR Engine Architecture (`apps/api`)

### 3.1 Pipeline
1. **Validation & Security**:
   - Magic byte validation (`%PDF-`).
   - File size limit: 25 MB (`OCR_MAX_FILE_SIZE`).
   - Page count limit: 20 pages max per job (`OCR_MAX_PAGES`).
   - Encrypted PDF rejection: HTTP 422 `ENCRYPTED_PDF`.
2. **Page Rendering**:
   - Renders at 300 DPI (`scale = 300 / 72`) with `@napi-rs/canvas` and `pdfjs-dist`.
   - Dimension cap: capped at 4000x4000 pixels to prevent OOM.
   - Converted to grayscale via `sharp`.
3. **Deskew Detection**:
   - Computes horizontal projection profile variance across angles $-15^\circ$ to $+15^\circ$.
   - Rotates image only when $|\text{angle}| \ge 0.5^\circ$ and $\le 15^\circ$.
4. **Tesseract Recognition**:
   - Executes with language models (default: `eng`, plus multilingual support for Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Urdu, etc.).
   - Page segmentation mode 3 with fallback.
   - Extracts blocks, paragraphs, lines, and word coordinates.
5. **Coordinate Normalization**:
   - Converts image pixel coordinates to normalized PDF points (72 DPI, origin at bottom-left).
   - Computes baseline $y$ coordinate and estimates font size from line height.
   - Drops noise lines with confidence $< 15$ or non-text content.

---

## 4. REST API Specification

### 4.1 Endpoints
- `POST /api/v1/edit-pdf/ocr`: Accepts multipart form (`file` + `options` JSON). Returns HTTP 202 `{ jobId: string }`.
- `GET /api/v1/edit-pdf/ocr/jobs/:id`: Returns job status (`queued`, `running`, `done`, `failed`, `cancelled`), progress (0-100), and current page.
- `GET /api/v1/edit-pdf/ocr/jobs/:id/result`: Returns structured OCR lines, words, baseline, and confidence. Auto-deletes from memory upon fetch.
- `DELETE /api/v1/edit-pdf/ocr/jobs/:id`: Aborts active worker and purges job data immediately.
- `GET /api/v1/edit-pdf/ocr/languages`: Returns list of installed and supported tessdata languages.

### 4.2 Error Codes
- `415 UNSUPPORTED_FILE`: Invalid header or non-PDF mime type.
- `400 ZERO_BYTE_FILE`: Uploaded file is empty.
- `413 TOO_MANY_PAGES`: Document exceeds 20 pages.
- `400 INVALID_OPTIONS`: Malformed options schema.
- `400 UNSUPPORTED_LANGUAGE`: Selected language not in installed allow-list.
- `422 ENCRYPTED_PDF`: PDF is password-protected or encrypted.
- `422 OCR_FAILED`: General parsing or OCR engine failure.
- `504 OCR_TIMEOUT`: Processing exceeded 45s per page or 180s per job.
- `503 SERVER_BUSY`: Server concurrency capacity reached (includes `Retry-After: 30`).
- `503 FEATURE_DISABLED`: Kill-switch `OCR_ENABLED=false` active.
- `429 RATE_LIMITED`: Exceeded 10 OCR jobs per hour per IP.
- `404 JOB_NOT_FOUND`: Job ID expired or does not exist.

---

## 5. Client Application (`apps/web`)

### 5.1 Result Application Modes
1. **Searchable text (default)**:
   - Injects an `ocr-layer` object into the document model.
   - On export (`PdfExportService`), draws text invisibly (`opacity: 0` / PDF rendering mode 3) positioned on the OCR bounding boxes.
   - Preserves 100% visual fidelity of original scans while making text searchable and copy-pasteable.
2. **Editable text boxes**:
   - Generates grouped elements per line:
     - (a) Background whiteout cover rectangle.
     - (b) Editable text box with recognized text, estimated font size, baseline, and dark color.
   - Can be edited or deleted individually.
3. **Low-Confidence Word Flagging**:
   - Words with confidence $< 60\%$ are flagged in a "Review" list.
   - Clicking any item jumps to the corresponding page and highlights the bounding box.
4. **Single Undoable Command**:
   - Applying either mode executes as one atomic command in `CommandHistoryService`.
   - Undo/Redo cleanly restores or removes all generated elements without data loss.

---

## 6. Design System Compliance
- Standard Ocean Workspace tokens used exclusively (`--pt-navy`, `--pt-teal-700`, `--pt-surface-white`, `--pt-subtle-bg`, etc.).
- Zero hardcoded hex color codes outside tokens.
- Self-hosted variable typography (`Sora` headings, `Inter` UI body).
- Lucide SVG icons used across all controls.
