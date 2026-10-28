# Architecture & Design Decisions: PDFTailor Redesign

> **Project:** PDFTailor Brand & UI Redesign  
> **Target Domain:** [pdftailor.in](https://pdftailor.in)  
> **Branch:** `feature/complete-brand-redesign`

---

## Decision 1: Visual Identity & Color Palette (Ocean Workspace)

* **Context:** The original UI replicated iLovePDF's vibrant red (`#E53238`) and boxy, consumer-grade card aesthetic.
* **Decision:** Completely eliminate `#E53238` and adopt the **Ocean Workspace** visual identity:
  * Primary Navy (`#14213D`) and Deep Ink (`#0B1220`) for authoritative, enterprise-grade headers, dark hero accents, and footer shells.
  * Ocean Teal 700 (`#0F766E`) and Teal 800 (`#0B5D57`) for primary call-to-actions, progress indicators, and active states.
  * Warm Amber (`#D98E04`) for high-attention alerts, ratings, and workflow highlights.
* **Outcome:** Passes WCAG 2.2 AAA contrast standards for headings and AA for interactive elements, establishing a distinct, trustworthy brand identity.

---

## Decision 2: Zero Business Logic / Zero Backend Modifications

* **Context:** The platform contains 5 production-ready PDF manipulation tools (Merge PDF, Split PDF, Compress PDF, PDF to Word, PDF to PowerPoint) powered by client-side WebAssembly, PDF-lib, and backend microservices.
* **Decision:** Freeze all contracts (`packages/contracts`) and API services (`apps/api`). Do not alter data structures, file processing pipelines, WASM binaries, conversion algorithms, or route guards.
* **Outcome:** Zero regression risk across all PDF manipulation workflows. `git diff --stat dev packages/contracts apps/api` remains completely clean (0 files changed).

---

## Decision 3: Typography Strategy (Sora + Inter)

* **Context:** Browser default fonts or runtime Google CDN fonts introduce layout shifting, privacy leaks (user IP logging), and network latency.
* **Decision:** Self-host Sora (for modern geometric headlines) and Inter (for maximum legibility in dense tool interfaces and file metadata tables).
* **Outcome:** 100% GDPR/ePrivacy compliant font delivery with zero layout shifts and instant font rendering.

---

## Decision 4: Iconography & Vector Graphics

* **Context:** Raster graphics (PNG/JPG) degrade on high-DPI displays and increase initial bundle size.
* **Decision:** Adopt Lucide icons (`@lucide/angular`) combined with custom vector SVGs for all brandmarks, device mockups, and tool logos.
* **Outcome:** Resolution-independent rendering, smaller asset payloads, and programmatic SVG styling via CSS variables.

---

## Decision 5: GSAP Micro-Interactions & Reduced Motion Accessibility

* **Context:** Rich interactive animations enhance perceived performance, but unconstrained animations can cause motion sickness or memory leaks in single-page apps.
* **Decision:** Implement `AnimationService` wrapping GSAP with:
  * Strict `prefers-reduced-motion` detection.
  * Scoped lifecycle management via `gsap.context()` to ensure complete teardown when navigating between routes.
* **Outcome:** Elegant 60fps entrance animations on desktop while honoring accessibility standards and avoiding memory leaks.
