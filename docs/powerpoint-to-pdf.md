# PowerPoint to PDF Architecture & Technical Specification

## Overview

The **PowerPoint to PDF** engine provides high-fidelity, paginated, and secure conversion of presentation slide decks into standard and archival PDF documents. It supports Microsoft PowerPoint (`.pptx`, `.ppt`, `.ppsx`, `.pps`, `.pptm`) and OpenDocument Presentation (`.odp`) formats.

Each slide is rendered with exact dimensions, fonts, vector shapes, embedded media, tables, charts, and slide backgrounds preserved. It supports full-slide exports, speaker notes layouts, and multi-slide handouts (with 1, 2, 3, 4, 6, or 9 slides per page, including ruled lines for note-taking in the 3-up layout).

---

## Architecture

The system spans across three layers within the monorepo:

1. **Contracts (`packages/contracts`)**:
   - Strongly-typed request options, Zod validation schemas (`powerpointToPdfOptionsSchema`), and standardized response interfaces (`PowerPointToPdfResponse`, `PowerPointToPdfFileItem`).
2. **API Backend (`apps/api`)**:
   - General-purpose LibreOffice runner (`services/office-to-pdf`) extended with an `impress` profile (`pdf:impress_pdf_Export:{...}`).
   - Multi-tier validation pipeline (`validate.ts`) with OLE2 / OOXML magic checks, zip-bomb protections, encryption guards, and slide count checks.
   - In-memory presentation normalizer (`normalize-pptx.ts`) performing security sanitization, VBA/macro stripping, dangerous action link neutralization (`ppaction://`, `javascript:`, `file:`), external workbook unlinking, slide range filtering, and font substitutions.
   - PDF post-processing (`post.ts`) using `pdf-lib` for handout page imposition, ruled note lines rendering, slide borders, uniform scaling to A4/Letter landscape, metadata stamping, and multi-file merging.
   - RESTful Express endpoints (`/api/v1/powerpoint-to-pdf/convert`, `/jobs/:jobId/download`, `/jobs/:jobId`) backed by a bounded concurrency pool (max 2 concurrent LibreOffice conversions) and ephemeral 10-minute job storage.
3. **Web Frontend (`apps/web`)**:
   - Angular standalone component (`PowerPointToPdfComponent`) built strictly using Ocean Workspace tokens.
   - Client-side in-browser presentation inspector (`deck-info.ts`) using JSZip and `DOMParser` without uploading files.
   - Reactive UI driven by Angular signals and computed view-models.
   - Responsive multi-device layout (optimized for 1440px desktop, 1024px tablet, and 390px mobile).

---

## Security Hardening & Zero-Trust Sandbox

### 1. In-Memory Sanitization & Threat Stripping
Before LibreOffice Impress processes an uploaded deck, `normalizePptx` strips dangerous components directly from the ZIP archive in-memory:
- **VBA & Macros**: Removes `ppt/vbaProject.bin`, `ppt/vbaProjectSignature.bin`, and active macro references.
- **ActiveX & OLE Embeddings**: Removes `ppt/activeX/*`, `ppt/embeddings/*`, and external OLE object controls.
- **External Connections & Hyperlinks**: Neutralizes malicious actions such as `ppaction://program`, `ppaction://macro`, `javascript:`, and local `file:` schemes. External web hyperlinks (`http:`, `https:`, `mailto:`) and internal slide links are strictly preserved.
- **External Chart Links**: Cleans external chart workbook links while preserving cached chart values and vector graphics.
- **Zip Bomb & Path Traversal Guard**: Rejects archives exceeding 10,000 entries, 500 MB uncompressed, 100:1 compression ratio, or containing directory traversal (`../`) paths.

### 2. Isolated LibreOffice Impress Profile
LibreOffice Impress runs with:
- An ephemeral random profile directory (`ptp-<uuid>-profile`) purged immediately upon job completion.
- `registrymodifications.xcu` configured with:
  - `MacroSecurityLevel: 3`: Macros strictly disabled.
  - `EnableJava: false`: Java runtime execution disabled.
  - `UpdateLinks: 0`: External links are never fetched.
- Execution via `execFile` with direct arguments (no shell interpolation).
- Network isolation: `http_proxy=http://127.0.0.1:0`, blocking all outbound socket connections.
- Concurrency pool: max 2 simultaneous conversions, bounded queue of 20 with `503 SERVER_BUSY` + `Retry-After: 5` header.

### 3. Ephemeral Job Retention & Auto-Deletion
- Converted PDF/ZIP files are held in an in-memory ephemeral store for a maximum of 10 minutes.
- When the client downloads the converted file via `/download`, the job is immediately purged from the store (`delete on download`).
- An active cleanup interval purges expired jobs every 60 seconds.

---

## Options & Conversion Parameters

