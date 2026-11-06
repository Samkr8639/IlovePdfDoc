# PDF to JPG Architecture & Operational Guide

## 1. Overview & Privacy Architecture

The **PDF to JPG** tool provides an entirely in-browser, zero-server-upload solution for converting PDF documents into crisp JPEG images or extracting embedded raster photography directly from PDF object streams.

### Core Privacy Guarantees
- **100% Client-Side Processing**: The original PDF file bytes, intermediate render buffers, and output JPEG images never leave the user's browser sandbox. No server endpoints, remote telemetry, or third-party image processors are involved.
- **Local Asset Self-Hosting**: PDF.js worker scripts (`/pdf.worker.min.mjs`), character maps (`/cmaps/`), standard fonts (`/standard_fonts/`), and OpenJPEG/Wasm decoders (`/wasm/`) are self-hosted in `apps/web/public/` with hardened security settings (`isEvalSupported: false`).
- **Memory Lifetime**: Transient canvas elements and object URLs are deterministically released and revoked via `URL.revokeObjectURL()` during component teardown, reset, or download completion.

---

## 2. Modes of Operation

### Mode A: "Convert pages to JPG" (Default)
Renders every selected PDF page to a full, high-fidelity JPEG image.
- **Canvas Rendering Engine**: Pages are rendered using PDF.js onto an offscreen canvas at the target resolution after evaluating rotation (`/Rotate`), crop box (`CropBox`), and user unit scaling (`UserUnit`).
- **Color Flattening**: Because the JPEG specification does not support an alpha channel, transparent regions and PDF backdrops are flattened onto a solid background color (default: `#FFFFFF`, customizable via color picker).
- **JFIF Density Injection**: Pure browser canvas `toBlob('image/jpeg')` exports often emit standard resolution without physical DPI metadata. Our engine includes a custom binary JFIF APP0 marker patcher (`jfif-patcher.ts`) that inspects and embeds explicit $X$ and $Y$ density tags in dots-per-inch into the JPEG header.
- **Grayscale Filter**: Optional luminance transform ($Y = 0.299R + 0.587G + 0.114B$) applied directly across `ImageData` pixel buffers before encoding.
- **Page Arrangements**:
  - `Separate images`: Emits one individual `.jpg` per page (downloaded directly if 1 page, packaged as a streaming ZIP if multiple).
  - `Combine all pages into one long image`: Vertically stitches selected pages into a single continuous JPEG image strip.

### Mode B: "Extract all images"
Scans the PDF object structure to extract embedded raster images, illustrations, and photos.
- **Lossless Passthrough**: When an embedded image uses standard JPEG encoding (`/DCTDecode`) without soft masks (`/SMask`), the raw compressed byte stream is extracted directly from the PDF dictionary without re-compression degradation, preserving original JPEG quality and EXIF metadata byte-for-byte.
- **Raster Image Re-encoding**: Non-DCT images (e.g. FlateDecode, raw RGB/CMYK bitmaps) are transferred to offscreen canvases and re-encoded at the user-specified quality setting.
- **Size Filtering**: Sliders allow filtering out icons, bullets, and spacer pixels (default: skip images smaller than $100 \times 100\text{ px}$).
- **Duplicate Deduplication**: Fast FNV-1a binary hashing inspects image buffers to detect recurring assets (e.g. logos or headers appearing on multiple pages). Duplicate assets are extracted once, with metadata noting all pages on which they appear.

---

## 3. Resolution & Canvas Limits Safety

Browsers impose strict architectural limits on HTML `<canvas>` surface area and dimension boundaries:
- **Chromium / Windows / macOS**: Maximum canvas area $\approx 268\text{ megapixels}$ ($16,384 \times 16,384\text{ px}$).
- **iOS Safari / WebKit**: Maximum canvas area $\approx 16.7\text{ megapixels}$ ($4,096 \times 4,096\text{ px}$).
- **JPEG Format Standard**: Maximum pixel dimension in width or height is $65,535\text{ px}$.

Our engine incorporates proactive safety calculations (`canvas-limits.ts`):
1. **DPI Clamping**: If a high DPI setting on a large architectural drawing or banner exceeds the safe canvas threshold, the engine automatically calculates the maximum viable DPI, renders without crashing, and surfaces a non-blocking warning to the user.
2. **Long Vertical Strip Protection**: If combined page heights exceed $65,535\text{ px}$, the arrangement logic warns the user and automatically adjusts scaling to prevent silent browser canvas rendering failures.

---

## 4. Encryption & Password Handling

- **Encrypted PDFs**: Documents protected by a user password are detected via PDF.js `PasswordException`. The application presents a modal dialog prompting the user for the decryption password. Decryption occurs purely in local WebAssembly memory.
- **Owner Permissions & Restrictions**: In accordance with the PDF specification (ISO 32000-1) and PDF.js architecture, document permissions (such as flags prohibiting printing or content extraction) are security advisories intended for conforming viewers rather than cryptographic access controls. Because client-side JavaScript has full access to the decrypted document bytes in browser memory, PDF.js does not enforce owner-only restriction flags once unlocked.

---

## 5. Streaming ZIP & Filename Sanitization

- **Memory-Bounded ZIP Packaging**: Large multi-page documents are packaged using `fflate` streaming Deflate algorithms with synchronous chunk flushing, preventing high memory spikes when creating ZIP archives of hundreds of high-resolution images.
- **Filename Sanitization**: Base names are strictly sanitised per character:
  - Letters, digits, dots, underscores, hyphens, and Unicode en-dashes (`–`) are preserved.
  - Path traversal sequences (`..`), control characters, directory slashes (`/`, `\`), and invalid OS characters (`:`, `*`, `?`, `"`, `<`, `>`, `|`) are stripped.
  - Page numbers and image indices are formatted with dynamic zero-padding based on document page count (e.g. `document-page-001.jpg` for a 150-page PDF).

