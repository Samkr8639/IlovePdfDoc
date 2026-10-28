# PDFTailor Complete Brand & UI Redesign — Phase 0: Baseline Audit

**Document Date:** October 28, 2026  
**Target Brand:** PDFTailor  
**Target Domain:** pdftailor.in  
**Branch:** `feature/complete-brand-redesign` (branched from `dev`)  
**Mission:** Complete visual identity, layout, and UI redesign of the web PDF toolkit to create an original, premium, and minimal platform ("Ocean Workspace") while strictly preserving 100% of feature logic, routes, and user flow.

---

## 1. Technical Stack & Baseline Environment

| Category | Current Value / Version | Notes / Redesign Target |
| :--- | :--- | :--- |
| **Monorepo Architecture** | npm workspaces (`packages/*`, `apps/*`) | `@paperflow/contracts`, `@paperflow/api`, `apps/web` |
| **Frontend Framework** | **Angular v22.2.0** (Standalone Components, Signals, Zoneless) | Keep Angular 22 standalone architecture intact. |
| **UI Library** | Bespoke Vanilla CSS (no Angular Material installed yet) | Install **Angular Material v22** with Material 3 theming (`@angular/material`). |
| **Icons** | Custom inline SVGs & partial emoji/Unicode | Migrate to **Lucide icons** exclusively (Font Awesome brands only for Google Drive, Dropbox, X, LinkedIn, Facebook, Instagram). |
| **Styling Approach** | Vanilla CSS per component + `src/styles.css` | Material 3 tokenized CSS variables (`--pt-*` palette, typography, shapes). |
| **Build Tool** | `@angular/build:application` (esbuild + vite via Angular CLI 22.2.3) | High-speed bundle generation. Budgets: Initial 2MB warning, 3MB error. |
| **SSR / SSG Setup** | **Disabled** (Pure Client-Side SPA via `index.html` + `main.ts`) | Guard animations with browser checks; indexable semantic HTML structure. |
| **Test Setup** | **Vitest v5.0.0** (`@angular/build` + jsdom) for `apps/web`; **Jest v29.7.0** for `apps/api` | 13 test suites (80 tests) in web; 11 test suites (68 tests) in api. |
| **Lint Setup** | Prettier v3.8.1 in `apps/web/package.json` | Add `cspell` for automated spelling verification. |
| **TypeScript Version** | TypeScript v6.0.2 (`apps/web`), v5.7.0 (`apps/api`) | Strict type checking enabled. |

---

## 2. Full Route Map, Shared Layouts & Component Tree

### 2.1 Route Map (`apps/web/src/app/app.routes.ts`)

