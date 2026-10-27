# Compress PDF Diagnosis & Root Cause Analysis

## 0. Study of Existing System

1. **Libraries & Commands Used Today**:
   The current implementation in `apps/api/src/routes/compress.route.ts` and `apps/web/src/app/core/services/browser-pdf.service.ts` relies exclusively on `pdf-lib` (`PDFDocument.load` and `doc.save`). No image processing libraries (`sharp`), image encoders (`mozjpeg`), or command-line PDF utilities (`qpdf`, `mutool`, `gs`) are utilized.
2. **DPI Changes**:
   Zero DPI changes occur. Neither the API route nor the web service inspects page coordinates, calculates displayed dimensions in inches, or resizes raster images at any compression level.
3. **JPEG Quality Changes**:
   Zero JPEG quality changes occur. JPEG streams (`/DCTDecode`) are never decompressed, quantized, or re-encoded.
4. **Metadata Changes**:
   - `extreme`: Clears six basic string fields (`setTitle('')`, `setAuthor('')`, `setSubject('')`, `setKeywords([])`, `setProducer('')`, `setCreator('')`) in the `/Info` dictionary. XML/XMP streams, ICC profiles, and private piece data are retained untouched.
   - `recommended`: Retains all metadata fields.
   - `less`: Retains all metadata fields.
5. **Object Streams**:
   - `extreme`: Calls `doc.save({ useObjectStreams: true, objectsPerTick: 50 })`.
   - `recommended`: Calls `doc.save({ useObjectStreams: true })`.
   - `less`: Calls `doc.save({ useObjectStreams: false })`.
6. **Image Recompression Location**:
   Images are **nowhere** recompressed. In all three levels, raster image XObjects pass through byte-for-byte unmodified.
7. **Size Inflation Defect**:
   Disabling object streams in `less` mode significantly inflates files (up to +52.7% larger).
8. **Never-Larger Invariant Missing**:
   The engine never compares output size to input size; when an output file is larger than the original, it returns the larger file anyway.

---

## 1. Size-Breakdown Tool & Sample Analysis

We developed `apps/api/scripts/pdf-size-report.ts` and generated six representative test fixtures in `apps/api/tests/fixtures/`.

### Fixture Breakdown

| Sample | Total Size | Primary Categories | Image Count | Image Byte Weight | Top Object Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Scanned 20-page PDF** | 7.96 MB | Images (99.9%) | 20 JPEGs | 7.95 MB (99.9%) | 420.2 KB (5.2%) |
| **2. Photo-heavy brochure** | 1.54 MB | Images (99.7%) | 12 JPEGs | 1.53 MB (99.7%) | 141.9 KB (9.0%) |
| **3. Text-only contract** | 7.6 KB | Content Streams (76.9%), Structure (64.1%) | 0 | 0 B (0.0%) | 1.2 KB (15.5%) |
| **4. PowerPoint PNG slides** | 858.1 KB | Images (99.5%) | 5 PNGs | 853.5 KB (99.5%) | 182.2 KB (21.2%) |
| **5. Full (non-subset) font**| 555.0 KB | Structure / Font Stream (99.9%) | 0 | 0 B (0.0%) | 553.2 KB (99.7%) |
| **6. Word-exported with ICC**| 6.2 KB | ICC Profile (42.4%), Content (30.4%) | 0 | 0 B (0.0%) | 2.6 KB (42.4%) |

### Key Observations from Size Inspection
- In **scanned documents, photo brochures, and slide decks**, raster images account for **99.5% to 99.9%** of the entire document weight.
- In `sample-2-photo-brochure.pdf`, photos with 1800×1200 pixels are displayed on 240×160 pt page regions, yielding an effective resolution of **540 DPI** (vastly above the 144 DPI required for crisp screen reading).
- In `sample-2-photo-brochure.pdf`, the same header photos are referenced across 4 pages. Three unique images are duplicated into 12 separate stream objects, duplicating ~1.1 MB of data.
- In `sample-4-powerpoint-png.pdf`, opaque slide backgrounds are stored as heavy Flate-encoded PNG streams rather than compressed JPEGs.
- In `sample-5-full-font.pdf`, the full Arial TrueType font file (553 KB) accounts for 99.7% of the total file size.

---

## 2. Current Engine Benchmark

Running `apps/api/scripts/run-current-engine-benchmark.ts` against the current engine produced the following baseline measurements:

| Sample | Level | Original Size | Output Size | % Saved | Execution Time |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scanned 20-page PDF** | extreme | 7.96 MB | 7.96 MB | **0.0%** (+90 B saved) | 21 ms |
| **Scanned 20-page PDF** | recommended | 7.96 MB | 7.96 MB | **-0.0%** (-3 B inflated) | 35 ms |
| **Scanned 20-page PDF** | less | 7.96 MB | 7.96 MB | **-0.1%** (-4.7 KB inflated) | 18 ms |
| **Photo-heavy brochure** | extreme | 1.54 MB | 1.54 MB | **0.0%** (+112 B saved) | 4 ms |
| **Photo-heavy brochure** | recommended | 1.54 MB | 1.54 MB | **-0.0%** (-2 B inflated) | 7 ms |
| **Photo-heavy brochure** | less | 1.54 MB | 1.54 MB | **-0.1%** (-2.1 KB inflated) | 15 ms |
| **Text-only contract** | extreme | 7.6 KB | 7.5 KB | **1.7%** (+133 B saved) | 3 ms |
| **Text-only contract** | recommended | 7.6 KB | 7.6 KB | **-0.1%** (-4 B inflated) | 2 ms |
| **Text-only contract** | less | 7.6 KB | 11.7 KB | **-52.7%** (-4.1 KB inflated) | 1 ms |
| **PowerPoint PNG slides** | extreme | 858.1 KB | 858.0 KB | **0.0%** (+115 B saved) | 11 ms |
| **PowerPoint PNG slides** | recommended | 858.1 KB | 858.1 KB | **-0.0%** (-3 B inflated) | 15 ms |
| **PowerPoint PNG slides** | less | 858.1 KB | 860.3 KB | **-0.3%** (-2.2 KB inflated) | 14 ms |
| **Full (non-subset) font** | extreme | 555.0 KB | 554.9 KB | **0.0%** (+108 B saved) | 2 ms |
| **Full (non-subset) font** | recommended | 555.0 KB | 555.0 KB | **-0.0%** (-1 B inflated) | 2 ms |
| **Full (non-subset) font** | less | 555.0 KB | 557.3 KB | **-0.4%** (-2.3 KB inflated) | 2 ms |
| **Word-exported with ICC** | extreme | 6.2 KB | 6.1 KB | **1.7%** (+109 B saved) | 1 ms |
| **Word-exported with ICC** | recommended | 6.2 KB | 6.2 KB | **-0.7%** (-44 B inflated) | 1 ms |
| **Word-exported with ICC** | less | 6.2 KB | 7.7 KB | **-24.9%** (-1.5 KB inflated) | 1ms |

---

## 3. Plain-Words Root Causes

1. **Images are NEVER re-encoded or downscaled:**
   Over 99% of bytes in typical PDFs reside in raster image streams. The current engine never decodes images with Sharp or any other raster library. It simply copies existing DCTDecode and FlateDecode streams verbatim into the output PDF.
2. **Effective DPI on the page is completely ignored:**
   The engine does not check how large an image is actually displayed on the page. Images with 300 to 600+ effective DPI are stored at full camera/scanner pixel dimensions even when displayed in a 2-inch thumbnail.
3. **Large opaque PNG/Flate images are never converted to JPEG:**
   Presentation backgrounds and scanned pages stored as lossless FlateDecode PNGs take 5x-10x more space than a high-quality MozJPEG stream, but are left unconverted.
4. **Duplicate identical images are never deduplicated:**
   When a company logo or background photo is repeated across 20 or 50 pages, the engine stores 20 or 50 identical stream objects instead of referencing one shared object.
5. **No grayscale or bilevel scan detection:**
   Black-and-white or grayscale scans are stored as 3-channel 24-bit RGB images, wasting ~66% of byte capacity.
6. **"Less" compression mode turns OFF object streams, causing massive file bloat:**
   Setting `useObjectStreams: false` unpacks compressed cross-reference and object streams, causing file size to inflate by up to 52.7%.
7. **No "Never Return Larger File" safety guard:**
   When `pdf-lib` serialization results in a file larger than the input, the engine returns the enlarged file without falling back to the original.
8. **Only six string metadata fields are cleared:**
   `extreme` mode clears simple `/Info` strings (`Title`, `Author`, etc.), but leaves massive XMP XML streams, private `/PieceInfo`, and heavy embedded ICC color profiles untouched.
9. **No structural optimization via `qpdf`:**
   High-efficiency Flate recompression (level 9), cross-reference stream generation, and orphan object elimination via `qpdf` are not utilized.

---

## 4. Improvement Roadmap

1. **Image Optimization Pipeline (`apps/api/src/services/compress/image-optimizer.ts`)**:
   - Calculate effective DPI = `px / (displayed_pts / 72)`.
   - Max DPI thresholds: `extreme: 96 DPI, Q: 45`, `recommended: 144 DPI, Q: 70`, `less: 220 DPI, Q: 85`.
   - Chroma subsampling: 4:2:0 for extreme and recommended.
   - Convert opaque PNG/Flate images to MozJPEG.
   - Grayscale detection: RGB channels within tolerance → convert to single-channel DeviceGray.
   - Bilevel scan thresholding: scans with ≥ 95% near-black/near-white pixels → 1-bit thresholding.
   - Image deduplication via SHA-256 hash.
   - Threshold guard: Skip re-encoded images unless bytes saved ≥ 5%; skip images < 10 KB; never upscale.
2. **Structural & Object Stream Optimization (`apps/api/src/services/compress/structural-optimizer.ts`)**:
   - Object streams + xref streams enabled on all levels.
   - Execution of `qpdf --object-streams=generate --recompress-flate --compression-level=9 --normalize-content=n` when available on system PATH.
   - Removal of orphan objects, embedded thumbnails, PieceInfo, and private application data.
   - Strip large ICC profiles down to standard `DeviceRGB` in extreme/recommended modes.
3. **Strict Safety Rules**:
   - Invariant: Never return an output file larger than the input. If compressed size ≥ original, return original buffer with a friendly explanation.
   - Retain selectable text, outlines, bookmarks, annotations, and form fields.
   - Event loop yielding (`setImmediate`) between image processing passes to maintain Node.js concurrency.
