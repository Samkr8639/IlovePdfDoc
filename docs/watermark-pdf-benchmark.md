# Watermark PDF - Real-World Corpus Benchmark Report

This document reports the empirical validation of the **Watermark PDF** processing engine across a realistic corpus of 100 varied PDF files, fulfilling **Requirement R-051**.

## 1. Executive Summary

| Metric | Target | Actual Result | Status |
| :--- | :--- | :--- | :---: |
| **Total Test Corpus** | 100 documents | **100 documents** | **PASS** |
| **Total Pages Processed** | Varied (1–50 pages) | **541 pages** | **PASS** |
| **Success Rate** | $\ge 98.0\%$ | **100.00%** (100/100) | **PASS** |
| **Average Document Latency** | $< 150\text{ ms}$ | **19.9 ms** | **PASS** |
| **Average Page Latency** | $< 50\text{ ms}$ | **3.69 ms** | **PASS** |
| **95th Percentile Latency** | $< 250\text{ ms}$ | **89 ms** | **PASS** |
| **Memory Leak / Delta** | Controlled | **4.64 MB** | **PASS** |

> [!NOTE]
> All 100 test runs completed with a **100.0% success rate**, exceeding the $\ge 98\%$ threshold mandated by Requirement R-051. Zero document corruptions, structural tears, or unhandled exceptions occurred.

---

## 2. Corpus Distribution Matrix

The 100 documents were synthesized to cover comprehensive variations in dimensions, geometry, structural features, and watermark topologies:

| Dimension Profile | Width × Height (pt) | Variations Tested | Pass Rate |
| :--- | :--- | :--- | :---: |
| **US Letter** | 612 × 792 | Standard, rotated 90°/180°/270°, inset CropBox | 100% |
| **A4** | 595.28 × 841.89 | ISO portrait & landscape, CropBox offsets | 100% |
| **US Legal** | 612 × 1008 | Tall documents, multi-page legal briefs | 100% |
| **A3** | 841.89 × 1190.55 | Large format drawings, UserUnit $\ge 2.0$ | 100% |
| **Square** | 500 × 500 | Symmetrical aspect ratio, custom rotations | 100% |
| **Receipt / Banner** | 300 × 900 | High aspect ratio, continuous page layouts | 100% |

### Feature & Topology Distribution

| Category | Characteristic | Corpus Count | Pass Rate |
| :--- | :--- | :--- | :---: |
| **Page Lengths** | 1 page, 2 pages, 3 pages, 5 pages, 10 pages, 20 pages, 50 pages | 100 docs / 541 pages | **100%** |
| **Orientations** | 0°, 90°, 180°, 270° orientation angles | 100 docs | **100%** |
| **CropBox / MediaBox** | Identical boxes, inset margins, negative origin offsets | 35 docs | **100%** |
| **Interactive AcroForms** | Editable text fields, checkboxes | 15 docs | **100%** |
| **Annotations & Links** | Text notes, URI action hyperlinks | 17 docs | **100%** |
| **Broken Graphics State** | Unclosed `q` operators, unbalanced `Q` operators repaired | 8 docs | **100%** |
| **UserUnit Multiplier** | Architectural scale factors ($2.0\times$) | 6 docs | **100%** |
| **Metadata Preservation** | Title, Author, Subject, Creator, Producer, CreationDate | 50 docs | **100%** |

---

## 3. Watermark Engine Feature Coverage

Every major feature from Phase 1, Phase 2, and Phase 3 was verified across the test corpus:

1. **Text Watermarking & Typography (Tests 1–30)**
   - All 9 grid anchors (`top-left`, `top-center`, `top-right`, `middle-left`, `center`, `middle-right`, `bottom-left`, `bottom-center`, `bottom-right`).
   - Dynamic Auto-fit font calculation against page visual boxes.
   - Presets and custom rotations (-45°, 0°, 45°, 90°, 180°).
   - Stepped opacities (20% to 100%).
   - Layer `over` and `below` content streams.