| Option | Values | Implementation | Description |
| :--- | :--- | :--- | :--- |
| `output` | `pdf` (default) \| `pdfa` | `SelectPdfVersion: 2` (PDF/A-2b) | Standard viewing PDF or ISO-compliant archival PDF/A-2b. |
| `layout` | `slides` (default) \| `notes` \| `handout` | Impress Export filter / Post-process | `slides` (1 slide/page), `notes` (speaker notes), `handout` (multi-slide grids). |
| `handout.perPage` | `1`, `2`, `3`, `4`, `6`, `9` | `post.ts` Handout Imposition | Grid layout per page. `3` renders slides on left with ruled lines on right. |
| `handout.orientation` | `portrait` (default) \| `landscape` | `post.ts` Page Dimensions | Handout sheet orientation. |
| `handout.frames` | `true` \| `false` | `post.ts` Vector stroke | Draws a subtle 0.75pt border around each slide on handouts. |
| `slides.mode` | `all` \| `range` | `ppt/presentation.xml` & `post.ts` | Filter specific slide ranges (e.g., `1-3, 5, 8-10`). |
| `slides.includeHidden` | `true` \| `false` | `show="0"` attribute | Excludes or includes slides marked as hidden. |
| `pageSize` | `as_slide` \| `a4_landscape` \| `letter_landscape` | `post.ts` Uniform Scaling | Scales slides uniformly onto standard paper sizes with centering. |
| `bookmarks` | `true` \| `false` | `ExportBookmarks: true` | Generates hierarchical PDF bookmarks from slide titles. |
| `tagged` | `true` \| `false` | `ExportTaggedPDF: true` | Produces tagged PDF for screen reader accessibility. |
| `hyperlinks` | `true` \| `false` | `ExportLinksRelativeFsys: false` | Preserves interactive slide links and valid external URLs. |
| `imageQuality` | `standard` \| `smaller` | `Quality: 90 / 75`, `MaxImageResolution: 300 / 150` | Standard high-fidelity or compressed file size. |
| `merge` | `true` \| `false` | `post.ts` PDF Merging | Combines multiple presentation decks into a single master PDF. |

---

## Handout Layout Geometry & Math

For multi-slide handouts, `post.ts` calculates exact geometric bounding boxes preserving the original slide aspect ratio ($16:9$ or $4:3$):

- **Grid Sizing**:
  - $1$ per page: $1 \times 1$ centered.
  - $2$ per page: $1 \text{ col} \times 2 \text{ rows}$ (Portrait) or $2 \times 1$ (Landscape).
  - $3$ per page: $1 \text{ col} \times 3 \text{ rows}$ occupying the left $55\%$ of the page, with 3 ruled note lines drawn horizontally beside each slide on the right $45\%$.
  - $4$ per page: $2 \text{ cols} \times 2 \text{ rows}$.
  - $6$ per page: $2 \text{ cols} \times 3 \text{ rows}$.
  - $9$ per page: $3 \text{ cols} \times 3 \text{ rows}$.
- **Margins & Spacing**: Default margins are $36\text{pt}$ ($0.5\text{ in}$), with $18\text{pt}$ gutters between adjacent slides.
- **Slide Frames**: A $0.75\text{pt}$ border (`rgb(0.8, 0.8, 0.8)`) is rendered when `handout.frames` is enabled.
- **Page Numbering**: Footer displays "Page X of Y" centered at $24\text{pt}$ from the bottom margin.

---

## Font Replacement & Substitution

When proprietary Microsoft fonts are not locally installed on Linux/Docker servers, the conversion pipeline transparently maps them to metric-compatible open fonts:

| Requested Font | Substituted Metric Font | Package / Source |
| :--- | :--- | :--- |
| `Calibri`, `Calibri Light` | `Carlito` | `fonts-crosextra-carlito` |
| `Cambria`, `Cambria Math` | `Caladea` | `fonts-crosextra-caladea` |
| `Arial` | `Liberation Sans` | `fonts-liberation` |
| `Times New Roman` | `Liberation Serif` | `fonts-liberation` |
| `Courier New` | `Liberation Mono` | `fonts-liberation` |
| `Gotham`, `Montserrat` | `Open Sans` | `fonts-open-sans` |

Substituted fonts are returned in the response metadata (`fontsSubstituted` array) so clients can display non-intrusive warnings if visual changes occur.

---

## Error Codes & Handling

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `UNSUPPORTED_TYPE` | 400 | File format not recognized as a supported presentation format. |
| `FILE_TOO_LARGE` | 413 | Presentation exceeds the 100 MB per-file limit. |
| `PASSWORD_PROTECTED` | 422 | Presentation is encrypted or password-protected. |
| `ZIP_BOMB_DETECTED` | 422 | Compression ratio or extracted entry count exceeds security thresholds. |
| `INVALID_SLIDE_RANGE` | 400 | Slide range string is malformed or exceeds total slides in deck. |
| `CONVERSION_TIMEOUT` | 504 | LibreOffice conversion took longer than 120 seconds. |
| `SERVER_BUSY` | 503 | Concurrency queue full (>20 pending jobs). Returns `Retry-After: 5`. |
