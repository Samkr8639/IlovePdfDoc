# JPG to PDF Architecture & Operational Guide

## 1. Overview & Privacy Architecture

The **JPG to PDF** tool provides an entirely in-browser, zero-server-upload solution for converting image files (JPEG, PNG, WebP, GIF, BMP) into standardized, publication-ready PDF documents or packaged individual PDFs in a ZIP archive.

### Core Privacy Guarantees
- **100% Client-Side Processing**: Original image buffers, intermediate layout calculations, and output PDF bytes never leave the user's browser sandbox. No server endpoints, remote telemetry, or external image processors are contacted.
- **Lossless Embedding & Security Stripping**: Standard baseline/progressive non-CMYK JPEG files are losslessly embedded into PDF object streams via `pdf-lib` without quality loss. If EXIF privacy removal is enabled (default ON), our binary parser (`JpegSanitizer`) strips APP1 (EXIF/GPS metadata), APP13 (Photoshop IPTC), and COM segments while preserving quantization tables (DQT), Huffman tables (DHT), and frame headers (SOF).
- **Memory Lifetime**: Transient image object URLs and memory buffers are deterministically released and revoked via `URL.revokeObjectURL()` during component teardown, reset, card deletion, or conversion completion.

---

## 2. Supported Formats & Magic Byte Validation

Images are validated strictly by binary magic bytes and header markers rather than file extensions or MIME types to prevent polyglot file attacks and MIME spoofing:

| Format | Magic Bytes / Signature | Decoder / Embedding Strategy |
| :--- | :--- | :--- |
| **JPEG / JPG** | `FF D8 FF` | Lossless `pdf-lib` `embedJpg()` when unrotated, RGB/Grayscale, non-CMYK; canvas fallback for rotated/CMYK |
| **PNG** | `89 50 4E 47 0D 0A 1A 0A` | Lossless `pdf-lib` `embedPng()` when unrotated; canvas fallback for rotated/indexed |
| **WebP** | `RIFF....WEBP` | Rendered to offscreen canvas and encoded as JPEG/PNG depending on alpha channel |
| **GIF** | `GIF87a` / `GIF89a` | First frame extracted and flattened onto canvas |
| **BMP** | `42 4D` (`BM`) | Rendered to offscreen canvas |
| **SVG** | `<svg` / `<?xml` | **Rejected** due to embedded script / XSS execution risks |
| **HEIC / TIFF** | `ftypheic`, `II*\0`, `MM\0*` | **Rejected with clear guidance**: "Convert HEIC/TIFF to JPG first" due to lack of standard browser decoders |

### Decompression Bomb Protection
The binary probe inspects image frame dimensions ($W \times H$) before full decoding. Images exceeding **200 megapixels** are rejected proactively to safeguard client browser memory from allocation crashes.

---

## 3. Page Geometry & Layout Calculation (`PageLayoutService`)

Each image card in the workspace dynamically computes its layout based on user selections:

### Page Sizes & DPI Resolution
- **"Same as image" (Default)**: Page dimensions equal the image dimension in PDF points ($1\text{ pt} = \frac{1}{72}\text{ in}$) calculated from the image's embedded DPI (JFIF density, EXIF resolution, or PNG pHYs chunk). If DPI is omitted or outside the $72\text{--}600$ range, a configurable default ($96\text{ DPI}$) is applied.
- **Standard Dimensions**: A4 ($595.28 \times 841.89\text{ pt}$), A3, A5, Letter ($612 \times 792\text{ pt}$), Legal, Tabloid.
- **Custom Dimensions**: User-specified width $\times$ height with units in millimeters, inches, or points (validated $20\text{--}5000\text{ mm}$).
- **PDF Page Limit Clamp**: In accordance with the PDF reference standard, page dimensions exceeding $14,400\text{ pt}$ ($200\text{ inches}$) are proportionally scaled down to prevent viewer rendering failures, with a non-blocking warning emitted.

### Margins
- **No Margin**: $0\text{ pt}$.
- **Small Margin**: $10\text{ mm}$ ($\approx 28.35\text{ pt}$).
- **Big Margin**: $20\text{ mm}$ ($\approx 56.70\text{ pt}$).
- **Custom Margin**: $0\text{--}100\text{ mm}$ validated so that printable content area remains at least 20% of the page.
- *Behavior on "Same as image"*: The page dimension expands by the specified margin on all four borders.
- *Behavior on Fixed Page Sizes*: Margins define the interior printable content box.

### Image Fit & Alignment
- **Fit inside margins (Default)**: Proportional scale-to-fit inside the content box without cropping or distortion.
- **Fill page (Crop to fit)**: Scales image to completely cover the content box, clipping overflow regions using PDF graphics state operators (`pushGraphicsState()`, `rectangle()`, `clip()`, `endPath()`, `popGraphicsState()`).
- **Original size**: 1:1 pixel rendering at its physical DPI, centered, and scaled down only if exceeding the printable boundaries.
- **Alignment**: Center (horizontal & vertical) or Top-aligned.

---

## 4. Workspace Features & Reordering

1. **Card Grid**: Real-time CSS mini page preview visualizing exact page aspect ratios, dashed margin boundaries, and image placement.
2. **Drag-and-Drop**: Native HTML5 drag-and-drop reordering with visual ghost feedback.
3. **Keyboard & Touch Accessibility**: Card arrow buttons (`‹` / `›`) and `Alt+ArrowLeft` / `Alt+ArrowRight` hotkeys for accessible reordering.
4. **Card Operations**: Per-card CCW/CW $90^\circ$ rotation, removal, and live page numbering badges.
5. **Canvas Toolbar**:
   - Sort by Name A–Z and Z–A (natural alphanumeric ordering).
   - Reverse Order.
   - Rotate All ($90^\circ$ CW).
   - Clear All workspace reset.
6. **Floating Add-Dock**: Squircle `+` button with counter badge, plus direct device, Google Drive, and Dropbox entry points.

---

## 5. Output Modes & ZIP Packaging

- **Merged PDF (Default ON)**: Produces a single, combined PDF containing one page per image.
- **Individual PDFs in ZIP (Merge OFF)**: Generates an independent PDF document for each image and bundles them using `fflate` streaming ZIP archiving without memory bloat.
- **Metadata & Page Numbering**:
  - Optional custom PDF title and author in document information dictionary.
  - Optional footer page numbering (`n / N`) in Helvetica centered at the bottom of each page.
- **Filename Sanitization**:
  - File names are sanitized against path traversal (`..`), directory slashes (`/`, `\`), and invalid filesystem characters.
  - Duplicate output file names in ZIP mode are disambiguated with sequential suffixes (e.g. `photo (1).pdf`).

