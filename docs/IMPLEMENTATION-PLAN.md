# PaperFlow Implementation Plan

## 1. Phased Roadmap

### Phase 1: Core Foundation & Milestone 1 (Target Now)
- [x] Monorepo workspace setup (`apps/web`, `apps/api`, `packages/contracts`).
- [x] Shared TypeScript contracts & tool registry.
- [x] Express API with TypeScript, security headers, CORS, Zod, and `/api/v1/health`.
- [x] Angular 19+ Application Shell with custom Tailwind/CSS design system.
- [x] Polished Homepage with Hero, Tool Categories, Tool Search, Privacy disclosure, and FAQs.
- [x] Browser PDF Engine integration using `pdf-lib` and `pdfjs-dist`.
- [x] Working **Merge PDF** tool with real drag-and-drop, reordering, validation, execution, and download.
- [x] SEO metadata, canonical links, robots, sitemap generator.
- [x] Automated tests and verification scripts.

### Phase 2: Core Browser PDF Tools Expansion
- Split PDF by page range or extract all pages.
- Rotate PDF pages (90°, 180°, 270°) with live thumbnail preview.
- Extract selected PDF pages into a new document.
- Remove unwanted PDF pages.
- Reorder pages with interactive visual canvas.
- Images to PDF (JPEG/PNG client conversion).

### Phase 3: Server-side Hybrid Tools
- PDF to Image conversion.
- PDF Compression worker with quality profiles (Extreme, Recommended, Low).
- Password protect & unlock.

### Phase 4: Office & Advanced Document Conversion
- Word/Excel/PPT to PDF.
- PDF to Word.
- OCR via local engine.

---

## 2. Milestone 1 Acceptance Criteria

1. Both Angular (`apps/web`) and Express API (`apps/api`) build cleanly with `npm run build` with zero TypeScript errors under strict mode.
2. `GET http://localhost:4000/api/v1/health` returns `200 OK` with JSON health metadata.
3. User can open `http://localhost:4200/`, browse all tools by category, search in real-time, and navigate to `/merge-pdf`.
4. User can upload 2 or more real PDF files, reorder them via drag-and-drop or reorder buttons, click **Merge PDFs**, observe real progress, and download a valid merged PDF.
5. Tool operates 100% in the client browser with zero server uploads for merge.
6. Automated unit/integration tests pass.