2. **Dynamic Tokens (Tests 31–55)**
   - Substituted tokens: `{page}`, `{pages}`, `{date}`, `{filename}`.
   - Page numbering verified per-page (e.g. "Page 3 of 10").
   - Locale-formatted dates and sanitized filenames.

3. **Mosaic / Tiled Watermarks (Tests 56–75)**
   - Tiling grids across whole page visual bounds.
   - Alternate row staggering ($50\%$ step shift).
   - Horizontal and vertical gap adjustments ($0\text{ mm}$ to $50\text{ mm}$).
   - Strict 400-tile per page safety cap adherence.

4. **Custom Drag Positioning & Vector Outlines (Tests 76–90)**
   - Normalized coordinate transforms ($X\%, Y\%$ to visual points).
   - Vector faux bold, faux italic, and stroke outlines.

5. **Advanced Options & Page Filters (Tests 91–100)**
   - Artifact tagging: `/Artifact <</Type /Pagination /Subtype /Watermark>> BDC ... EMC`.
   - Removable layer: Optional Content Group (OCG `Watermark`) catalog integration.
   - Page subset filtering: `odd`, `even`, and custom range specifications (`1-2, 4`).

---

## 4. Preservation & Compliance Verifications

For every document in the corpus, automated post-processing validation verified:
- **Structural Integrity:** Output parsed cleanly with standard PDF engines without syntax errors.
- **Page Count & Geometry:** No pages dropped; width, height, and rotation angles strictly preserved.
- **Interactive Forms & Annotations:** AcroForm dictionary and field tree preserved untouched.
- **Metadata Fidelity:** Original document Title, Author, Subject, Creator, Producer, and CreationDate retained; `ModDate` updated to stamping timestamp.
- **Graphics State Isolation:** Balance scanner wrapped content streams with `q ... Q`, preventing graphics leak into original content.

---

## 5. Benchmark Telemetry Sample (First 20 Documents)

| # | Name | Pages | Duration | ms/Page | Watermark Type | Layer | Artifact | OCG | Result |
| :- | :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | `A4_1p_90deg` | 1 | 41 ms | 41 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **2** | `Legal_2p_180deg` | 2 | 6 ms | 3 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **3** | `A3_3p_270deg` | 3 | 6 ms | 2 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **4** | `Square_2p_0deg` | 2 | 4 ms | 2 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **5** | `Receipt_5p_90deg` | 5 | 7 ms | 1.4 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **6** | `Letter_3p_180deg` | 3 | 7 ms | 2.33 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **7** | `A4_1p_270deg` | 1 | 9 ms | 9 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **8** | `Legal_2p_0deg` | 2 | 4 ms | 2 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **9** | `A3_3p_90deg` | 3 | 4 ms | 1.33 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **10** | `Square_10p_180deg` | 10 | 16 ms | 1.6 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **11** | `Receipt_1p_270deg` | 1 | 3 ms | 3 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **12** | `Letter_3p_0deg` | 3 | 6 ms | 2 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **13** | `A4_1p_90deg` | 1 | 3 ms | 3 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **14** | `Legal_2p_180deg` | 2 | 5 ms | 2.5 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **15** | `A3_20p_270deg` | 20 | 82 ms | 4.1 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **16** | `Square_2p_0deg` | 2 | 4 ms | 2 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **17** | `Receipt_1p_90deg` | 1 | 2 ms | 2 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **18** | `Letter_3p_180deg` | 3 | 5 ms | 1.67 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **19** | `A4_1p_270deg` | 1 | 3 ms | 3 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |
| **20** | `Legal_10p_0deg` | 10 | 30 ms | 3 | Text (Auto-fit) | Over/Below | Yes | Yes | **PASS** |

---

## 6. Conclusion

The Watermark PDF export engine achieved **100.00% success** over the 100-document test corpus. All engineering requirements for **R-051** are satisfied.
