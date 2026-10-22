# PaperFlow Architecture Specification

## 1. Executive Summary
**PaperFlow** is an open-source, production-grade PDF productivity platform built with a **hybrid processing architecture**. 

Key Architectural Principles:
1. **Local-First Privacy**: File operations that can be performed in the client (Merge, Split, Rotate, Extract, Reorder, Remove, Image-to-PDF) execute directly in the browser via WebAssembly/pure JavaScript (`pdf-lib`, `pdfjs-dist`). Files never leave the user's machine unless server execution is strictly required.
2. **Hybrid Execution Boundary**: Operations requiring native tooling or heavier compute (compression, OCR, complex format conversions) route to an isolated Node.js/TypeScript backend service.
3. **Budget & Zero-Cost Infrastructure**: ₹0 initial cost. No commercial APIs, no credit card-gated services, no mock APIs. Uses standard Node.js LTS, Angular, and open-source libraries.
4. **Modularity & Monorepo Structure**: Clear workspace boundaries separating frontend (`apps/web`), backend API (`apps/api`), and shared contracts (`packages/contracts`).

---

## 2. System Topology

```
+-------------------------------------------------------------------------+
|                               Client Browser                            |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                           Angular 19+ SPA                         |  |
|  |  +---------------------+  +-----------------+  +---------------+  |  |
|  |  |  SEO Landing Pages  |  |  Tool Registry  |  |  UI System    |  |  |
|  |  +---------------------+  +-----------------+  +---------------+  |  |
|  |                                                                   |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  |                 Hybrid Processing Router                    |  |  |
|  |  +-------------------------------------------------------------+  |  |
|  |             |                                       |             |  |
|  +-------------|---------------------------------------|-------------+  |
|                | (Browser Processing Mode)             |                |
|                v                                       |                |
|  +-----------------------------+                       |                |
|  |   Browser PDF Engine        |                       |                |
|  |   - pdf-lib (Merge, Split)  |                       |                |
|  |   - pdfjs-dist (Thumbnails) |                       |                |
|  |   - Canvas / JSZip          |                       |                |
|  +-----------------------------+                       |                |
+--------------------------------------------------------|----------------+
                                                         | (Server Mode)
                                                         v
+-------------------------------------------------------------------------+
|                               Server Infrastructure                     |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                   Node.js + Express + TypeScript API              |  |
|  |  +------------------+  +-------------------+  +----------------+  |  |
|  |  | /api/v1/health   |  | Rate Limiting     |  | Safe Uploads   |  |  |
|  |  | /api/v1/convert  |  | Centralized Error |  | Zod Validation |  |  |
|  |  +------------------+  +-------------------+  +----------------+  |  |
|  +-------------------------------------------------------------------+  |
|                                    |                                    |
|                                    v                                    |
|  +-------------------------------------------------------------------+  |
|  |                     Isolated Temporary Worker Area                |  |
|  |  - Ephemeral disk storage (/tmp/paperflow-*)                      |  |
|  |  - Auto-cleanup lifecycle (after completion / max 15 min ttl)     |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 3. Monorepo Organization

```text
d:\PDF-Tool/
├── apps/
│   ├── web/                    # Angular 19 Client (UI, Tool Workspaces, SEO)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/       # Registry, Navigation, Services
│   │   │   │   ├── shared/     # Dropzone, Reorder, FileList, Notifications
│   │   │   │   ├── features/   # Tool implementations (Merge, Split, etc.)
│   │   │   │   └── pages/      # Home, Legal, Tool Landing Pages
│   │   │   └── assets/
│   │   └── package.json
│   ├── api/                    # Node.js + TypeScript Express Backend
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   └── index.ts
│   │   └── package.json
│   └── worker/                 # Optional Server-side PDF worker (Phase 2+)
├── packages/
│   └── contracts/              # Shared Types, Tool Registry, API DTOs
│       ├── src/
│       │   ├── tools.ts
│       │   ├── api.ts
│       │   └── index.ts
│       └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── AGENT-OWNERSHIP.md
│   ├── API-CONTRACT.md
│   ├── IMPLEMENTATION-PLAN.md
│   ├── UI-RESEARCH.md
│   └── DEPLOYMENT.md
├── package.json                # Root package.json with workspaces
└── README.md
```

---

## 4. Processing Mode Decision Matrix

| Tool | Processing Engine | Justification |
| :--- | :--- | :--- |
| **Merge PDF** | Browser (`pdf-lib`) | Fast, zero server latency, 100% private |
| **Split PDF** | Browser (`pdf-lib`) | Instant client-side page range splitting |
| **Rotate PDF** | Browser (`pdf-lib`) | Lossless rotation via PDF page metadata |
| **Extract Pages** | Browser (`pdf-lib`) | High performance client extraction |
| **Remove Pages** | Browser (`pdf-lib`) | Instant page removal without uploading |
| **Reorder Pages**| Browser (`pdf-lib`) | Visual drag-and-drop with client assembly |
| **Images to PDF**| Browser (`pdf-lib`, Canvas) | Pure client-side image encoding |
| **PDF to JPG** | Browser (`pdfjs-dist`, Canvas) | Direct canvas rendering to JPEG/PNG |
| **Compress PDF** | Hybrid / Server | Light client compression / heavy Ghostscript on server |
| **Protect / Unlock** | Browser (`pdf-lib`) | Client-side encryption where standard |
| **OCR PDF** | Server Worker | Requires Tesseract / OCRmyPDF binary dependencies |

---

## 5. Security & Privacy Guarantees

1. **Client-First Protection**: If a tool is marked `processingMode: 'browser'`, file buffers never traverse the network.
2. **Server Upload Security**:
   - Random internal UUIDs for temporary files (no user-provided filename on disk).
   - Strict file mime-type checking via magic bytes (`%PDF-`), not trusting client headers.
   - Strict file-size limits (50 MB default).
   - Explicit cleanup middleware in `finally` blocks and scheduled TTL sweeping.
3. **Safe Process Execution**:
   - Zero unsanitized `exec()` or string interpolation into shell commands.
   - Fixed argument arrays via `execFile` with strict timeouts.
