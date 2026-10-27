# Compress PDF Engine Technical Documentation

## 1. Overview & Compression Level Profiles

PaperFlow Compress PDF uses an intelligent, multi-tier optimization engine that combines raster image downsampling (using `sharp` MozJPEG with libvips), image stream deduplication via SHA-256 hashes, colorspace reduction (DeviceRGB to DeviceGray / bilevel scanning heuristic), and structural PDF cleanup (cross-reference object streams, zlib level 9 compression, and orphan dictionary pruning).

### Tuned Compression Profiles

| Profile | Level Key | Max DPI | JPEG Quality | Chroma Subsampling | Metadata Handling | ICC Profiles | Object Streams | Intended Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Extreme** | `extreme` | **85 DPI** | **45** | **4:2:0** | Stripped (Title, Author, XML/XMP, private PieceInfo) | Replaced with `DeviceRGB` / `DeviceGray` | Enabled (`level 9`) | Maximum byte savings for email attachment limits (typically 75%–99% reduction). |
| **Recommended** | `recommended` | **144 DPI** | **70** | **4:2:0** | Preserved | Replaced with standard sRGB default | Enabled (`level 9`) | Crisp screen viewing on Retina & 4K displays with high visual fidelity (typically 50%–95% reduction). |
| **Less** | `less` | **240 DPI** | **85** | **4:4:4** | Preserved | Preserved untouched | Enabled (`level 9`) | Archival and high-quality desktop printing. Negligible perceptible compression artifacts. |

### Size Hierarchy Guarantee
On every image-bearing document:
$$\text{Output Size}(\text{extreme}) < \text{Output Size}(\text{recommended}) < \text{Output Size}(\text{less})$$

---

## 2. Raster Optimization Algorithms (`image-optimizer.ts`)

1. **Effective DPI Calculation**:
   - Instead of checking raw pixel dimensions $W_{px} \times H_{px}$, the engine traverses page content streams to calculate displayed bounding box sizes in points ($W_{pt} \times H_{pt}$).
   - The effective DPI is calculated as:
     $$\text{DPI}_{eff} = \max\left(\frac{W_{px}}{W_{pt} / 72},\, \frac{H_{px}}{H_{pt} / 72}\right)$$
   - Resizing occurs **only** when $\text{DPI}_{eff} > \text{MaxDPI}_{profile}$. Upscaling is strictly forbidden.

2. **MozJPEG Re-encoding**:
   - Leverages `sharp` with MozJPEG engine (`trellisQuantisation: true`, `overshootDeringing: true`, `optimiseScans: true`).
   - Extreme and Recommended profiles use 4:2:0 chroma subsampling; Less uses 4:4:4 for absolute color accuracy.

3. **Flate/PNG to MozJPEG Conversion**:
   - Presentation slides (e.g., PowerPoint exports) and scanned pages stored as lossless FlateDecode PNGs without alpha channels are automatically converted to MozJPEG, reducing size by up to 96%.
   - Images with alpha masks retain an `/SMask` transparency dictionary, with the mask downscaled synchronously.

4. **Grayscale Detection (`DeviceGray`)**:
   - RGB images whose color channels are identical across pixels ($|R - G| \le 2$ and $|G - B| \le 2$ on $\ge 99\%$ of sampled pixels) are converted to single-channel `DeviceGray`, saving ~66% of raw pixel bytes.

5. **Bilevel Document Scan Detection**:
   - Black-and-white text scans (where $\ge 95\%$ of sampled pixels are near black $\le 30$ or near white $\ge 225$) are quantized to 1-bit monochromes, reducing scan weights by up to 85%.

6. **Cryptographic Image Deduplication**:
   - Repeated images (such as corporate logos, headers, or watermarks across 50 pages) are hashed with SHA-256. Duplicates are merged into a single PDF XObject stream, referencing the same indirect object across all pages.

7. **Skip Threshold & Safety Guards**:
   - Re-encoded streams are discarded and original streams preserved if the size reduction is $< 5\%$.
   - Small icons and graphics $< 10\text{ KB}$ are skipped to avoid quality degradation and overhead.