| Route Path | Component / Strategy | Functional State | Page Title (Baseline) |
| :--- | :--- | :--- | :--- |
| `/` | `HomeComponent` (eager) | **Production Active** | `PDF flow - Online PDF Converter & Document Tools` |
| `/merge-pdf` | `MergePdfComponent` (eager) | **Production Active (Tool 1)** | `Merge PDF Online Free - Combine PDF Files Privately \| PDF flow` |
| `/split-pdf` | `ToolPlaceholderComponent` (eager) | **Production Active (Tool 2)** | `Split PDF Online - Separate PDF Pages \| PDF flow` |
| `/compress-pdf` | `ToolPlaceholderComponent` (eager) | **Production Active (Tool 3)** | `Compress PDF Online \| PDF flow` |
| `/pdf-to-word` | `PdfToWordComponent` (eager) | **Production Active (Tool 4)** | `PDF to Word Converter Online \| PDF flow` |
| `/pdf-to-powerpoint` | `PdfToPowerPointComponent` (lazy) | **Production Active (Tool 5)** | `PDF to PowerPoint Converter Online \| PDF flow` |
| `/pdf-to-excel` | `ToolPlaceholderComponent` | Planned Placeholder | `PDF to Excel Converter \| PDF flow` |
| `/word-to-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Word to PDF Converter Online \| PDF flow` |
| `/powerpoint-to-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `PowerPoint to PDF Converter \| PDF flow` |
| `/excel-to-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Excel to PDF Converter \| PDF flow` |
| `/edit-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Edit PDF Online Free \| PDF flow` |
| `/pdf-to-jpg` | `ToolPlaceholderComponent` | Planned Placeholder | `PDF to JPG Converter Online \| PDF flow` |
| `/images-to-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `JPG to PDF Converter Free Online \| PDF flow` |
| `/sign-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Sign PDF Online - Free E-Signatures \| PDF flow` |
| `/watermark-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Watermark PDF Online \| PDF flow` |
| `/rotate-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Rotate PDF Online - Permanently Rotate Pages \| PDF flow` |
| `/html-to-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `HTML to PDF Converter \| PDF flow` |
| `/unlock-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Unlock PDF Online - Remove Password \| PDF flow` |
| `/protect-pdf` | `ToolPlaceholderComponent` | Planned Placeholder | `Protect PDF with Password Online \| PDF flow` |
| `/about-us` (`/about`) | `AboutUsComponent` (lazy) | Static Content | `About Us - The Story & Mission Behind PDF flow...` |
| `/contact-us` (`/contact`) | `ContactUsComponent` (lazy) | Form (Connected to API) | `Contact - Get in Touch with PDF flow Support & Sales` |
| `/privacy-policy` (`/privacy`) | `PrivacyPolicyComponent` (lazy) | Static Content | `Privacy Policy — PDF flow Document Processing...` |
| `/terms-and-conditions` (`/terms`, `/tos`)| `TermsAndConditionsComponent` (lazy) | Static Content | `Terms & Conditions — PDF flow Document Processing...` |
| `/gdpr-compliance` (`/gdpr`) | `GdprComplianceComponent` (lazy) | Static Content | `GDPR Compliance & Data Protection — PDF flow` |
| `/security-whitepaper` (`/security`)| `SecurityWhitepaperComponent` (lazy) | Static Content | `Security Architecture & Document Processing...` |
| `/cookie-settings` (`/cookies`) | `CookieSettingsComponent` (lazy) | Interactive Preferences | `Cookie Settings & Privacy Preferences — PDF flow` |
| `/press-media-kit` (`/press`) | `PressMediaKitComponent` (lazy) | Static Brand Assets | `Press & Media Kit — Official Brand Assets & Resources...` |
| `**` | Wildcard | Redirect to `/` | Redirect to Home |

### 2.2 Shared Layout & Component Hierarchy

```
App (apps/web/src/app/app.ts)
├── HeaderComponent (apps/web/src/app/shared/components/header/)
│   ├── Logo & Brand Mark
│   ├── Primary Tool Links (Merge, Split, Compress)
│   ├── Dropdown Menus: "Convert PDF", "All PDF Tools" (To be unified into full-width MegaMenu)
│   └── Auth CTAs (Login, Sign up)
├── Main Content (<main class="app-main">)
│   └── <router-outlet />
│       ├── HomeComponent
│       ├── MergePdfComponent (Tool 1)
│       │   ├── DropzoneComponent
│       │   ├── Organize Canvas & Sidebar
│       │   ├── ProcessingStateComponent
│       │   └── ResultViewComponent
│       ├── ToolPlaceholderComponent (Tools 2 & 3: Split PDF, Compress PDF, plus Placeholders)
│       │   ├── DropzoneComponent
│       │   ├── Tool Workspace (Custom ranges, Page selection, Compression profiles)
│       │   ├── ProcessingStateComponent
│       │   └── ResultViewComponent
│       ├── PdfToWordComponent (Tool 4)
│       │   ├── DropzoneComponent
│       │   ├── Options Sidebar (OCR language, Standard Layout)
│       │   ├── ProcessingStateComponent
│       │   └── ResultViewComponent (Word layout iframe preview)
│       ├── PdfToPowerPointComponent (Tool 5)
│       │   ├── DropzoneComponent
│       │   ├── Options Sidebar (OCR language, Slide Aspect Ratio 16:9 / 4:3)
│       │   ├── ProcessingStateComponent
│       │   └── ResultViewComponent (PowerPoint preview)
│       └── Informational / Legal Pages (About, Contact, Privacy, Terms, GDPR, Security, Cookies, Press)
├── FooterComponent (apps/web/src/app/shared/components/footer/) [Hidden in workspace mode via LayoutService]
│   ├── 5-Column Navigation (Product, Resource, Solutions, Legal, Company)
│   ├── Language Selector (Google Translate Integration)
│   └── Copyright & Social Links
└── BackToTopComponent (apps/web/src/app/shared/components/back-to-top/)
```

---

## 3. FEATURE FREEZE LIST (Zero Logic Diff Required)

The following files and directories encapsulate core document parsing, WebAssembly execution, API endpoints, serialization, validation logic, and state management. **No changes to logic, arguments, return signatures, or algorithms are permitted:**

### 3.1 Backend & Contracts (MUST NOT BE TOUCHED)
1. `apps/api/src/services/compress/**` (All files: `index.ts`, `image-optimizer.ts`, `structural-optimizer.ts`, `ghostscript-optimizer.ts`, `types.ts`)
2. `apps/api/src/services/ocr/**` (`index.ts`)
3. `apps/api/src/services/pdf-layout/**` (`index.ts`, `analyze.mjs`)
4. `apps/api/src/services/pdf-to-word/**` (`index.ts`, `engine.mjs`, `docx-generator.ts`, `pdf-layout-extractor.ts`, `document-layout-reconstructor.ts`)
5. `apps/api/src/services/pdf-to-powerpoint/**` (`index.ts`, `build.ts`)
6. `apps/api/src/routes/**` (`compress.route.ts`, `contact.route.ts`, `health.route.ts`, `pdf-to-powerpoint.route.ts`, `pdf-to-word.route.ts`, `tools.route.ts`)
7. `apps/api/src/middleware/**` (`errorHandler.ts`, `rateLimiter.ts`, `premiumOcrGate.ts`)
8. `apps/api/tests/**` (All 11 test suites)
9. `packages/contracts/src/**` (`index.ts`, `pdf-to-word.ts`, `pdf-to-powerpoint.ts`, `tools.ts`)

### 3.2 Frontend Core Services & Utils (MUST NOT BE TOUCHED)
1. `apps/web/src/app/core/services/browser-pdf.service.ts` (Client-side WebAssembly `pdf-lib` execution: `validatePdf`, `mergePdfs`, `splitPdf`, `compressPdf`)
2. `apps/web/src/app/core/services/pdf-to-word.service.ts` (`convertPdfToWord`, backend API FormData orchestration)
3. `apps/web/src/app/core/services/pdf-to-powerpoint.service.ts` (`convertPdfToPowerPoint`, backend API FormData orchestration)
4. `apps/web/src/app/core/services/tool-registry.service.ts` (Tool repository lookups)
5. `apps/web/src/app/core/services/consent.service.ts` (Cookie and GDPR state persistence)
6. `apps/web/src/app/core/services/contact.service.ts` (Contact form API dispatch)
7. `apps/web/src/app/core/services/layout.service.ts` (Header/footer state signaling)
8. `apps/web/src/app/core/utils/split-range-parser.ts` (Page range tokenizer and math parser)

### 3.3 Component Logic Invariants (Preserve All Signatures & Bindings)
When restyling the HTML templates of:
- `apps/web/src/app/pages/merge-pdf/merge-pdf.component.ts`
- `apps/web/src/app/pages/tool-placeholder/tool-placeholder.component.ts`
- `apps/web/src/app/pages/pdf-to-word/pdf-to-word.component.ts`
- `apps/web/src/app/pages/pdf-to-powerpoint/pdf-to-powerpoint.component.ts`
- `apps/web/src/app/shared/components/result-view/result-view.component.ts`

**Strict Invariant:** Do not alter any signal definitions, methods (`executeMerge`, `executeSplit`, `executeCompress`, `executeConvert`, `resetWorkspace`, `onFilesAdded`, `onRemoveFile`, `onMoveUp`, `onMoveDown`), event outputs, or conditional branches.

---

## 4. DOM Hooks & Test Selectors to Preserve

The following CSS classes, DOM attributes, IDs, and element references are asserted in unit tests and feature operations. They **must be retained** during template re-skinning:

### Result View Component (`ResultViewComponent`)
- `.preview-pill-btn` (Quick preview toggle button)
- `.preview-title` (Preview drawer title header)
- `.docx-preview-banner` (Word layout preview banner)
- `.preview-direct-download-btn` (Direct download link within preview)
- `.preview-embed-frame` (`<iframe>` rendering PDF or DOCX preview)
- `.size-transition-pill` (Displays `Original Size → Compressed Size`)
- `.savings-progress-track[role="progressbar"]` (Space-saved progress track)
- `.low-savings-callout[role="alert"]` (Diagnosis explanation callout when savings < 5%)
- `a.download-btn` (Main download anchor with `[href]` and `[download]` attributes)

### Processing State Component (`ProcessingStateComponent`)
- `.processing-title` (Heading indicating active task)
- `.circular-spinner-svg` (Spinner graphic)
- `.spinner-track` (Static spinner track)
- `.spinner-arc` (Animated SVG arc)

### App Shell & Informational Pages
- `app-header` (Top app bar component selector)
- `main.app-main` (Semantic main landmark element)
- `app-footer` (Footer component selector)
- `.hero-headline` (About Us hero headline element)
- `.commitment-card` (About Us cards)
- `.contact-title` (Contact Us title)
- `.success-title` (Contact form submission confirmation)

### Form & File Input Hooks
- `#fileInput` / `(change)="onFileInputChange($event)"`
- `(filesSelected)="onFilesAdded($event)"` on dropzone
- Google Drive trigger: `(click)="openGoogleDrive($event)"`
- Dropbox trigger: `(click)="openDropbox($event)"`
- Start over trigger: `(reset)="resetWorkspace()"` / `(click)="resetWorkspace()"`

---

## 5. Current Validation Behavior of the Five Tools

### Tool 1: Merge PDF (`/merge-pdf`)
- **File Acceptance:** `.pdf,application/pdf` only. Reject non-PDFs, corrupt PDFs, or encrypted PDFs via `BrowserPdfService.validatePdf`.
- **File Quantity:** Minimum 2 valid PDF documents (`validFiles.length >= 2`).
- **Validation Messages:** If `< 2` files, sets `errorMessage = "Please select at least 2 valid PDF documents to merge."`. Action button is physically `[disabled]` and styled with `.btn-disabled`.
- **Card Sequencing:** Reordering via HTML5 drag-and-drop or up/down arrow buttons updates index sequence synchronously.
- **Clear State:** Removing all cards transitions workspace back to `upload` state and restores footer visibility via `LayoutService`.

### Tool 2: Split PDF (`/split-pdf`)
- **File Acceptance:** Single PDF document (`maxFiles: 1`).
- **Range Mode -> Custom:**
  - Validates array of `{ from, to }` ranges against `totalPages`.
  - `from` must be an integer $\ge 1$ and $\le totalPages$.
  - `to` must be an integer $\ge 1$, $\le totalPages$, and $\ge from$.
  - Empty, NaN, negative, decimal, or inverted values trigger inline errors and block submission.
- **Range Mode -> Fixed:**
  - Splits document into uniform chunks of $N$ pages ($1 \le N \le totalPages$).
- **Pages Mode:**
  - `extract_all`: Extracts every page into individual single-page documents.
  - `select_pages`: Evaluates comma-separated page ranges (e.g. `1, 3-5, 8`) using `parsePageRange(input, totalPages)`. Trims whitespace, deduplicates page indices, rejects invalid syntax.
- **Merge Option:** `mergeExtractedPages` checkbox toggles merging extracted subsets into a single output PDF.

### Tool 3: Compress PDF (`/compress-pdf`)
- **File Acceptance:** 1 to 20 PDF files.
- **Profile Selection:** `extreme` (85 DPI, Q45, 4:2:0), `recommended` (144 DPI, Q70, 4:2:0), `less` (240 DPI, Q85, 4:4:4).
- **Never-Larger Invariant:** If output bytes exceed input bytes, engine discards output and returns the untouched original buffer with a diagnostic `savingsReason`.
- **Low Savings Notice:** If reduction $< 5\%$, displays a diagnostic alert explaining the document characteristics (e.g. text-only, pre-optimized).

### Tool 4: PDF to Word (`/pdf-to-word`)
- **File Acceptance:** Single PDF file.
- **Conversion Modes:** Standard layout reconstruction (`no_ocr`) vs OCR scan reconstruction (`ocr`).
- **Processing States:** Ephemeral upload, server-side layout extraction, and client-side DOCX iframe preview with direct download.
- **Security & Error Handling:** Encrypted files rejected with clear advice; server errors allow single-click retry without re-uploading.

### Tool 5: PDF to PowerPoint (`/pdf-to-powerpoint`)
- **File Acceptance:** Single PDF file.
- **Conversion Modes:** Editable shapes & text (`no_ocr`) vs High-Res Slide Scan (`ocr`).
- **Slide Dimensions:** 16:9 Widescreen (default) or 4:3 Standard format.
- **Processing States:** Ephemeral upload, layout analysis, vector box generation, and slide preview with direct download.

---

## 6. Old Brand References & Legacy Visual Artifacts

### 6.1 Legacy Brand Strings Identified
- `"PDF flow"` / `"PDFflow"`: Found in 27 files (page titles, meta descriptions, footer copyright, Open Graph tags, JSON-LD, legal policies, whitepaper, about us).
- `"PDF&Doc"` / `"I❤️PDF&Doc"`: Found in `apps/web/src/app/pages/terms-and-conditions/`, `press-media-kit/`, and header SVG logo.
- `"ilovepdf"`: Found in CSS class comments in `dropzone.component.css` and `tool-placeholder.component.css`.
- Domain references: `https://pdfflow.app` across `index.html`, canonical tags, and structured data.
- **Replacement Rule:** Replace all brand names with **PDFTailor** (strict capitalization: capital P, D, F, T). Domain is lowercase **`pdftailor.in`**.

### 6.2 Old Brand Colors (Legacy "iLovePDF-like" Red Palette to Eliminate)
- Old Primary Red: `#e53238`, `#E53238`, `rgb(229, 50, 56)`, `#d02a30`
- Light Coral / Red Tints: `#fef2f2`, `#fee2e2`, `#fecaca`, `#dc2626`
- **Replacement Rule:** Replace with **"Ocean Workspace"** Design Tokens:
  - `--pt-navy`: `#14213D` (Structure, headings, dark surfaces)
  - `--pt-teal-700`: `#0F766E` (Primary actions, CTA buttons)
  - `--pt-teal-800`: `#0B5D57` (Hover/active states)
  - `--pt-teal-100`: `#CCEBE6` (Tints, selection rings)
  - `--pt-teal-50`: `#ECF7F5` (Subtle surfaces, icon tiles)
  - `--pt-ink`: `#0B1220` (Body text)
  - `--pt-muted`: `#475467` (Secondary text)
  - `--pt-outline`: `#D0D5DD` / `--pt-soft-outline`: `#E4E7EC`
  - Zero red brand elements across UI.

### 6.3 Old Asset Files to Replace
- `apps/web/public/Layered Document Heart Logo.png` (1.05 MB PNG — Violates Rule 5: No PNGs in UI)
- `apps/web/public/logo.png` (1.05 MB PNG — Violates Rule 5)
- `apps/web/public/pdf-flow-logo-primary.svg` (Old logo)
- `apps/web/public/pdf-flow-logo-white.svg` (Old white logo)
- `apps/web/public/pdf-flow-mark-coral.svg` (Old coral mark)
- `apps/web/public/favicon.ico` (Old favicon)

---

## 7. Tool Development Status & Menu Taxonomy

### 7.1 Developed & Fully Operational Tools (5 Tools)
1. **Merge PDF** (`/merge-pdf`)
2. **Split PDF** (`/split-pdf`)
3. **Compress PDF** (`/compress-pdf`)
4. **PDF to Word** (`/pdf-to-word`)
5. **PDF to PowerPoint** (`/pdf-to-powerpoint`)

### 7.2 Canonical Menu Categories & Non-Developed Tool Badging
Per Master Prompt Section 7.5, the mega menu and tools grid must present these canonical entries. Tools not in the developed list receive a **"Soon"** badge and a graceful non-navigating disabled state:

- **Organize PDF:**
  - Merge PDF (Active)
  - Split PDF (Active)
  - Remove pages (*Soon*)
  - Extract pages (*Soon*)
  - Organize PDF (*Soon*)
  - Scan to PDF (*Soon*)
- **Optimize PDF:**
  - Compress PDF (Active)
  - Repair PDF (*Soon*)
  - OCR PDF (*Soon*)
- **Convert to PDF:**
  - JPG to PDF (*Soon*)
  - Word to PDF (*Soon*)
  - PowerPoint to PDF (*Soon*)
  - Excel to PDF (*Soon*)
  - HTML to PDF (*Soon*)
- **Convert from PDF:**
  - PDF to JPG (*Soon*)
  - PDF to Word (Active)
  - PDF to PowerPoint (Active)
  - PDF to Excel (*Soon*)
  - PDF to PDF/A (*Soon*)
- **Edit PDF:**
  - Rotate PDF (*Soon*)
  - Add page numbers (*Soon*)
  - Add watermark (*Soon*)
  - Crop PDF (*Soon*)
  - Edit PDF (*Soon*)
  - PDF Forms (*Soon*)
- **PDF Security:**
  - Unlock PDF (*Soon*)
  - Protect PDF (*Soon*)
  - Sign PDF (*Soon*)
  - Redact PDF (*Soon*)
  - Compare PDF (*Soon*)
- **PDF Intelligence:**
  - AI Summarizer (*Soon*)
  - Translate PDF (*Soon*)
  - PDF to Markdown (*Soon*)

---

## 8. Baseline Build & Test Metrics

Recorded prior to code changes:
- **Unit Test Suites:** 24 passed (13 in web, 11 in api)
- **Total Tests:** 148 passed (80 in web, 68 in api)
- **Snapshots:** 0
- **Compilation:** 100% successful with `@angular/build:application` and `tsc`.
- **Initial Production Bundle:** `main-2KD4VF7L.js` (2.04 MB raw, 492 kB transfer), `styles-EDN63JCX.css` (15.87 kB raw, 2.03 kB transfer).

---

## 9. Manual Smoke Checklist for the Five Tools

1. **Merge PDF (`/merge-pdf`)**:
   - [ ] Upload 2+ sample PDFs via file picker or drag-over.
   - [ ] Verify card thumbnails, reorder cards with up/down arrows or drag-and-drop.
   - [ ] Click "Merge PDF". Verify progress bar and transition to completed state.
   - [ ] Click "Download File". Verify combined PDF downloads and opens cleanly.
2. **Split PDF (`/split-pdf`)**:
   - [ ] Upload a multi-page PDF (e.g. 6-page contract).
   - [ ] Range Tab: enter Custom range `1 to 3`. Click "Split PDF". Verify ZIP or merged output downloads correctly.
   - [ ] Pages Tab: enter `1, 3, 5`. Verify extracted pages contain requested pages only.
3. **Compress PDF (`/compress-pdf`)**:
   - [ ] Upload a sample image-heavy brochure or presentation.
   - [ ] Select "Recommended" profile. Click "Compress PDF".
   - [ ] Verify size transition pill (`X MB → Y KB`), percentage saved progress bar, and download file.
4. **PDF to Word (`/pdf-to-word`)**:
   - [ ] Upload sample text-and-table PDF. Select "Editable Word".
   - [ ] Click "Convert to Word". Verify live DOCX layout preview renders inside iframe.
   - [ ] Click "Download Word". Verify valid `.docx` file downloads.
5. **PDF to PowerPoint (`/pdf-to-powerpoint`)**:
   - [ ] Upload sample PDF slide deck. Select "16:9 Widescreen".
   - [ ] Click "Convert to PowerPoint". Verify progress indicator and completion.
   - [ ] Download `.pptx` file and verify slides open in Microsoft PowerPoint / LibreOffice.

---

## 10. Implementation Plan & Execution Phases

- [x] **Phase 0: Audit & Baseline** (Complete — `docs/redesign/AUDIT.md` created, baseline recorded).
- [ ] **Phase 1: Brand Tokens, Typography, Logo & Theme**
  - Install `@angular/material` and configure Material 3 theming with "Ocean Workspace" tokens.
  - Self-host fonts (Sora 600/700, Inter 400/500/600) as woff2 in `apps/web/public/fonts/`.
  - Hand-code SVG geometric tailored document logo variants (full lockup, icon only, white mono).
  - Update `index.html` (SEO, OG tags, JSON-LD, SVG favicon, theme-color `#14213D`).
- [ ] **Phase 2: Global Shell Redesign**
  - Rebuild sticky app bar (`HeaderComponent`) with clean typography, teal action CTAs, and active route indicators.
  - Build full-width `MegaMenuComponent` with Lucide category icons and "Soon" badges.
  - Rebuild `FooterComponent` with 5-column layout, mobile accordions, dark navy `#14213D` styling, dynamic year, and social brand icons.
- [ ] **Phase 3: Shared "pt" UI Kit**
  - Create presentational components: `PtPageShell`, `PtSectionHeader`, `PtToolCard`, `PtUploadDropzone`, `PtWorkspaceLayout`, `PtStepList`, `PtFaqAccordion`, `PtAdSlot`, `PtBadge`.
- [ ] **Phase 4: Home Page Redesign**
  - Modern hero with fluid Sora typography and category filter pills.
  - 4-column responsive tool grid with Lucide icons on `pt-teal-50` tiles and "Soon" badges.
  - Redesign Roadmap section with clean line illustrations.
  - Redesign Premium panel and verified Trust section.
- [ ] **Phase 5: Tool Landing Template**
  - Apply unified template across tool landing pages: H1, dropzone with drag-over state, `PtAdSlot` (zero CLS, invisible until loaded), 4 feature highlights, horizontal/vertical stepper, FAQ accordion, related tools.
- [ ] **Phase 6: Workspace Shell (`PtWorkspaceLayout`)**
  - Apply clean desktop left canvas / fixed right panel layout across the 5 developed tools.
  - Style idle, loaded, processing, and success result states with Lucide icons.
- [ ] **Phase 7: Remaining Pages & Legal Views**
  - Restyle About, Contact, Privacy, Terms, GDPR, Security, Cookies, Press, and 404 page.
- [ ] **Phase 8: GSAP Motion Integration**
  - Install `gsap` and build centralized animation service guarded by `prefers-reduced-motion` and Angular context lifecycle.
- [ ] **Phase 9: QA, Validation Matrix, Spellcheck & Lighthouse**
  - Run full test suite, spellcheck (`cspell`), cross-browser checks, and accessibility contrast verification.
- [ ] **Phase 10: Final Pull Request into `dev`**
  - Create `docs/redesign/` supplementary documentation (`STYLEGUIDE.md`, `DECISIONS.md`, `ISSUES_FOUND.md`, `CONTENT_TO_CONFIRM.md`, `QA_MATRIX.md`).
  - Open PR into `dev` without merging.