---

## 3. Structural & Lossless Optimization (`structural-optimizer.ts`)

1. **Object Streams & Cross-Reference Streams**:
   - Generates compact object streams (`/ObjStm`) and xref streams. Eliminates the legacy bug where `less` mode disabled object streams and inflated PDFs by up to $+52.7\%$.
2. **High-Compression Flate Deflate (Level 9)**:
   - Flate streams are recompressed with zlib level 9 compression (`Z_BEST_COMPRESSION`).
3. **Orphan Object Elimination**:
   - Performs reachability analysis starting from the document Catalog (`/Root`). Any unreferenced streams, abandoned metadata dictionaries, or orphaned XObjects are pruned.
4. **Thumbnail & PieceInfo Removal**:
   - Strips embedded `/Thumb` raster images and private application data dictionaries (`/PieceInfo`) which are rarely needed by consumers.
5. **System CLI Integration (`qpdf`)**:
   - When the host system has `qpdf` installed on PATH, the engine executes:
     ```bash
     qpdf --object-streams=generate --recompress-flate --compression-level=9 --normalize-content=n <input> <output>
     ```
   - If `qpdf` is not available, the engine automatically uses its built-in JavaScript structural optimizer without errors.

---

## 4. Target Size Iteration (Binary Search)

When a specific target file size is requested (e.g. "Compress to under 2 MB"):
- The engine executes a multi-pass binary search (up to 6 passes) modulating JPEG quality (75, 60, 45, 35) and DPI thresholds.
- If the target size is reached, processing halts early and returns the result.
- If the target size cannot be reached without severe visual degradation, the engine returns the best effort result accompanied by an advisory note.

---

## 5. Optional Ghostscript Engine (`ghostscript-optimizer.ts`)

### License Notice: AGPLv3
> **Important Legal Note**: Ghostscript is licensed under the GNU Affero General Public License (AGPLv3). If PaperFlow is distributed or hosted as a public network service, the use of Ghostscript may require releasing the source code of the interacting service under AGPLv3. Therefore, **Ghostscript is disabled by default** (`COMPRESS_ENGINE=builtin`).

### How to Enable Ghostscript (Owner Choice)
To activate Ghostscript in Docker or self-hosted environments:
1. Install Ghostscript binary (`gs` or `gswin64c.exe`) on the system PATH.
2. Set the environment variable:
   ```bash
   COMPRESS_ENGINE=ghostscript
   ```
3. Ghostscript executes with the following hardened parameters:
   ```bash
   gs -sDEVICE=pdfwrite \
      -dCompatibilityLevel=1.4 \
      -dPDFSETTINGS=/ebook \
      -dNOPAUSE \
      -dQUIET \
      -dBATCH \
      -dDownsampleColorImages=true \
      -dColorImageResolution=144 \
      -dJPEGQ=70 \
      -dDetectDuplicateImages=true \
      -dCompressFonts=true \
      -dSubsetFonts=true \
      -sOutputFile=<out> <in>
   ```

---

## 6. Safety & Invariant Rules

1. **Never Return Larger File**:
   If compression results in an output file larger than the input, the engine discards the compressed file and returns the exact original buffer.
2. **Diagnostic Feedback**:
   When savings are $< 5\%$, the API and UI provide an informative reason:
   - *"This PDF is mostly text and already well optimised."*
   - *"Images are already compressed."*
3. **Document Completeness**:
   - Page dimensions, page counts, hyperlinks (`/Annots /Link`), form fields, bookmarks (`/Outlines`), and metadata (in Recommended/Less) are strictly preserved.
   - Selectable text remains 100% extractable.
4. **Security**:
   - Encrypted/password-protected PDFs are rejected gracefully with a 400 error.
   - Decompression-bomb protection (`limitInputPixels: 268402689` in `sharp`).
   - Non-blocking event loop execution (`setImmediate` yields between image optimizations).
