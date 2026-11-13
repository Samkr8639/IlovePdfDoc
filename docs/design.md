# PDFTailor Design & Layout Specification (`docs/design.md`)

**Status:** Authoritative Single Source of Truth  
**Baseline Commit:** `0d14632` (`dev` branch)  
**Verified Date:** 2026-11-11  
**Stack:** Angular 22.2 (standalone components + signals, `@if`/`@for`), Angular Material 22.2.4 (`azure-blue.css`), GSAP 3.15, inline Lucide-geometry SVGs, custom CSS design tokens in `apps/web/src/styles.css` (no Tailwind CSS).

---

## Table of Contents

1. [Purpose and Rules](#1-purpose-and-rules)
2. [Brand and Tokens](#2-brand-and-tokens)
3. [App Shell](#3-app-shell)
4. [Page Templates](#4-page-templates)
5. [Component Catalogue](#5-component-catalogue)
6. [Behaviour Patterns](#6-behaviour-patterns)
7. [Responsive Rules](#7-responsive-rules)
8. [Accessibility Rules Actually Applied](#8-accessibility-rules-actually-applied)
9. [Motion and Icons](#9-motion-and-icons)
10. [Copy and Voice Guide](#10-copy-and-voice-guide)
11. [How to Add a New Tool (Checklist)](#11-how-to-add-a-new-tool-checklist)
12. [Inconsistencies Found](#12-inconsistencies-found)
13. [Do and Don't + Glossary](#13-do-and-dont--glossary)
14. [Appendix](#14-appendix)

---

## 1. Purpose and Rules

1. **Authoritative source:** `docs/design.md` is the single source of truth for PDFTailor UI, layout, tokens, copy conventions, and interaction patterns.
2. **Read before coding:** Every human engineer or AI agent must read this document completely before building or modifying any page, component, or stylesheet in `apps/web`.
3. **Strict fidelity:** Reproduce the canonical layouts, CSS custom properties (`--pt-*`), typography (`Sora` + `Inter`), radii, shadows, stroke icons, and shared components exactly. Never invent new visual systems, color schemes, button styles, or page shells.
4. **No hard-coded values outside tokens:** Never hard-code hex colors, font families, border radii, or shadows that have `--pt-*` tokens defined in [`apps/web/src/styles.css`](../apps/web/src/styles.css). Never re-introduce legacy brand names (`PaperFlow`, `PDF flow`).
5. **Stop and ask:** If a new tool or feature genuinely needs a UI pattern not documented here, **do not build or invent it**. Stop, add a **"Proposed additions"** section to the PR description (what is needed, why existing patterns cannot satisfy it, and a short ASCII/text mock), and wait for explicit approval.

---

## 2. Brand and Tokens

### 2.1 Token Definition Source

All global CSS custom properties live in `:root` inside [`apps/web/src/styles.css`](../apps/web/src/styles.css#L26-L91). `@import '@angular/material/prebuilt-themes/azure-blue.css';` is loaded at line 1 of the same file. Browser `<meta name="theme-color" content="#14213D">` is set in [`apps/web/src/index.html`](../apps/web/src/index.html).

**Dark Mode:** **Not supported.** Neither `styles.css` nor any component implements `@media (prefers-color-scheme: dark)` or a dark theme class. All surfaces remain light-mode Ocean Workspace except the footer and promotional dark banner.

### 2.2 Colour Palette & WCAG Contrast

All values verified from [`apps/web/src/styles.css`](../apps/web/src/styles.css#L33-L73); contrast ratios calculated against their real pairing backgrounds.

#### Brand, Action & Semantic Colours

| Token | Value | Primary Usage | Typical Pairing (FG / BG) | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| `--pt-navy` | `#14213D` | Primary headings, active nav, footer bg, bottom editor bar | `#14213D` on `#FFFFFF` / `#F6F8FA` | `15.97:1` / `15.00:1` |
| `--pt-navy-hover` | `#1d2e54` | Dark CTA / pill hover background | `#FFFFFF` on `#1d2e54` | `Unverified` (high AAA) |
| `--pt-navy-deep` | `#0D1629` | Footer bottom bar, modal backdrop (`rgba(13,22,41,0.65)`) | `#94A3B8` on `#0D1629` | `7.04:1` |
| `--pt-teal-700` | `#0F766E` | Primary CTA fill, active borders, badges, focus rings, links | `#FFFFFF` on `#0F766E` | `5.47:1` |
| `--pt-teal-800` | `#0B5D57` | Primary CTA hover fill, dark teal badge text on `--pt-teal-100` | `#FFFFFF` on `#0B5D57` | `7.73:1` |
| `--pt-teal-600` | `#14B8A6` | Bright accent border/icon/gradient stop on dark surfaces | `#14B8A6` on `#14213D` (`#FFFFFF`: `2.49:1` — decorative/large only) | `6.42:1` on navy |
| `--pt-teal-100` | `#CCEBE6` | Icon tile bg (live cards), selected focus ring border | `--pt-teal-800` (`#0B5D57`) on `#CCEBE6` | `6.11:1` |
| `--pt-teal-50` | `#E6F5F3` | Icon tile bg, selected radio/tile bg, privacy callout bg | `--pt-teal-700` (`#0F766E`) on `#E6F5F3` | `4.88:1` |
| `--pt-blue-focus` | `#2563eb` | Input focus highlight (legacy forms) | `#2563eb` on `#FFFFFF` | `5.17:1` |
| `--pt-blue-hover` | `#1d4ed8` | Blue hover state | `Unverified` | `Unverified` |
| `--pt-coral` | `#E05D44` | Delete hover text, error icon/text accent | `#E05D44` on `#FDF3F1` (`3.31:1` — fails AA small text; prefer `--pt-coral-hover`) | `3.61:1` on white |
| `--pt-coral-hover` | `#C54E37` | Darker error text / border | `#C54E37` on `#FDF3F1` | `4.26:1` |
| `--pt-coral-subtle` | `#FDF3F1` | Error banner background, delete hover fill | `—` | `—` |
| `--pt-amber` | `#D97706` | Warnings, Pro/OCR highlight (`edit-pdf`, `home` badges) | `#D97706` on `#FFFFFF` | `3.19:1` (large/icon only) |
| `--pt-emerald` | `#059669` | Success check accents, savings pill text (`#ecfdf5` bg) | `#059669` on `#FFFFFF` | `3.77:1` (large/icon only) |

#### Neutrals & Surfaces

| Token | Value | Primary Usage | Contrast on `#FFFFFF` | Contrast on `#F6F8FA` |
| :--- | :--- | :--- | :--- | :--- |
| `--pt-surface-white` | `#FFFFFF` | Cards, sidebars, top bar, result showcase | `—` | `—` |
| `--pt-canvas-pure` | `#FFFFFF` | Dropzone bg, PDF paper canvas | `—` | `—` |
| `--pt-subtle-bg` | `#F6F8FA` | Tool workspace bg, upload hero bg, ad slot bg | `—` | `—` |
| `--pt-subtle-bg-alt` | `#F1F4F8` | Secondary muted chip/button bg | `—` | `—` |
| `--pt-card-bg` | `#FFFFFF` | Tool cards, FAQ cards, modal cards | `—` | `—` |
| `--pt-soft-outline` | `#E4E7EC` | Hairline borders, card borders, sidebar dividers | `—` | `—` |
| `--pt-outline` | `#D0D5DD` | Inputs, dashed ad boxes, disabled CTA fill | `—` | `—` |
| `--pt-outline-strong` | `#98A2B3` | Strong control borders | `—` | `—` |
| `--pt-text-headline` | `#111827` | Highest-contrast display text (alongside `--pt-navy`) | `17.74:1` | `—` |
| `--pt-text-body` | `#374151` | Standard body paragraphs | `10.31:1` | `9.68:1` |
| `--pt-muted` | `#4B5563` | Leads, descriptions, option labels | `7.56:1` | `7.10:1` |
| `--pt-muted-light` | `#667085` | Subtitles, metadata captions, ad labels | `4.97:1` | `4.67:1` |
| `--pt-ghost` | `#9CA3AF` | Placeholders, disabled icons (decorative only) | `2.54:1` | `—` |

#### Category Accents (`styles.css` L57–62)

| Token | Value | Category |
| :--- | :--- | :--- |
| `--pt-cat-organize` | `#D97706` | Organize PDF (`merge`, `split`, etc.) |
| `--pt-cat-convert` | `#0284C7` | Convert PDF (`pdf-to-word`, `word-to-pdf`, `pdf-to-jpg`, etc.) |
| `--pt-cat-optimize` | `#0F766E` | Optimize PDF (`compress-pdf`) |
| `--pt-cat-edit` | `#7C3AED` | Edit PDF |
| `--pt-cat-security` | `#DC2626` | PDF Security (`protect`, `unlock`) |
| `--pt-cat-intelligence` | `#4F46E5` | PDF Intelligence (AI tools) |

#### Implicit / Component-Fallback Colours (commonly used but missing from `:root`)

Several components reference tokens via fallback defaults (`var(--token, fallback)`). New code **must not add new undefined var names**; see [Section 12](#12-inconsistencies-found):
- Amber badges: `#FFFBEB` (bg), `#B45309` (text — `4.84:1` on `#FFFBEB`), `#FEF3C7` (border) in [`pt-badge.component.ts`](../apps/web/src/app/shared/components/pt-badge/pt-badge.component.ts#L46-L50).
- Success badges: `#F0FDF4` (bg), `#15803D` (text) in [`pt-badge.component.ts`](../apps/web/src/app/shared/components/pt-badge/pt-badge.component.ts#L52-L56).
- Info banner (`merge-pdf`, `tool-placeholder`): `#F0F9FF` (bg), `#BAE6FD` (border), `#0369A1` (text/icon).
- Error banner (`pdf-to-jpg`): `#FEF2F2` (bg), `#FECACA` (bottom border), `#B91C1C` (text/icon — darker accessible red).

---

### 2.3 Typography

- **Font Loading** ([`apps/web/src/styles.css#L7-L21`](../apps/web/src/styles.css#L7-L21), [`apps/web/src/index.html`](../apps/web/src/index.html)):
  - Self-hosted variable WOFF2 preloaded in `<head>`:
    - `'Sora'` (`font-weight: 100 800`, `font-display: optional`, `/fonts/sora-latin.woff2`)
    - `'Inter'` (`font-weight: 100 900`, `font-display: optional`, `/fonts/inter-latin.woff2`)
  - Signature-only Google Fonts CDN loaded in `index.html` (`edit-pdf` cursive signature tool only): `'Caveat'`, `'Dancing Script'`, `'Great Vibes'`, `'Sacramento'`.
- **Font Family Tokens** ([`styles.css#L30-L31`](../apps/web/src/styles.css#L30-L31)):
  - `--pt-font-heading`: `'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - `--pt-font-body`: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Important UA Reset Note (Measured in Running App):** Raw `<button>` elements without explicit `font-family: var(--pt-font-body)` or `inherit` fall back to `Arial` on macOS Chrome (observed on `.dock-square-btn`, `.prime-action-btn`, `.tool-tile`, `.btn-save-download`). Always set `font-family: var(--pt-font-body);` or `var(--pt-font-heading);` on buttons.

#### Observed Typography Scale (Code + Running App)

| Role | Family | Size | Weight | Line Height | Letter Spacing | Source / Measured |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Home Display H1 | `--pt-font-heading` (`Sora`) | `clamp(38px, 4.5vw, 62px)` | `800` | `1.12` (`69.4px` at 1440px) | `-0.03em` | `home.component.css`, measured `62px` |
| Tool Upload H1 (Canonical) | `--pt-font-heading` (`Sora`) | `50px` (`merge-pdf`) / `48px` (`pdf-to-jpg`) / `clamp(28px, 4vw, 44px)` | `800` | `1.15` (`57.5px` / `55.2px`) | `-0.025em` | Measured running app |
| Processing H2 | `--pt-font-heading` (`Sora`) | `32px` (desktop), `24px` (`<=640px`) | `700` | `1.25` | `-0.02em` | `processing-state.component.css`, measured `32px` |
| Result H1 | `--pt-font-heading` (`Sora`) | `clamp(26px, 3.5vw, 36px)` | `800` | `1.25` | `-0.025em` | `result-view.component.css`, measured `36px` |
| Editorial / Section H2 | `--pt-font-heading` (`Sora`) | `clamp(26px, 3.5vw, 38px)` to `40px` | `700`–`800` | `1.25` | `-0.02em` | `pt-section-header.component.ts`, `styles.css#L218` |
| Workspace Sidebar Heading | `--pt-font-heading` (`Sora`) | `20px` (`pdf-to-jpg`) – `26px` (`tool-placeholder`), canonical `22px` (`merge-pdf`) | `800` | `1.25` | `-0.02em` | Measured `22px` (`merge-pdf`), CSS `20px`/`24px`/`26px` |
| Primary CTA Label | `--pt-font-heading` (`Sora`) | `19px` (`merge-pdf`), `18px` (`convert`), `17px` (`split`) | `700` | `1` | `-0.01em` | Measured `19px` / `17px` |
| Card / Step Title (H3/H4) | `--pt-font-heading` (`Sora`) | `16px`–`18px` | `700` | `1.35`–`1.4` | `-0.01em` | `pt-step-list`, `home` |
| Page Lead / Subtitle | `--pt-font-body` (`Inter`) | `16px`–`18px` (Upload `17px`, Result `15.5px`) | `400` | `1.5`–`1.6` | `normal` | `home` measured `16px / 25.6px` |
| Body Text | `--pt-font-body` (`Inter`) | `14px`–`16px` (`15px` prose) | `400` | `1.6`–`1.7` | `normal` | `styles.css` `.editorial-prose` |
| Nav Link | `--pt-font-body` (`Inter`) | `14px` | `550` (`500`–`600`) | `normal` | `normal` | Measured `14px w550` |
| Sidebar Option Section Label | `--pt-font-body` (`Inter`) | `11px`–`12px` uppercase | `700`–`800` | `1.2` | `0.06em` | `pdf-to-jpg`, `edit-pdf` (`0.71875rem`) |
| Micro Badge / Count / Ad Label | `--pt-font-body` (`Inter`) | `10px`–`12px` | `600`–`700` | `1`–`1.2` | `0.02em`–`0.08em` | `pt-badge`, `pt-ad-slot` |

---

### 2.4 Spacing, Radii, Shadows, Z-Index, Breakpoints & Containers

No `--pt-space-*` tokens exist in `:root`. Spacing follows an empirical **4px / 8px rhythm**:

- **Common spacing values:** `4px`, `6px`, `8px`, `10px`, `12px`, `14px`, `16px`, `20px`, `24px`, `28px`, `32px`, `36px`, `40px`, `48px`, `64px`, `80px`.
- **Border Radii (`styles.css#L65-L71`):**
  - `--pt-radius-xs`: `4px` (tiny badges, arrow pills)
  - `--pt-radius-sm`: `8px` (inputs, info banners, compact buttons, PDF file cards)
  - `--pt-radius-md`: `12px` (option cards, nav links, primary buttons, tool tiles, feature badges)
  - `--pt-radius-lg`: `16px` (tool cards, feature cards, consent modal)
  - `--pt-radius-xl`: `20px` (mega-menu pane, result showcase card, dropzone secondary box)
  - `--pt-radius-2xl`: `24px` (canonical hero dropzone `.dropzone-box`)
  - `--pt-radius-pill`: `9999px` (header search, category filter bar, badges, floating mobile dock, bottom editor bar)

- **Shadows (`styles.css#L74-L80`):**
  - `--pt-shadow-sm`: `0 1px 2px 0 rgba(11, 18, 32, 0.05)`
  - `--pt-shadow-md`: `0 4px 6px -1px rgba(11, 18, 32, 0.07), 0 2px 4px -2px rgba(11, 18, 32, 0.04)`
  - `--pt-shadow-lg`: `0 10px 15px -3px rgba(11, 18, 32, 0.08), 0 4px 6px -4px rgba(11, 18, 32, 0.03)`
  - `--pt-shadow-xl`: `0 20px 25px -5px rgba(11, 18, 32, 0.08), 0 8px 10px -6px rgba(11, 18, 32, 0.03)`
  - `--pt-shadow-card`: `0 1px 3px rgba(11, 18, 32, 0.04), 0 6px 16px -4px rgba(11, 18, 32, 0.06)`
  - `--pt-shadow-card-hover`: `0 12px 28px -6px rgba(15, 118, 110, 0.12), 0 4px 10px -2px rgba(11, 18, 32, 0.04)`
  - `--pt-shadow-float`: `0 24px 48px -12px rgba(11, 18, 32, 0.18)`

- **Container Widths (`styles.css#L170-L195` & `header.component.css`):**
  - Header inner `.header-inner`: `max-width: 1760px` (`<=1440px`: `max-width: 1400px; padding: 0 32px`)
  - `.container-wide`: `max-width: 1560px; margin: 0 auto; padding: 0 24px` (home tool grid)
  - `.container`: `max-width: 1360px; margin: 0 auto; padding: 0 24px` (`<=768px`: `padding: 0 16px`)
  - `.container-narrow`: `max-width: 960px; margin: 0 auto; padding: 0 24px` (editorial/upload focus)
  - Result showcase `.result-experience`: `max-width: 980px`

- **Z-Index Scale (Verified across `apps/web/src/`):**
  - `1`–`5`: Background SVG/aurora layers, default canvas overlays, sticky sidebar (`z-index: 5`)
  - `10`–`25`: Panels (`.right-properties-sidebar`, `.left-thumbnails-panel`), `.floating-tools-dock` (`25`), `.bottom-floating-bar` (`25`–`50`)
  - `30`–`45`: `.mobile-convert-bar` (`30`), `.mobile-gear-btn` (`35`), `.mobile-panel-backdrop` (`40`), selection handles (`45`)
  - `50`–`60`: Mobile slide-over drawer (`.sidebar-action-panel.panel-open`), `edit-pdf` `.top-toolbar-strip` (`60`), overlays (`75`)
  - `100`: Header mega menu (`mega-menu-pane`)
  - `999`: Back-to-top button (`.global-back-to-top`)
  - `1000`–`1200`: Fixed Header (`.header` `1000`), Search Dropdown (`.search-dropdown-panel` `1050`–`1200`)
  - `2000`–`9999`: Modals (`home` workflow modal `2000`, `<app-upload-consent-dialog>` `.consent-backdrop` `9999`)
  - `99999`: Keyboard `.skip-link:focus` (`styles.css#L122`)

- **Breakpoints (Desktop-first CSS `@media (max-width: ...)` plus min-width Home grid):**
  - `>=1960px`: Home tools grid 6 columns
  - `>=1560px`: Home tools grid 5 columns
  - `1440px`: Default desktop baseline (`.header-inner` tightens to `1400px`)
  - `<=1320px`: Header mega-menu switches `6` -> `3` columns
  - `<=1200px`: Home hero floating parallax cards hidden (`hero-float-card`)
  - `<=1024px`: Tablet breakpoint — Header switches from full nav to hamburger (`header` height `68px` -> `60px`), 4-col grids drop to `2` or `1` col, tool sidebars narrow (`380px` -> `320px`, `edit-pdf` left `90px` / right `300px`)
  - `<=900px`: Result "Continue with your document" grid `3` -> `2` cols
  - `<=768px`: Mobile workspace breakpoint — `.organize-workspace-screen` switches row -> column; sidebar converts to slide-over drawer + `.mobile-gear-btn` + pinned `.mobile-convert-bar`; footer columns collapse into accordions; `.container` pad `24px` -> `16px`
  - `<=640px`: Mobile small — Header padding `0 12px`, logo `25px`, search dropdown fixed full-width, dropzone compact padding, `result-view` 1-col grid
  - `<=480px`: Editor top-nav Undo/Redo labels hidden (icon-only), mode tab padding compressed
  - `<=380px`: Header ultra-narrow (`padding: 0 8px`, logo `22px`)

---

## 3. App Shell

Root layout defined in [`apps/web/src/app/app.component.html`](../apps/web/src/app/app.component.html) and [`apps/web/src/app/app.component.css`](../apps/web/src/app/app.component.css):

1. **Skip Link:** `<a href="#main-content" class="skip-link">Skip to main content</a>` (`z-index: 99999`).
2. **Global Header (`<app-header>`):**
   - `position: fixed; top: 0; left: 0; right: 0; z-index: 1000`.
   - Height: **`68px`** desktop (`<=1024px`: **`60px`**). Note: `--header-height: 68px`, `--header-height-mobile: 56px` in `styles.css`, while `header.component.css#L833` sets `60px` at `<=1024px`.
   - Backdrop: `rgba(255, 255, 255, 0.94)` with `backdrop-filter: blur(16px)`.
   - Left: Brand logo `/pdftailor-logo.svg` (`158×34px` measured at `1440px`, link to `/`).
   - Primary Nav (`>1024px`): `Merge PDF`, `Split PDF`, `Compress PDF`, `Convert PDF ▾` (2-column `540px` dropdown on hover/click), `All PDF Tools ▾` (`1336×371px` measured 6-column mega-menu pane `#mega-menu-pane` at `z-index: 100`).
   - Right (`search`): `.search-input-box` pill (`230px` -> `320px` focus, `38px` high, `border-radius: 9999px`) with `/` & `Cmd/Ctrl+K` shortcut hint pill (`.search-key-hint`, hidden `<=768px`) and `380px` dropdown listbox (`z-index: 1050`, `<=640px` full width). At `<=1024px`: hamburger `.mobile-toggle` opens `.mobile-drawer`.
3. **Main Content (`<main id="main-content" class="app-main">`):**
   - `padding-top: var(--header-height, 68px)` (`<=1024px` in `.workspace-active`: `60px`).
   - Workspace chrome lock: When `LayoutService.isFooterVisible()` is `false` (or `:has(.tool-page.organize-mode)` / `:has(.organize-workspace-screen)`), `.app-layout.workspace-active` locks viewport (`height: 100vh; overflow: hidden`) so canvas and sidebar scroll independently and `<app-footer>` + `<app-back-to-top>` are hidden.
4. **Global Footer (`<app-footer>`):**
   - Solid `--pt-navy` (`#14213D`) background, bottom copyright bar on `--pt-navy-deep` (`#0D1629`), measured height `444.8px` at `1440px`.
   - Top row: white logo (`140×30px`), tagline, two compliance badges (`Zero Server Retention`, `End-to-End TLS Encrypted`).
   - Desktop grid: **5 columns** (`PDF TOOLS`, `CONVERT TO PDF`, `CONVERT FROM PDF`, `COMPANY`, `LEGAL & PRIVACY`); `769px–1100px`: `3` columns; `<=768px`: interactive accordions.
   - Bottom bar: **26-language** 3-column dropup (`650px` panel desktop / bottom sheet mobile), copyright line, 4 social icon buttons (`X`, `LinkedIn`, `Facebook`, `Instagram`).
5. **Back-to-Top (`<app-back-to-top>`):**
   - Fixed `bottom: 28px; right: 28px; width: 46px; height: 46px` circle (`<=640px`: `42×42px`, `20px` inset), `z-index: 999`. Appears when `window.scrollY > 350`.
6. **Upload Consent Dialog (`<app-upload-consent-dialog>`):**
   - Rendered globally at app root (`z-index: 9999`), driven by `UploadConsentService`. Used before sending document bytes to any server/OCR endpoint.
7. **Ad Slot Placement & Sizes:**
   - Upload state: Leaderboard directly below hero dropzone — desktop **`728×90`** (max `970×90` in `<app-pt-ad-slot slotType="leaderboard">`), mobile `320×100` (min-height `60px`). Must sit inside a container with `min-height: 90px` + `.adsense-label` / `.ad-label` (`10px`, `#475569` or `#667085`, `ADVERTISEMENT`).
   - Organize sidebar: Rectangle **`300×250`** inside `.sidebar-ad-box` (`1px dashed #cbd5e1`, `#fafafa` / `#F6F8FA`).
   - Result state: Responsive Leaderboard **`728×90`** (`<app-result-view>` bottom card).
8. **Breadcrumbs & SEO:**
   - Tool pages and static pages do **not** render breadcrumb links above hero headings; navigation stays inside `<app-header>` and `<app-footer>`.
   - Every tool component calls `this.seo.setSeoData(tool.seo)` in `ngOnInit()` (via `SeoService`), setting `<title>`, `description`, `keywords`, OpenGraph, Twitter Card, and `<link rel="canonical">`.

---

## 4. Page Templates

### 4.1 Tool Page — Upload State

- **Canonical references:**
  - Multi-section editorial pattern: [`apps/web/src/app/pages/merge-pdf/merge-pdf.component.html`](../apps/web/src/app/pages/merge-pdf/merge-pdf.component.html#L1-L245) & [`tool-placeholder.component.html`](../apps/web/src/app/pages/tool-placeholder/tool-placeholder.component.html)
  - With hero ad: [`apps/web/src/app/pages/pdf-to-jpg/pdf-to-jpg.component.html#L59-L170`](../apps/web/src/app/pages/pdf-to-jpg/pdf-to-jpg.component.html#L59-L170)
- **Visual baselines:** [`merge-pdf-upload-1440.png`](design-assets/merge-pdf-upload-1440.png), [`pdf-to-jpg-upload-1440.png`](design-assets/pdf-to-jpg-upload-1440.png), [`merge-pdf-upload-1024.png`](design-assets/merge-pdf-upload-1024.png), [`merge-pdf-upload-390.png`](design-assets/merge-pdf-upload-390.png)

```text
+-------------------------------------------------------------------------+
| [Global Fixed Header: 68px desktop / 60px <=1024px]                     |
+-------------------------------------------------------------------------+
| [.global-error-banner (if error, sticky/top full-width #FEF2F2/#FDF3F1)]|
|                                                                         |
|  section.unified-hero-section (bg #F4F5F8 / --pt-subtle-bg, pad 52/32)  |
|   +-- <h1 class="tool-h1"> (Sora 50px/48px w800 --pt-navy)              |
|   +-- <p class="hero-subtitle"> (Inter 17px --pt-muted, max-w 680px)    |
|   +-- <app-dropzone> (max-w 960px, min-h 340px, r 24px, white)          |
|         [60x60 icon badge] -> [CTA 270x60px] + [Drive][Dropbox 60x60]   |
|         ["or drop files here"] -> [3 Trust Chips]                       |
+-------------------------------------------------------------------------+
|  section.adsense-section (white, border-top, Leaderboard 728x90 / 970)  |
+-------------------------------------------------------------------------+
|  section.features-section -> 4-col .features-grid (2-col <=1024, 1<=768)|
+-------------------------------------------------------------------------+
|  section.steps-section -> 3-col .steps-grid (01, 02, 03 cards)          |
+-------------------------------------------------------------------------+
|  section.faq-section -> stacked .faq-card-item (max-w 860px)            |
+-------------------------------------------------------------------------+
|  section.related-tools-section -> 4-col .related-tools-grid             |
+-------------------------------------------------------------------------+
| [app-footer: --pt-navy]                                                 |
+-------------------------------------------------------------------------+
```

- **Measurements (measured in running app at `1440×900`):**
  - `.unified-hero-section`: `padding: 52px 0 32px` (`min-height: 520px` in `styles.css#L384`)
  - `pdf-to-jpg` `.upload-hero-section`: `padding: 48px 0 64px`
  - `<app-dropzone>`: `.dropzone-box` `max-width: 960px`, `min-height: 340px`, `padding: 44px 32px 36px`, `border-radius: 24px`, `border: 1.5px dashed #CBD5E1`
  - `.btn-select-file`: `height: 60px; min-width: 270px; border-radius: 14px; background: var(--pt-teal-700)`

---

### 4.2 Tool Page — Organize / Workspace State

- **Canonical references:**
  - Multi-item reorderable grid workspace: [`merge-pdf.component.html#L247-L538`](../apps/web/src/app/pages/merge-pdf/merge-pdf.component.html#L247-L538) + [`merge-pdf.component.css#L200-L561`](../apps/web/src/app/pages/merge-pdf/merge-pdf.component.css#L250-L561)
  - Options-heavy page workspace (Split / Compress / PDF to JPG): [`pdf-to-jpg.component.html#L172-L711`](../apps/web/src/app/pages/pdf-to-jpg/pdf-to-jpg.component.html#L172-L711), [`tool-placeholder.component.html`](../apps/web/src/app/pages/tool-placeholder/tool-placeholder.component.html)
- **Visual baselines:** [`merge-pdf-organize-1440.png`](design-assets/merge-pdf-organize-1440.png), [`pdf-to-jpg-organize-1440.png`](design-assets/pdf-to-jpg-organize-1440.png), [`compress-pdf-organize-1440.png`](design-assets/compress-pdf-organize-1440.png), [`split-pdf-organize-1440.png`](design-assets/split-pdf-organize-1440.png), [`pdf-to-word-organize-1440.png`](design-assets/pdf-to-word-organize-1440.png), [`merge-pdf-organize-1024.png`](design-assets/merge-pdf-organize-1024.png), [`merge-pdf-organize-390.png`](design-assets/merge-pdf-organize-390.png), [`merge-pdf-mobile-drawer-390.png`](design-assets/merge-pdf-mobile-drawer-390.png)

```text
Desktop (>= 769px): Height = calc(100vh - 68px), Footer & BackToTop HIDDEN
+-----------------------------------------------------+-------------------+
| [Optional .global-error-banner at root above workspace]                 |
+-----------------------------------------------------+-------------------+
| .canvas-main-area (flex:1, bg #F6F8FA/#F4F5F8)       | aside.sidebar-    |
|   padding: 40px 80px 40px 40px  [+ dock top:36 r:20]|   action-panel    |
|                                                     |   w: 350px (merge)|
|   +------------+  +------------+    +------------+  |      380px (new)  |
|   | [PageCard] |  | [PageCard] |    | [+] badge  |  | +---------------+ |
|   |  180x250   |  |  180x250   |    | [Computer] |  | | h2 Title      | |
|   |  thumb +   |  |  thumb +   |    | [Drive]    |  | | (.option-sec) | |
|   |  name/meta |  |  name/meta |    | [Dropbox]  |  | | (.info-banner)| |
|   | [<  1  >]  |  | [<  2  >]  |    +------------+  | | [300x250 Ad]  | |
|   +------------+  +------------+    58x244px dock   | +---------------+ |
|                                                     | | .sidebar-footer |
|   (or PDF header pill + page thumbnail grid)        | | [Primary CTA] | |
+-----------------------------------------------------+-------------------+

Mobile (<= 768px): Flex column, sidebar off-canvas drawer (translateX(100%))
+----------------------------------------+
| [Header 60px]                          |
+----------------------------------------+
|                      [Gear FAB 46x46]  |
|        [Stacked / 2-col Cards]         |
|                                        |
|      [+ | Device | Drive | Dropbox]    | <-- horizontal pill dock
+----------------------------------------+
| [Fixed Bottom .mobile-convert-bar CTA] | <-- pinned above safe-area
+----------------------------------------+
```

- **Measurements (measured in running app at `1440×900`):**
  - `.organize-workspace-screen`: `1440×828px` (`merge-pdf`, `top: 72px` override) or `1440×832px` (`pdf-to-jpg`, `calc(100vh - 68px)`).
  - `.canvas-main-area`: `1090×828px` (`merge-pdf`), `padding: 40px 80px 40px 40px` (`right: 80px` leaves clearance for the `58px`-wide floating dock).
  - `.pdf-document-card` (`merge-pdf`): `180×250px`, `border-radius: 8px`, `padding: 12px 10px 10px`, `#ffffff`, reorder footer `< 1 >`.
  - `.floating-tools-dock` (`merge-pdf` / `pdf-to-jpg`): `58×244px` (`242px`), `border-radius: 28px`, `padding: 8px 6px 14px`, `top: 36px; right: 20px`. Top teal button `.dock-square-btn` is `46×46px` (`border-radius: 14px`, `#0F766E`) with top-right black count badge.
  - `.sidebar-action-panel`: `350px` (`merge-pdf`) or **`380px`** (`tool-placeholder`, `pdf-to-word`, `word-to-pdf`, `pdf-to-excel`, `excel-to-pdf`, `pdf-to-jpg` — `360px` in `<app-pt-workspace-layout>`). **New tools should standardize on `380px` desktop (`320px` at `<=1024px`).**
  - `.giant-merge-submit-btn` (`merge-pdf`): `height: 60px; border-radius: 12px; background: #0F766E; font-size: 19px`. `.btn-convert-action` (converters) & `.giant-action-submit-btn`: `56px`. `.prime-action-btn` (`pdf-to-jpg`): `48px` (computed `331×48px`).

---

### 4.3 Tool Page — Processing State & Result State

- **Canonical references:**
  - Processing: [`apps/web/src/app/shared/components/processing-state/`](../apps/web/src/app/shared/components/processing-state/processing-state.component.ts) (cancelable variant in `pdf-to-jpg.component.html#L716-L725`)
  - Result: [`apps/web/src/app/shared/components/result-view/`](../apps/web/src/app/shared/components/result-view/result-view.component.html) (multi-image gallery deviation in `pdf-to-jpg.component.html#L730-L972`)
- **Visual baselines:** [`shared-processing-state-1440.png`](design-assets/shared-processing-state-1440.png), [`merge-pdf-result-1440.png`](design-assets/merge-pdf-result-1440.png), [`compress-pdf-result-1440.png`](design-assets/compress-pdf-result-1440.png), [`merge-pdf-result-390.png`](design-assets/merge-pdf-result-390.png), [`pdf-to-jpg-result-1440.png`](design-assets/pdf-to-jpg-result-1440.png)

```text
PROCESSING STATE (<app-processing-state>)
+-------------------------------------------------------------------------+
|                    Converting PDF to WORD... (Sora 32px w700)           |
|                           (  [110px Teal Spinner]  )                    |
|                    [Optional Cancel Operation text button]               |
+-------------------------------------------------------------------------+

RESULT STATE (<app-result-view>, max-width 980px centered)
+-------------------------------------------------------------------------+
|                   ( ✓ ) 60x60 pulsing teal circle                       |
|                   H1 "PDFs Merged Successfully!" (36px)                 |
|                   Lead subtitle (15.5px --pt-muted)                     |
|  +-------------------------------------------------------------------+  |
|  | [Icon] filename.pdf • Size • Pages • Lock Badge | [Quick Preview] |  |
|  |        (optional savings bar + low-savings note)                  |  |
|  |-------------------------------------------------------------------|  |
|  |                [ ↓ Download <Tool> PDF ]  52px                    |  |
|  |         [Drive]  [Dropbox]  [Copy Link]  [Process Another File]   |  |
|  +-------------------------------------------------------------------+  |
|  +-------------------------------------------------------------------+  |
|  | [Shield] Zero Server Storage / Retention callout (--pt-teal-50)   |  |
|  +-------------------------------------------------------------------+  |
|  Continue with your document -> 3x2 .tools-showcase-grid (6 cards)      |
|  [Advertisement 728x90]                                                 |
|  Help us spread the word -> [X] [LinkedIn] [Facebook] [WhatsApp]        |
+-------------------------------------------------------------------------+
```

- **Note on Multi-Item Output (`pdf-to-jpg`):** Because `pdf-to-jpg` can produce dozens of JPGs plus a ZIP, it renders a custom gallery below the card (`.result-images-grid`, per-image selection checkboxes, individual download icon buttons, `Show more`). Future multi-file tools may adopt `<app-result-view>` extended slot OR follow `pdf-to-jpg`'s gallery pattern after approval.

---

### 4.4 Editor-Style Workspace (`edit-pdf`)

- **Canonical reference:** [`apps/web/src/app/pages/edit-pdf/edit-pdf.component.html`](../apps/web/src/app/pages/edit-pdf/edit-pdf.component.html) & [`edit-pdf.component.css`](../apps/web/src/app/pages/edit-pdf/edit-pdf.component.css)
- **Visual baselines:** [`edit-pdf-upload-1440.png`](design-assets/edit-pdf-upload-1440.png), [`edit-pdf-workspace-1440.png`](design-assets/edit-pdf-workspace-1440.png), [`edit-pdf-workspace-1024.png`](design-assets/edit-pdf-workspace-1024.png), [`edit-pdf-workspace-390.png`](design-assets/edit-pdf-workspace-390.png)

```text
[Header: 68px desktop / 60px <=1024px]
+-------------------------------------------------------------------------+
| .top-toolbar-strip (53px measured, border-bottom)                       |
|      [ Annotate | Edit Text ★ ] sliding pill   |   [ ↶ Undo | Redo ↷ ] |
+----------+--------------------------------------------+-----------------+
| .left-   | .canvas-viewport-wrapper (970px measured)  | .right-         |
| thumb-   |   background: --pt-subtle-bg (#F6F8FA)     |  properties-    |
| nails-   |   padding: 2.5rem 1.5rem 7rem              |  sidebar        |
| panel    |                                            |  w: 340px       |
| w: 130px |     +--------------------------------+     | +-------------+ |
| (44px    |     | [Page 1] badge                 |     | | H1 Edit PDF | |
| collap.) |     | .paper-canvas-container        |     | +-------------+ |
|          |     | (#FFFFFF, shadow-lg, r 3px)    |     | | TOOLS (3x3) | |
| [pg 1]   |     +--------------------------------+     | | [tile][tile]| |
| [pg 2]   |                                            | | (94x64px)   | |
|          |         +-------------------------+        | +-------------+ |
|          |         | < ^  1 / 2 | -  + 85% ⛶ |        | | DOC INFO /  | |
|          |         +-------------------------+        | | PROPS       | |
|          |     .bottom-floating-bar (312x41px pill,   | |             | |
|          |      bg rgba(15,23,42,0.94), r 9999px)     | |[Save&Downl.]| |
+----------+--------------------------------------------+-----------------+
```

- **Measurements (measured in running app at `1440×900`):**
  - `.top-toolbar-strip`: `1440×53px`, `padding: 8px 16px` (`#ffffff`, sticky).
  - `.left-thumbnails-panel`: `130×779px` expanded (`44px` `.collapsed`; `90px` at `<=1024px`; `display: none` at `<=768px`).
  - `.canvas-viewport`: `970×779px`, `padding: 40px 24px 112px`.
  - `.bottom-floating-bar`: `312.3×41px`, `border-radius: 9999px`, `background: rgba(15, 23, 42, 0.94)`, `color: #fff`, `padding: 6px 14px`, `z-index: 50`.
  - `.right-properties-sidebar`: `340×779px` (`300px` at `<=1024px`; slide-over drawer `max-width: 340px` at `<=768px`).
  - `.tool-tile`: `3×3` grid (`94.3×64px` measured), `border-radius: 12px`, `background: #E6F5F3` (`--pt-teal-50`) / `#F6F8FA` default.
  - `.btn-save-download`: `299×46px`, `border-radius: 12px`, `background: #0F766E`, `color: #fff`.

---

### 4.5 Home / Tool Grid & Static Content Pages

- **Home (`/`):** [`apps/web/src/app/pages/home/home.component.html`](../apps/web/src/app/pages/home/home.component.html) | Visuals: [`home-above-fold-1440.png`](design-assets/home-above-fold-1440.png), [`home-desktop-1440.png`](design-assets/home-desktop-1440.png), [`home-tablet-1024.png`](design-assets/home-tablet-1024.png), [`home-mobile-390.png`](design-assets/home-mobile-390.png)
  - Sequence: `.hero-section` (wave SVG + aurora glows + 2 floating parallax cards hidden `<=1200px` + `.hero-kicker-badge` `388×29px` + H1 `.hero-headline` `62px` + `.hero-subhead` + 4 `.hero-trust-row` chips) → sticky/pill `.hero-filter-nav` (8 category/workflow tabs, `1168×48px`) → Leaderboard Ad (`728×90`) → `.tools-grid` (`max-width: 1560px`, `4` cols `<=1559px`, `5` cols `>=1560px`, `6` cols `>=1960px`, `2` cols `<=1024px`, `1` col `<=640px`) → Roadmap ("Work Your Way") → "Enjoy All Premium Features for Free" navy showcase → Media Suite Coming Soon → 4-item Security Trust Grid → Footer.
- **Static Content Pages** (`about-us`, `contact-us`, `privacy-policy`, `terms-and-conditions`, `gdpr-compliance`, `security-whitepaper`, `cookie-settings`, `press-media-kit`): [`about-us-1440.png`](design-assets/about-us-1440.png), [`privacy-policy-1440.png`](design-assets/privacy-policy-1440.png)
  - Two-column asymmetric hero `.hero-grid` (`1fr / visual`, `padding: 80px 0 90px` desktop) → alternating white and `#f8fafc` (`.bg-slate-subtle`) full-width sections with numbered `01/02/03` principle cards, comparison cards, specification tables, FAQs, and bottom CTA banner.
  - **Note:** Global `.editorial-shell` / `.editorial-card` utilities exist in [`styles.css#L199-L295`](../apps/web/src/styles.css#L199-L295), though existing legal/info pages use component-scoped styles with legacy font fallbacks (see [Section 12](#12-inconsistencies-found)).

---

## 5. Component Catalogue

### 5.1 Shared Components (`apps/web/src/app/shared/components/`)

| Selector / Class | Inputs & Outputs | Anatomy & Real Sizes | Interaction States & Where Used |
| :--- | :--- | :--- | :--- |
| `<app-dropzone>` | Inputs: `title`, `subtitle`, `acceptedTypes` (`.pdf,application/pdf`), `multiple` (`true`), `limitInfo`, `ariaLabel`, `toolName`, `toolDescription`<br>Output: `filesSelected: File[]` | Dashed `#CBD5E1` `1.5px` box, `max-w: 960px`, `min-h: 340px`, `r: 24px`, `pad: 44px 32px 36px`. `60×60` teal upload badge (`r: 18px`), primary CTA `.btn-select-file` (`min-w: 270px`, `h: 60px`, `r: 14px`, `--pt-teal-700`), Drive/Dropbox `60×60` circle/rounded buttons, 3 trust chips | `isDragOver()` flips border solid `--pt-teal-700` + `#F0FDFB` tint. Emits WebMCP attributes (`toolname`, `tooldescription`). Used on all tool upload heroes except `edit-pdf` hero wrapper. |
| `<app-processing-state>` | Inputs: `title`, `message`, `percent` *(Note: `message` & `percent` are declared inputs but NOT rendered in HTML!)* | `.circular-processing-screen`, `pad: 110px 24px`. `.processing-heading` (`Sora 32px w700`, `24px <=640px`), `.circular-spinner` (`110×110px`, `8px` border, `1.05s` linear spin, `--pt-teal-700`) | Pure loading indicator. Used by `tool-placeholder`, `pdf-to-word`, `word-to-pdf`, `pdf-to-excel`, `excel-to-pdf`, `pdf-to-powerpoint`. (`merge-pdf` & `pdf-to-jpg` inline custom processing wrappers.) |
| `<app-result-view>` | Inputs: `result` (req), `previewPdfUrl`, `title`, `subtitle`, `downloadLabel`, `savingsText`, `savingsReason`, `restartLabel`, `isClientSide` (`true`), `privacyTitle`, `privacyMessage`, `nextActionHint`<br>Output: `reset` | Max-w `980px`. `60×60` check circle → H1 + lead → `.document-showcase-card` (`r: 20px`, `pad: 32px 36px`) w/ icon `48×48`, filename + pills + `[Quick Preview]` pill → `.prime-download-btn` (`h: 52px`, `min-w: 260px`, `r: 12px`, `--pt-teal-700`) → `[Drive][Dropbox][Copy Link][Restart]` → `.privacy-callout-banner` (`#E6F5F3`) → 6 `.tools-showcase-grid` cards → Ad `728×90` → 4 share pills (`X`, `LinkedIn`, `FB`, `WhatsApp`) | Hover lifts showcase CTA `-1.5px`. Toggle `[Quick Preview]` opens inline iframe (`hidden` for `.docx`). Used by `merge-pdf`, `tool-placeholder`, `pdf-to-word`, `word-to-pdf`, `excel-to-pdf`, `pdf-to-excel`, `pdf-to-powerpoint`. |
| `<app-file-list>` | Inputs: `files` (`ValidatedPdfFile[]`)<br>Outputs: `moveUp`, `moveDown`, `removeFile` | Horizontal `.dribbble-file-row` list with red `#E53935` PDF badge SVG, title/meta, up/down/delete icon buttons | Disabled at boundary (`first`/`last`). Legacy component (pre-card grid). |
| `<app-upload-consent-dialog>` | Driven by `UploadConsentService.state()` | Fullscreen `.consent-backdrop` (`rgba(13,22,41,0.65)`, `blur(4px)`, `z: 9999`), `.consent-modal` (`max-w: 520px`, `r: 16px`), header (`42×42` badge + `"Cloud Processing"`), summary card (Data, Purpose, Retention), `Don't ask again in this session` checkbox, Cancel / Upload buttons | Focus trapped (`Tab`/`Shift+Tab`), auto-focuses primary CTA, `Escape` & backdrop click cancel. Currently wired to `edit-pdf` OCR. |
| `<app-pt-badge>` | `variant`: `'teal' \| 'navy' \| 'amber' \| 'success' \| 'outline'`; `size`: `'sm' \| 'md'` | Pill (`r: 9999px`, uppercase/semibold `11px` sm / `12px` md) | Reusable badge primitive; most pages still define local `.live-badge` / `.soon-badge` / `.premium-badge`. |
| `<app-pt-ad-slot>` | `slotType`: `'leaderboard' \| 'rectangle' \| 'banner'` | Dashed `#D0D5DD` container (`970×90`, `336×280`, `728×90`, mobile `min-h: 60px`), top-right `ADVERTISEMENT` tag | Used via `pt-ad-slot` on `home`; tool sidebars/results often use inline `.sidebar-ad-box` / `.adsense-card`. |
| `<app-pt-section-header>` | `eyebrow`, `headline` (req), `subtext`, `align` (`'center' \| 'left'`) | Centered `max-w: 760px; margin-bottom: 40px` (`28px <=640px`), eyebrow `12px` teal uppercase | Shared editorial header. |
| `<app-pt-step-list>` | `steps: StepItem[]` (`number`, `title`, `description`) | 3-col desktop (`1-col <=768px`) card grid with `36×36` teal square badge (`r: 8px`) | Default 3-step copy provided if `[steps]` omitted. |
| `<app-pt-faq-accordion>` | `items: FaqItem[]` | Stacked `max-w: 860px` accordion with `32×32` teal chevron circle; toggles `aria-expanded` | Note: `merge-pdf` FAQ renders flat non-accordion cards instead of `<app-pt-faq-accordion>`. |
| `<app-pt-tool-card>` | `title`, `description`, `route`, `badge`, `isLive` | `r: 12px`/`16px` white card with `44×44` icon tile, badge, hover `-3px` lift + `--pt-shadow-card-hover` | Shared primitive (`home` renders bespoke `.tool-card-item`). |
| `<app-pt-workspace-layout>` | `canvasAriaLabel`, `panelAriaLabel`, slots `[workspace-canvas]`, `[workspace-panel]` | Flex workspace `height: calc(100vh - 64px)`, `360px` right panel (`320px <=1024px`, stacked below `<=768px`) | Exists as shared shell; current tool pages inline `.organize-workspace-screen` instead for drawer/dock control. |

### 5.2 Repeated UI Patterns (Sidebar, Cards, Inputs, Banners & Modals)

- **Radio Option Cards** (`.mode-card` in `pdf-to-word`, `.compression-card` in `tool-placeholder`, `.radio-card` in `pdf-to-jpg`):
  - Anatomy: `display: flex; gap: 12–14px; padding: 12–16px; border: 1.5–2px solid #e2e8f0; border-radius: 12px; background: #ffffff / #f8fafc; cursor: pointer`.
  - States: Hover lifts border to `#cbd5e1` / `--pt-teal-600`; `.selected` sets `border-color: var(--pt-teal-700); background: #ffffff` (or `#E6F5F3`), filled `20×20` (`#0F766E`) inner radio dot.
- **Select & Range Inputs** (`pdf-to-jpg.component.css`, `tool-placeholder.component.css`):
  - Native `<select>` / number inputs: `height: 40–44px`, `border: 1px solid var(--pt-outline, #D0D5DD)`, `border-radius: 8px`–`10px`, `padding: 0 12px`, `font-size: 13.5px`–`14px`. Invalid custom range sets `#ef4444` / `--pt-coral` border + red helper text below.
  - Range slider (`.pt-range-slider`): `width: 100%; accent-color: var(--pt-teal-700, #0F766E);` paired with `.slider-val-badge` (`background: var(--pt-teal-100); color: var(--pt-teal-800)`).
- **Checkboxes** (`.pt-checkbox-label`): `15×15px` native checkbox with `accent-color: var(--pt-teal-700)`, `8px` gap, `13px` `--pt-navy` text.
- **Buttons Hierarchy:**
  - **Primary Workspace CTA** (`.giant-merge-submit-btn`, `.btn-convert-action`, `.giant-action-submit-btn`, `.prime-action-btn`): Full sidebar width (`100%`), height **`48px`–`60px`** (`56px`/`60px` canonical desktop, `52px` mobile sticky bar), `border-radius: 12px`, `background: var(--pt-teal-700)`, `#ffffff` text + arrow SVG. Hover: `--pt-teal-800` + `translateY(-2px)` + `0 6px 20px rgba(15, 118, 110, 0.45)`. Disabled: `opacity: 0.6–0.7; cursor: not-allowed; box-shadow: none;` (`merge-pdf` adds `#D0D5DD` bg).
  - **Secondary / Outline Pill** (`.action-pill-btn`, `.btn-secondary`): `height: 36px–42px`, `#ffffff` or `#f8fafc` bg, `1px solid #e2e8f0`, `--pt-navy` text; hover darkens border `#cbd5e1`.
  - **Danger / Destructive Text** (`.sidebar-reset-link` `"Clear all"`, per-card delete `×`): Red `#ef4444` / `--pt-coral` hover onto `--pt-coral-subtle` `#FDF3F1`.
- **Status Banners & Toasts:**
  - **Error Toast** (`.global-error-container`, `.error-banner`, `.global-error-banner`): Floating toaster notification pinned to the top-right (`top: 88px; right: 24px; z-index: 1200; max-width: 440px`), elevated (`box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)`), crisp `#FFFFFF` card, `1px solid #FECACA`, `border-left: 4px solid var(--pt-coral, #E05D44)`, `r: 10px`, `padding: 12px 16px`, red circle-alert SVG + message in `#1F2937` + dismiss `×` button (`aria-label="Dismiss error"`), `slideInToast` entrance animation. Floats non-intrusively without shifting canvas layout. On mobile (`<=768px`), anchors to `top: 76px; left: 16px; right: 16px; width: auto`.
  - **Info** (`.sidebar-info-banner`): `padding: 14px 16px`, `#F0F9FF` bg, `1px solid #BAE6FD`, `r: 8–10px`, `#0369A1` text + info SVG.
  - **Success** (`.privacy-callout-banner`): `--pt-teal-50` (`#E6F5F3`) bg, `--pt-teal-700` text, `r: 14px`, `pad: 14px 22px`.
  - **Warning / Low-savings** (`.low-savings-callout`): `#f8fafc` bg, `1px solid #e2e8f0`, `#64748b` text.
- **File Cards, Single-File Header Pill, Grid Toolbar & Thumbnails:**
  - Single-PDF Canvas Header Bar (`.primary-file-card` in `pdf-to-jpg`): `max-width: 900px` stage (`center-stage-container`, `gap: 24px`), white card `border: 1px solid var(--pt-soft-outline); border-radius: 12px; padding: 14px 18px; gap: 14px`, left `.file-pdf-badge` (`#e05d44`, white `11px w800`), middle `.file-card-name` (`14px w700 --pt-navy`, ellipsis) + `.file-card-meta` (`12px --pt-muted`), right `.file-card-remove` `×` (`color: --pt-ghost`, hover `--pt-coral` on `--pt-coral-subtle`).
  - Canvas Batch Toolbar (`.thumbnails-toolbar` in `pdf-to-jpg`): `display: flex; justify-content: space-between; align-items: center; padding: 0 4px`, left `.toolbar-label` (`14px`), right `.toolbar-right` (`gap: 12px`) using `.btn-text-action` (`13px w600 --pt-teal-700`) or `.action-pill-btn`.
  - Document Reorder Card (`merge-pdf` `.pdf-document-card`): `180×250px` (`r: 8px`), schematic preview graphic (`110×145`), filename (`12px`, ellipsis), `X pages`, bottom `.card-reorder-pills` (`< 1 >` `20×20` arrows), top-right `.card-hover-actions` (`24×24px` circular `.card-action-btn`; revealed on `:hover`, `:focus-within`, and `@media (hover: none)`).
  - Page Thumbnail Grid (`.page-thumbnails-grid` in `pdf-to-jpg`): `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px`. Each `.page-thumb-card` (`r: 12px`, `pad: 10px`, `#ffffff`) holds `.thumb-img-wrapper` (`aspect-ratio: 1 / 1.414; background: var(--pt-subtle-bg); object-fit: contain`), top-left `16×16` checkbox (`accent-color: var(--pt-teal-700)`), `.selected` ring (`background: var(--pt-teal-50); box-shadow: 0 0 0 2px var(--pt-teal-700)`).
  - Live Estimate Readout Card (`pdf-to-jpg` sidebar): `background: #f8fafc; border: 1px solid var(--pt-soft-outline); border-radius: 8px; padding: 10px 12px; font-size: 12.5px` key-value rows (`Dimensions:`, `Estimated size:`).
- **Floating Dock (`merge-pdf`, `pdf-to-jpg`, etc.):** `.floating-tools-dock` `58px` wide vertical white pill (`r: 28px`) at `top: 36px; right: 20px; z-index: 25`. Top item `.dock-square-btn` (`46×46px`, `r: 14px`, `--pt-teal-700`, `+` icon + top-right count badge `.dock-count-badge` `#14213D`/`#0F172A`), followed by Computer upload, Google Drive, Dropbox icon buttons with left-anchored hover tooltips (`.dock-tooltip-label`).
- **Badges:**
  - `Live` (teal): `--pt-teal-50` bg / `--pt-teal-700` text.
  - `Soon` (amber): `#FFFBEB` bg / `#B45309` text.
  - `Recommended` (floating card badge on `compress-pdf`): solid `--pt-teal-700`, `#fff`, `11px` pill positioned on top border (`top: -10px; right: 14px`).
  - `AUTO` (`home` Workflows tab): `#FEF3C7` / `#B45309` micro badge.
  - `👑 Premium` (`pdf-to-word` OCR mode) / `★` (`edit-pdf` Edit Text tab): amber highlight badge.
  - `Archival` (`.feature-tag` on `word-to-pdf` / `excel-to-pdf` PDF/A card): `#eff6ff` bg, `1px solid #bfdbfe`, `#1d4ed8` text, `10px w700`, `padding: 1px 6px`, `border-radius: 4px`.
- **Tabs & Modals:**
  - Underline tabs (`.ilove-split-tabs` in `split-pdf`): `2` equal tabs, active gets `2px` `--pt-teal-700` bottom border.
  - Segmented sliding pill (`.mode-pill-switcher` in `edit-pdf`): `--pt-navy` active fill `#fff` text inside white rounded-pill container.
  - Password Unlock Modal (`.password-modal-backdrop` + `.password-modal-card` in `pdf-to-jpg`): Backdrop `rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 100`; Card `max-width: 440px; padding: 32px; border-radius: 20px; gap: 20px`, `52×52px` `--pt-teal-50` lock circle, centered `Sora 20px` title + `13.5px` subtitle, password input + Cancel (`.btn-secondary`) / Unlock (`.btn-primary`) right-aligned footer.
  - Workflow Preview Modal (`home`): centered dialog (`z-index: 2000`) over `rgba(13,22,41,0.55)`–`0.65` backdrop, Cancel + Primary Teal button.

```html
<!-- Minimal snippet: canonical sidebar info + option card + primary CTA -->
<aside class="sidebar-action-panel" [class.panel-open]="isSidePanelOpen()">
  <div class="sidebar-body">
    <h2 class="sidebar-heading">Tool Name</h2>
    <div class="sidebar-info-banner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>
      <span>Short instruction describing what happens next.</span>
    </div>
    <!-- tool-specific option-section / compression-cards here -->
  </div>
  <div class="sidebar-footer">
    <button type="button" class="btn-convert-action" [disabled]="selectedFiles().length === 0 || isProcessing()" (click)="execute()">
      <span>Action Label</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">...</svg>
    </button>
  </div>
</aside>
```

---

## 6. Behaviour Patterns

Verified across [`merge-pdf.component.ts`](../apps/web/src/app/pages/merge-pdf/merge-pdf.component.ts), [`pdf-to-jpg.component.ts`](../apps/web/src/app/pages/pdf-to-jpg/pdf-to-jpg.component.ts), and [`edit-pdf.component.ts`](../apps/web/src/app/pages/edit-pdf/edit-pdf.component.ts):

1. **Error Banner Across Every State:** Render `.global-error-banner` at the **root top of the component template** (outside the `@switch` / `@if (state)` blocks) so errors remain visible in `upload`, `organize`, `processing`, and `completed` states. Provide a keyboard-accessible `×` dismiss button and clear `errorMessage.set(null)` on new file selection or reset. *(Canonical: `pdf-to-jpg`, `word-to-pdf`, `pdf-to-powerpoint`.)*
2. **File Validation & Duplicate Rejection:** Validate files before adding to state (magic bytes / PDF structure + size caps). Reject duplicates matching `name + size + lastModified` (`pdf-to-jpg.component.ts#L221`) with a user-facing banner warning rather than silently crashing or duplicating cards.
3. **File Add, Remove & Reorder:**
   - Upload state transitions immediately to Organize state on first valid file.
   - Additional files can be added via drag-and-drop onto the workspace canvas or clicking the `+` / Computer button on `.floating-tools-dock`.
   - Reordering (`merge-pdf`) supports HTML5 drag-and-drop PLUS accessible left/right button pills (`< 1 >`) on every card.
   - `Clear all` / per-card remove returns to Upload state when `files().length === 0`.
4. **Cancel & Race Guard (`runId` / `AbortController`):** Async processing must instantiate an `AbortController` (`pdf-to-jpg.component.ts#L69,491`) and/or increment a monotonically increasing `runId` counter. Clicking `Cancel` aborts the controller, discards stale async results (`if (myRunId !== this.activeRunId) return`), and returns cleanly to `organize`.
5. **Memory Cleanup (`URL.revokeObjectURL`):** Every `Blob` URL created for thumbnails, preview iframes, or downloads **must** be revoked when items are removed, `reset()` is called, inside `ngOnDestroy()`, and `setTimeout(() => URL.revokeObjectURL(url), 5000)` after triggering synthetic `<a>.click()` downloads (`pdf-to-jpg.component.ts#L607,682`, `merge-pdf.component.ts#L150,165`).
6. **Filename Sanitizing:** Sanitize download filenames by stripping unsafe filesystem characters and preserving valid base names + target extension before setting `[download]` or `<a download>`.
7. **Unsaved Changes Guard (`Edit PDF`):** Editor routes wire Angular's `canDeactivate` guard (`app.routes.ts` + `edit-pdf.component.ts#L1202`) to prompt users before navigating away with unexported edits.
8. **Keyboard Shortcuts:**
   - Global Header Search: `/` or `Cmd/Ctrl + K` focuses `.header-search-input`; `ArrowDown`/`ArrowUp`/`Enter`/`Escape` navigate `.search-dropdown-panel`.
   - Upload Consent Dialog: `Escape` closes, `Tab`/`Shift+Tab` stays trapped inside modal.
   - `Edit PDF`: `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` (undo/redo), `Delete`/`Backspace` (delete selected element unless typing in text input), `Escape` (deselect), Arrow keys + `Shift+Arrow` (nudge element).
9. **Feature Flags / Coming Soon / Cloud Pickers:**
   - Tools marked `status: 'coming_soon'` (or `'soon'`) render `Soon` amber badges in Header Mega Menu / Home Grid and keep `[routerLink]="null"` with `aria-disabled="true"` (planned routes redirect `''` in `app.routes.ts`).
   - Drive/Dropbox dock buttons on newer tools (`pdf-to-jpg`) render disabled (`class="... disabled" [disabled]="true" aria-label="... (coming soon)"`), whereas older pages (`merge-pdf`, `dropzone`) open `https://drive.google.com/` / `https://www.dropbox.com/home` in a new tab. For new tools, follow the project's active feature-flag rule (disabled `"Coming soon"` unless OAuth integration is live).

---

## 7. Responsive Rules

Tested at `1440×900`, `1024×768`, and `390×844` in headless Chrome:

| Breakpoint | Header & Shell | Home Grid | Tool Upload Hero | Tool Organize Workspace | Edit PDF Workspace |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`>= 1560px` / `1960px`** | `.header-inner` max-w `1760px` | `5` cols (`>=1560`), `6` cols (`>=1960`) | Container `960px`–`1360px` centered | Full flex row, `380px` sticky sidebar, vertical `58px` dock | 3-pane full height, `130px` left + fluid center + `340px` right |
| **`1440px` (Desktop Base)** | Fixed `68px`, `.header-inner` `1400px` | `4` cols (`1312px` grid), floating parallax cards visible | Features `4` cols (`merge`) or `3` cols (`pdf-to-word`); Steps `3` cols | Workspace `1440×828`–`832px`, `180×250` cards, vertical dock top-right | Top bar `53px`, floating bottom capsule `312×41px` |
| **`<= 1320px`** | Mega-menu grid switches `6` -> `3` cols | `4` cols | Unchanged | Unchanged | Unchanged |
| **`<= 1024px` (Tablet)** | Height `60px`, full nav hidden -> `.mobile-toggle` drawer, search expands (`max-w: 360px`) | `<=1200px` hides floating parallax cards; grid `2` cols (`tool-card`) | Features `2` cols (`pdf-to-jpg`) or `1` col (`merge-pdf`) | `.sidebar-action-panel` narrows `380px` -> **`320px`**; canvas pad `24px 80px 24px 20px` | `.left-thumbnails-panel` -> **`90px`** (`60×85` thumbs); `.right-properties-sidebar` -> **`300px`** |
| **`<= 768px` (Mobile)** | `.search-key-hint` hidden; Footer columns become accordions; `.container` pad `16px` | `1`–`2` cols | `1` col everywhere; hero padding reduced (`32px 0 48px`) | Flex **column**; sidebar becomes fixed slide-over drawer (`85vw`, max `360–380px`, `z: 50–60`); `.mobile-gear-btn` (`46×46px` circle) toggles drawer; vertical dock becomes **horizontal pill** (`r: 9999px`); **pinned bottom `.mobile-convert-bar`** (`52px` CTA, hidden when drawer opens) | `.left-thumbnails-panel` **hidden**; `.right-properties-sidebar` becomes `340px` fixed drawer (`z: 50`) |
| **`<= 640px` / `390px`** | Pad `0 12px`, logo `25px` high, search input `36px`, search dropdown full-width fixed; back-to-top `42×42px` | `1` col cards, trust chips `2×2` grid | Compact dropzone padding, sidecar cloud buttons stack/wrap | Centered cards; touch actions always visible (no hover-only controls) | `.bottom-floating-bar` compact; `<=480px` hides Undo/Redo text labels |
| **`<= 380px`** | Pad `0 8px`, logo `22px`, search `34px`, hamburger `34×34px` | `1` col | Stacked buttons | Same as `<=640px` | Same as `<=640px` |

---

## 8. Accessibility Rules Actually Applied

1. **Skip Link & Landmarks:** `.skip-link` (`styles.css#L105-L125`) jumps to `<main id="main-content">`. Landmark roles used across shell and workspace: `<header>`, `<nav aria-label="...">`, `<main>`, `<aside role="complementary" aria-label="...">`, `<footer class="pt-footer">`.
2. **Global Focus Ring:** `styles.css#L127-L130` enforces `:focus-visible { outline: 2px solid var(--pt-teal-700); outline-offset: 2px; }`. Never remove outlines on `:focus-visible` without supplying an equivalent high-contrast box-shadow (`back-to-top` uses `0 0 0 3px rgba(15, 118, 110, 0.35)`).
3. **ARIA Interactive Patterns:**
   - Dropdowns & accordions: `[attr.aria-expanded]`, `aria-haspopup="true"`, `role="menu"` / `role="menuitem"`, `[attr.aria-controls]`.
   - Search combobox: `[attr.aria-expanded]`, listbox options.
   - Modals (`upload-consent-dialog`): `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, `Escape` dismiss, strict `Tab`/`Shift+Tab` focus trap, auto-focus on confirm action.
   - Live errors: `.global-error-banner` should carry `role="alert"` / `aria-live="assertive"` (`pdf-to-jpg` & tool converters).
4. **Reduced Motion:** `styles.css#L132-L143` includes a global `@media (prefers-reduced-motion: reduce)` rule reducing `animation-duration` and `transition-duration` to `0.01ms !important` and disabling smooth scroll. `AnimationService` also checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before running GSAP timelines.
5. **Contrast Caveats:** Primary body copy (`#374151`, `#4B5563`), headings (`#14213D`, `#111827`), primary buttons (`#FFFFFF` on `#0F766E` = `5.47:1`), and ad labels (`#475569`) pass WCAG AA. Avoid putting small text in `#9CA3AF` (`2.54:1`), `#14B8A6` on white (`2.49:1`), or `#E05D44` on light pink (`3.31:1`) — use `#B91C1C` / `--pt-coral-hover` (`#C54E37`) for error text.
6. **Hit Areas & Touch Targets:** Primary dropzone buttons are `60px` tall, header nav links `>=33px`, mobile icon toggles `36–46px`, dock buttons `46px` (`merge-pdf`), close buttons `38px`. Never rely purely on hover (`opacity: 0` card action buttons must also reveal on `:focus-within` and `@media (hover: none)`).
7. **Heading Hierarchy:** Maintain a single visible or screen-reader `<h1>` per active view. Converter pages such as `pdf-to-excel` and `pdf-to-powerpoint` place `<h1 class="visually-hidden">` inside `organize`, `processing`, and `completed` views when the hero `<h1>` unmounts, with `<h2 class="sidebar-heading">` inside the sidebar.

---

## 9. Motion and Icons

### 9.1 Iconography

- **Important Reality Check:** `@lucide/angular` (`1.63.0`) is installed in `apps/web/package.json`, **but 0 templates render `<lucide-icon>`**. All icons in `apps/web/src/app` are **hand-authored inline SVGs matching Lucide 24×24 viewBox geometry** (`fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`).
- **Exceptions:** Brand/service logos (`PDFTailor` mark SVG, Google Drive 3-color triangle, Dropbox blue diamond, social brand icons in `result-view` / `footer`) use multicolor `fill` paths.
- **Standard Sizes & Stroke Weights:**
  - Inline small arrows / chevrons / list icons: `13px`–`16px`, `stroke-width="2"` or `"2.5"`
  - Sidebar info icons, consent modal close, dropzone trust chips: `14px`–`18px`, `stroke-width="2"`
  - Primary CTA arrow, dock icons, mobile gear, header mobile toggle: `20px`–`24px`, `stroke-width="2"` or `"2.5"`
  - Hero / Dropzone center badge SVG: `24px`–`28px`, `stroke-width="1.8"`–`"2"`
- **Rule for New Code:** Add inline `<svg>` icons using Lucide 24×24 geometry (`class="lucide-icon"` optional, `aria-hidden="true"` on decorative icons inside labeled buttons) with `stroke="currentColor"`. Never introduce Heroicons filled sets, FontAwesome, Material Icons font ligatures, or emoji icons *(exception: existing legacy `👑` on `pdf-to-word` OCR card)*.

### 9.2 Animations & GSAP

- **GSAP (`AnimationService` in [`animation.service.ts`](../apps/web/src/app/core/services/animation.service.ts)):** Used **only on the Home page (`home.component.ts`)** for hero stagger fades (opacity-only with `clearProps: 'opacity,transform'`), mouse-move parallax on the 2 `.hero-float-card` badges (`desktop >1200px`), and staggered card reveal (`.tool-card-item`). Guarded by `prefers-reduced-motion`.
- **CSS Transitions & Keyframes:**
  - Standard micro-interaction easing: `0.15s`–`0.25s cubic-bezier(0.16, 1, 0.3, 1)` (hover lifts `translateY(-1.5px)` to `(-3px)`, button scale `1.05`, drawer `transform 0.3s`).
  - Allowed continuous keyframes: `.circular-spinner` `1.05s linear infinite rotate` (`processing-state`), `.success-icon-circle` `pulseSuccess` (`result-view`), `slideDown` (`global-error-banner`), `fadeIn` / `slideUp` (`consent-modal`). Do not add decorative pulsing/bouncing animations on static form controls.

---

## 10. Copy and Voice Guide

- **Tone:** Calm, trustworthy, technical-yet-plain, privacy-explicit, zero-hype (no aggressive upsells, no dark patterns).
- **Capitalisation:**
  - Headings & tool names: **Title Case** (`Merge PDF`, `Split PDF`, `PDF to JPG`, `PDF to Word Converter`). Acronyms always uppercase (`PDF`, `JPG`, `OCR`, `DOCX`, `PPTX`, `XLSX`, `GDPR`, `TLS`). Avoid all-caps in links/dropdowns (legacy `WORD to PDF` in mega menu is an inconsistency).
  - Sidebar option labels / group headers: Uppercase micro-labels (`CONVERSION MODE`, `IMAGE QUALITY`, `COMPRESSION LEVEL`, `PAGES`).
  - Sentences, leads, descriptions, error banners: Sentence case with ending punctuation on multi-word explanations.
- **Button Labels Pattern:**
  - Upload dropzone CTA: `Select <Input Type> files` / `Select <Input>` (e.g., `Select PDF files`, `Select images`).
  - Primary workspace CTA: `<Verb> <Target>` + `➔` arrow (e.g., `Merge PDF`, `Split PDF`, `Compress PDF`, `Convert to JPG`, `Extract images`, `Convert to WORD`, `Save & Download`).
  - Result CTA: `Download <Output>` (e.g., `Download Merged PDF`, `Download Compressed PDF`, `Download All (ZIP)`). Restart: `Process Another File` / `Convert another PDF`.
  - Processing cancel: `Cancel` or `Cancel Operation`.
- **Privacy-Line Wording (Strictly Match Execution Mode):**
  - **100% Browser-Only Tools** (`merge-pdf`, `split-pdf`, `compress-pdf`, `pdf-to-jpg`):
    - Hero subtitle / Trust: *"Processed 100% locally in your browser with zero server uploads."*
    - Editorial Feature: *"Your documents never touch an external server. Everything renders directly inside your private browser sandbox."* (`Zero Server Storage`)
    - Result callout (`<app-result-view [isClientSide]="true">`): `"Your documents were processed directly inside your browser's private memory. No files are uploaded to our servers, keeping your data confidential."`
  - **Server-Assisted / Hybrid Tools** (`word-to-pdf`, `powerpoint-to-pdf`, `excel-to-pdf`, `pdf-to-word`, `pdf-to-excel`, `pdf-to-powerpoint`, `edit-pdf` OCR):
    - Result callout (`<app-result-view [isClientSide]="false">`): `"Your document was converted securely over an encrypted connection, converted on our server and deleted automatically after 10 minutes."` (`Zero Server Retention` / `Encrypted & Ephemeral`)
    - Before OCR / Server upload (when using `UploadConsentService`): Must disclose exact payload (`pageCountDescription`), `purposeDescription`, and `retentionDescription` (e.g., `"Immediately purged from ephemeral volatile memory once complete; zero disk storage"`).
  - **Rule:** Never claim "zero server upload" on a server-assisted or hybrid tool path.
- **Error Message Style:** Actionable, plain cause + next step (`"Maximum 10 files allowed per conversion. Extra files were excluded."`, `"Please select at least 2 valid PDF documents to merge."`, `"Password protected PDF: please enter password to unlock."`). Avoid duplicate words like `"corrupt or corrupted"`.
- **SEO Pattern:**
  - Title (`packages/contracts/src/tools.ts` / `app.routes.ts`): `<Tool Name> Online Free - <Benefit/Action> | PDFTailor` (never `| PDF flow`).
  - Meta Description: 140–160 chars explaining core conversion, key options, and privacy model (browser-only vs ephemeral encrypted processing).

---

## 11. How to Add a New Tool (Checklist)

1. **Contracts & Tool Registry:**
   - Add tool definition to [`packages/contracts/src/tools.ts`](../packages/contracts/src/tools.ts) (if not already present) using `PDFTailor` branding & accurate `executionMode` (`'client'` vs `'server'` vs `'hybrid'`).
   - Run `npm run build:contracts` and verify [`apps/web/src/app/core/services/tool-registry.service.ts`](../apps/web/src/app/core/services/tool-registry.service.ts) exposes it with `status: 'live'`.
   - Rebuild AI manifests if needed (`npm run manifests:ai` from root `package.json`).
2. **Routing & Navigation:**
   - Register lazy route in [`apps/web/src/app/app.routes.ts`](../apps/web/src/app/app.routes.ts) (`path: '<tool-slug>'`, `loadComponent`, `title`).
   - Enable links and switch badge from `Soon` -> `Live` in [`header.component.html`](../apps/web/src/app/shared/components/header/header.component.html) (Convert PDF dropdown, Mega Menu, Mobile Drawer) and [`footer.component.html`](../apps/web/src/app/shared/components/footer/footer.component.html).
3. **Component Folder Structure (`apps/web/src/app/pages/<tool-slug>/`):**
   - `<tool-slug>.component.ts`, `.html`, `.css`, `.spec.ts` (optional sub-services under `apps/web/src/app/core/services/<tool-slug>/`).
   - Copy layout skeleton from **`merge-pdf`** (multi-file card workspace) or **`pdf-to-jpg`** (latest architecture with root `.global-error-banner`, `AbortController`/`runId`, duplicate rejection, `URL.revokeObjectURL`, filename sanitizer).
   - Call `LayoutService.hideFooter()` when entering `organize` / `processing`, and `showFooter()` in `upload`, `completed`, and `ngOnDestroy()`.
4. **Required Shared Pieces & Locked Structure:**
   - Upload State: `<app-dropzone>`, AdSense leaderboard slot, features grid, 3-step guide (`01`/`02`/`03`), FAQs, related tools.
   - Workspace State: `.global-error-banner` at page root (visible in ALL states) + `.organize-workspace-screen` (`380px` sticky `.sidebar-action-panel`, `.floating-tools-dock` `58px` pill with disabled Drive/Dropbox buttons unless behind active live flag, `300×250` sidebar ad, `56–60px` `--pt-teal-700` primary CTA, mobile gear FAB + bottom convert bar at `<=768px`).
   - Processing & Result: `<app-processing-state>` (with Cancel control) and `<app-result-view>` (or approved multi-item gallery).
5. **What May Differ vs What Must NOT Differ:**
   - **May differ:** Copy, H1/lead/FAQ wording, Lucide inline SVG shapes, sidebar option controls (using existing radio cards/selects/checkboxes/sliders), accepted file types in Dropzone.
   - **Must NOT differ:** Colors (`--pt-*`), font families (`Sora`/`Inter`), radii, shadows, header/footer chrome, upload section cadence, workspace split proportions, button styles, or ad slot reservations.
   - **New pattern gate:** If a needed UI control does not exist in Section 5, **STOP**, write a **"Proposed additions"** block in the PR (what, why, mock description), and wait for approval.
6. **Mandatory Pre-PR Verification Steps:**
   - Capture screenshots at **`1440×900`**, **`1024×768`**, and **`390×844`** across Upload, Workspace (incl. mobile drawer), Error Banner, Processing, and Result states; visually compare side by side against `merge-pdf` / `pdf-to-jpg` baselines in `docs/design-assets/`.
   - Grep new files to ensure **0** matches for hard-coded legacy colors (`#e53935`, `#fca5a5`), legacy fonts (`Outfit`, `Space Grotesk`, `Plus Jakarta Sans`), or legacy brand names (`PaperFlow`, `PDF flow`).
   - Verify keyboard navigation, `:focus-visible`, contrast >= 4.5:1, and run Lighthouse Accessibility audit targeting **>= 95**.

---

## 12. Inconsistencies Found

*(Observed directly in code and running Chrome — documented only; do NOT modify source code in this task.)*

1. **Three Incompatible Upload Hero Patterns:**
   - `merge-pdf` / `tool-placeholder`: `.unified-hero-section` (`#f4f5f8` bg, `50px` H1, no breadcrumbs, `4`-col features, `01/02/03` steps, FAQ, 4 related cards).
   - `pdf-to-word` / `word-to-pdf` / `pdf-to-excel` / `excel-to-pdf` / `pdf-to-powerpoint`: omits FAQ & related tools, uses `3`-col features and circular `1/2/3` `.step-badge`.
   - `pdf-to-jpg`: places `.hero-ad-slot` inside the hero (`#F6F8FA`), `48px` H1, omits FAQ & related cards.
   - **Intended canonical:** `.unified-hero-section` without breadcrumbs, leaderboard ad below hero, features, 3 steps, FAQs, related tools (`merge-pdf` cadence + `--pt-*` token styling).
2. **Legacy Brand Names Still in Production Paths & Contracts:**
   - `apps/web/src/app/core/services/seo.service.ts#L44` defaults to `'PaperFlow - Free & Private Online PDF Toolkit'` (`canonical: 'https://paperflow.app/'`).
   - `packages/contracts/src/tools.ts` titles use `| PDF flow` and canonicals `https://pdfflow.app/...` (observed in `pdf-to-word`, `word-to-pdf`, `pdf-to-excel`, `pdf-to-powerpoint`, `images-to-pdf`, etc.).
   - `merge-pdf` result output filename in `browser-pdf.service.ts` still outputs `paperflow-merged-YYYY-MM-DD.pdf` (visible in [`merge-pdf-result-1440.png`](design-assets/merge-pdf-result-1440.png)).
   - `pdf-to-word.service.ts#L188,249` embeds `'PDF flow'` creator metadata.
   - `header.component.html#L186` Convert PDF dropdown footer claims `"100% Client-Side Conversion • No files uploaded to servers"` even though the same dropdown links to server/hybrid tools (`word-to-pdf`, `pdf-to-word`, etc.).
   - **Intended:** `PDFTailor` everywhere, with accurate client vs server wording.
3. **Legacy Red / Coral Hexes (`#fca5a5`, `#e53935`, `--coral-600`) Remaining:**
   - Hover borders on `.dropzone-box` / cards still flash red `#fca5a5` in `merge-pdf.component.css#L162,670`, `tool-placeholder.component.css#L514,544,977`, `pdf-to-word.component.css#L339`, `pdf-to-excel.component.css#L345,1274`.
   - `#e53935` and undefined `var(--coral-600, #e53935)` still appear in `file-list.component.html` (`PDF` badge SVG). (`about-us`, `contact-us`, `privacy-policy`, `terms-and-conditions`, `gdpr-compliance`, `security-whitepaper`, `cookie-settings`, and `press-media-kit` have been migrated to `--pt-teal-700` / `--pt-navy` Ocean Workspace tokens.)
   - **Intended:** Ocean Workspace `--pt-teal-700` / `--pt-teal-100` for focus/hover; `--pt-coral` / `#B91C1C` strictly for error/destructive actions.
4. **Legacy Unloaded Font Families (`Outfit`, `Space Grotesk`, `Plus Jakarta Sans`):**
   - `result-view.component.css#L10`, `tool-placeholder.component.css#L6`, `pdf-to-word.component.css#L6`, `pdf-to-excel.component.css#L6` declare `'Outfit'` (never loaded in `@font-face` or `index.html`), falling back to system font.
   - `about-us`, `contact-us`, `privacy-policy`, `terms-and-conditions`, `gdpr-compliance`, `security-whitepaper`, `cookie-settings`, and `press-media-kit` now use `Sora` & `Inter`.
   - `<button>` controls in `pdf-to-jpg`, `edit-pdf`, and `merge-pdf` dock lack `font-family`, rendering `Arial` in Chrome.
   - **Intended:** `--pt-font-heading` (`Sora`) and `--pt-font-body` (`Inter`) everywhere.
5. **Undefined Token References in CSS (`STYLEGUIDE.md` vs `styles.css`):**
   - `pt-badge`, `pt-tool-card`, `pt-faq-accordion`, `pt-step-list` reference `--pt-amber-50`, `--pt-amber-700`, `--pt-amber-100`, `--pt-success`, `--pt-bg`, `--pt-radius-full`.
   - `header.component.css`, `tool-placeholder.component.css`, `file-list.component.css`, `back-to-top.component.ts` reference legacy `--surface-border`, `--text-main`, `--text-muted`, `--radius-lg`, `--pt-surface-ground`, `--pt-ink`, `--pt-border-subtle`, none of which exist in `styles.css` `:root`.
   - Meanwhile `docs/redesign/STYLEGUIDE.md` documents `--pt-navy-950`, `--pt-gray-*`, `--pt-amber-500` (`#D98E04`) which do not exist in `styles.css`.
   - **Intended:** `apps/web/src/styles.css` `:root` is the real token map; missing amber/success/info tokens should be added there explicitly if standardized.
6. **Error Banner Scope & Wording:**
   - `merge-pdf` renders `.error-banner` inside Upload and Organize only (invisible during Processing/Completed).
   - `pdf-to-jpg` mounts `.global-error-banner` at page root (visible in all states), **but** displays a copy typo `"It may be corrupt or corrupted."` (`pdf-to-jpg.component.ts`) and did not clear the top error banner when a subsequent valid file loaded during multi-file upload (`pdf-to-jpg` keeps the stale first invalid file pill name too).
   - **Intended:** Global root error banner visible in every state (`pdf-to-jpg` placement), cleared on successful replacement.
7. **Sidebar Width, Top Offset, CTA Height & Mobile Controls Drift:**
   - Sidebar desktop widths vary: `350px` (`merge-pdf`), `360px` (`pt-workspace-layout`), `380px` (`pdf-to-jpg`, `tool-placeholder`, converters), `340px` (`edit-pdf` properties sidebar).
   - `merge-pdf` & `tool-placeholder` hardcode `top: 72px; min-height: calc(100vh - 72px)` instead of `var(--header-height, 68px)`.
   - Primary sidebar CTA height varies: `60px` (`merge-pdf`), `56px` (`convert` / `split`), `48px` (`pdf-to-jpg`), `46px` (`edit-pdf`).
   - Mobile `390px` organize UI varies: `merge-pdf` shows top-right white gear FAB + horizontal bottom dock + fixed bottom CTA bar; `pdf-to-jpg` shows bottom-right navy gear FAB overlapping page thumbnails, keeps dock on side, and has no fixed bottom CTA bar; `edit-pdf` hides mobile drawer toggle cleanly? (`mobile-open` has no visible trigger in [`edit-pdf-workspace-390.png`](design-assets/edit-pdf-workspace-390.png)).
   - **Intended:** `380px` sidebar aligned to `--header-height` (`68px`), `56–60px` CTA, and `merge-pdf`'s mobile drawer + fixed `.mobile-convert-bar` + horizontal dock pattern.
8. **Processing State Inputs & Cancel Support:**
   - `<app-processing-state>` declares `message` and `percent` inputs in TypeScript, yet renders neither (nor a Cancel button) in `processing-state.component.html`.
   - `pdf-to-jpg` and `pdf-to-powerpoint` build custom processing wrappers specifically to render a Cancel button and progress feedback.
9. **Result State Patterns & Copy Quirk:**
   - 7 tool pages use `<app-result-view>`; `pdf-to-jpg` builds a custom `.result-workspace-screen` multi-image gallery.
   - `compress-pdf` injects `restartLabel="Compress PDF Another File"` (awkward grammar visible in [`compress-pdf-result-1440.png`](design-assets/compress-pdf-result-1440.png)) and displays `-0% saved` on near-zero reduction.
10. **Header Mega Menu Status vs Routes:**
    - `header.component.html` shows `Edit PDF` badged as amber **`Soon`** (`[routerLink]="null"`) in the Mega Menu even though `/edit-pdf` is **`Live`** on the Home grid, Footer, and Router.
    - Mega Menu Column 3 capitalizes `WORD to PDF`, `POWERPOINT to PDF`, `EXCEL to PDF` in all-caps prefixes unlike Column 1/4 Title Case.
11. **Drive / Dropbox Buttons Behaviour:**
    - `pdf-to-jpg` renders dock Drive/Dropbox buttons visibly disabled (`coming soon`), whereas `dropzone` (`app-dropzone`), `merge-pdf`, and `result-view` render full-color active-looking Drive/Dropbox buttons that simply `window.open('https://drive.google.com/')` / `dropbox.com`.
12. **Shared `pt-*` Library Underused:**
    - `pt-tool-card`, `pt-step-list`, `pt-faq-accordion`, `pt-workspace-layout`, `pt-badge` exist in `shared/components/` but almost all existing pages inline their own duplicate HTML/CSS cards and grids.
13. **Tool-Placeholder Technical Debt:**
    - `/split-pdf` and `/compress-pdf` still route to `ToolPlaceholderComponent` in `app.routes.ts` and `pages/tool-placeholder/`.

---

## 13. Do and Don't + Glossary

### 13.1 Do and Don't

| DO | DON'T |
| :--- | :--- |
| **DO** use `--pt-teal-700` (`#0F766E`) & `--pt-teal-800` (`#0B5D57`) for primary buttons, active card borders, and `:focus-visible` outlines. | **DON'T** use legacy red/coral `#e53935` or `#fca5a5` for hover borders, upload icons, or primary CTAs (reserve `--pt-coral` / `#B91C1C` for errors & delete). |
| **DO** use `--pt-font-heading` (`Sora`) and `--pt-font-body` (`Inter`), explicitly setting `font-family: var(--pt-font-body)` on `<button>` elements. | **DON'T** write `font-family: 'Outfit'`, `'Space Grotesk'`, or `'Plus Jakarta Sans'`, or leave buttons on browser-default `Arial`. |
| **DO** mount `.global-error-banner` at the root of the tool page above `@if`/`@switch` states so errors show in Upload, Organize, Processing, and Result. | **DON'T** hide the error banner inside Upload-only or Organize-only blocks (`merge-pdf` pitfall). |
| **DO** use inline Lucide-geometry 24×24 `<svg stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` icons. | **DON'T** mix icon packs, emojis in badges, or broken `<lucide-icon>` assumptions without updating conventions. |
| **DO** call `LayoutService.hideFooter()` during workspace/processing and revoke every `Blob` URL via `URL.revokeObjectURL()` in `reset()` & `ngOnDestroy()`. | **DON'T** leak object URLs, omit `AbortController`/`runId` cancellation, or claim `"zero server upload"` on server-assisted tools. |
| **DO** use `380px` sticky `.sidebar-action-panel` (`top: var(--header-height, 68px)`) + mobile gear + `.mobile-convert-bar` on `<=768px`. | **DON'T** invent bespoke page widths, custom header bars, or unapproved modal flows without raising `'Proposed additions'`. |

### 13.2 Glossary of Components & Canonical Selectors

| Term / Selector | Meaning | Source |
| :--- | :--- | :--- |
| `.unified-hero-section` | Canonical light-gray (`#F4F5F8` / `#F6F8FA`) upload hero wrapper containing H1, lead, and `<app-dropzone>` | `merge-pdf.component.css`, `styles.css` |
| `<app-dropzone>` / `.dropzone-box` | `960px` max-width dashed drag-and-drop uploader (`min-height: 340px`, `border-radius: 24px`) | `shared/components/dropzone/` |
| `.organize-workspace-screen` | Full-viewport flex row (`height: calc(100vh - 68px)`) with scrollable canvas + sticky right sidebar | `merge-pdf`, `pdf-to-jpg`, `tool-placeholder` |
| `.floating-tools-dock` | `58px` floating pill docked top-right (`top: 36px; right: 20px`) with teal `+` badge button, Computer, Drive, Dropbox triggers | `merge-pdf`, `pdf-to-jpg` |
| `.sidebar-action-panel` | Sticky right configuration panel (`350px`–`380px` desktop; slide-over drawer `<=768px`) ending in sticky `.sidebar-footer` CTA | All non-editor tool workspaces |
| `.mobile-gear-btn` & `.mobile-convert-bar` | Mobile-only (`<=768px`) `46×46px` drawer toggle + pinned bottom fixed CTA bar | `merge-pdf.component.css#L983-L1144` |
| `.global-error-banner` | Full-width top alert strip visible in all tool states (`#FEF2F2` / `#FDF3F1`, red icon/text, dismiss `×`) | `pdf-to-jpg.component.html#L4-L16` |
| `<app-processing-state>` | Fullscreen centered `110px` teal circular CSS spinner + `Sora` `32px` status heading | `shared/components/processing-state/` |
| `<app-result-view>` | Canonical `980px` post-completion layout with document card, download CTA, preview iframe toggle, privacy callout, next tools grid, ad, social share | `shared/components/result-view/` |
| `<app-upload-consent-dialog>` | `520px` accessible modal (`z: 9999`) required before sending PDFs to server/OCR endpoints | `shared/components/upload-consent-dialog/` |

---

## 14. Appendix

### 14.1 Visual Baseline Index (`docs/design-assets/`)

All 33 screenshots captured on running `ng serve` (`http://localhost:4200`) using headless Google Chrome at `1440×900`, `1024×768`, and `390×844`:

- **Home & Navigation:** `home-above-fold-1440.png`, `home-desktop-1440.png`, `home-tablet-1024.png`, `home-mobile-390.png`, `home-mega-menu-1440.png`, `home-search-open-1440.png`
- **Upload States:** `merge-pdf-upload-1440.png`, `merge-pdf-upload-1024.png`, `merge-pdf-upload-390.png`, `pdf-to-jpg-upload-1440.png`, `pdf-to-word-upload-1440.png`, `edit-pdf-upload-1440.png`
- **Error Banner:** `error-banner-upload-1440.png`
- **Organize / Workspace States:** `merge-pdf-organize-1440.png`, `merge-pdf-organize-1024.png`, `merge-pdf-organize-390.png`, `merge-pdf-mobile-drawer-390.png`, `pdf-to-jpg-organize-1440.png`, `pdf-to-jpg-organize-390.png`, `split-pdf-organize-1440.png`, `compress-pdf-organize-1440.png`, `pdf-to-word-organize-1440.png`
- **Processing & Result States:** `shared-processing-state-1440.png`, `merge-pdf-result-1440.png`, `merge-pdf-result-390.png`, `compress-pdf-result-1440.png`, `pdf-to-jpg-result-1440.png`
- **Editor Workspace (`edit-pdf`):** `edit-pdf-workspace-1440.png`, `edit-pdf-workspace-1024.png`, `edit-pdf-workspace-390.png`
- **Static Content Pages:** `about-us-above-fold-1440.png`, `about-us-1440.png`, `about-us-1024.png`, `about-us-390.png`, `about-us-bottom-1440.png`, `privacy-policy-1440.png`, `privacy-policy-above-fold-1440.png`, `privacy-policy-1024.png`, `privacy-policy-390.png`, `privacy-policy-bottom-1440.png`, `terms-and-conditions-above-fold-1440.png`, `terms-and-conditions-1440.png`, `terms-and-conditions-1024.png`, `terms-and-conditions-390.png`, `terms-and-conditions-bottom-1440.png`, `gdpr-compliance-above-fold-1440.png`, `gdpr-compliance-1440.png`, `gdpr-compliance-1024.png`, `gdpr-compliance-390.png`, `gdpr-compliance-bottom-1440.png`, `security-whitepaper-above-fold-1440.png`, `security-whitepaper-1440.png`, `security-whitepaper-1024.png`, `security-whitepaper-390.png`, `security-whitepaper-bottom-1440.png`, `cookie-settings-above-fold-1440.png`, `cookie-settings-1440.png`, `cookie-settings-1024.png`, `cookie-settings-390.png`, `cookie-settings-bottom-1440.png`, `press-media-kit-above-fold-1440.png`, `press-media-kit-1440.png`, `press-media-kit-1024.png`, `press-media-kit-390.png`, `press-media-kit-bottom-1440.png`, `contact-us-1440.png`, `contact-us-1024.png`, `contact-us-390.png`, `contact-us-step2-1440.png`

### 14.2 Files Analysed

- **Global / Shell / Config:** `apps/web/src/styles.css`, `apps/web/src/index.html`, `apps/web/angular.json`, `apps/web/package.json`, `package.json`, `apps/web/src/app/app.ts`, `apps/web/src/app/app.component.html`, `apps/web/src/app/app.component.css`, `apps/web/src/app/app.routes.ts`, `apps/web/src/environments/environment.ts`
- **Core Services & Contracts:** `packages/contracts/src/tools.ts`, `apps/web/src/app/core/services/{animation.service.ts,layout.service.ts,seo.service.ts,tool-registry.service.ts,browser-pdf.service.ts,pdf-to-word.service.ts,upload-consent.service.ts}`, `docs/redesign/{STYLEGUIDE.md,DECISIONS.md}`
- **Shared Components:** `apps/web/src/app/shared/components/{header/*,footer/*,back-to-top/*,dropzone/*,file-list/*,processing-state/*,result-view/*,upload-consent-dialog/*,pt-ad-slot/*,pt-badge/*,pt-faq-accordion/*,pt-section-header/*,pt-step-list/*,pt-tool-card/*,pt-workspace-layout/*}`
- **Pages:** `apps/web/src/app/pages/{home/*,merge-pdf/*,pdf-to-jpg/*,pdf-to-word/*,word-to-pdf/*,powerpoint-to-pdf/*,excel-to-pdf/*,pdf-to-excel/*,pdf-to-powerpoint/*,tool-placeholder/*,edit-pdf/*,about-us/*,privacy-policy/*,terms-and-conditions/*,gdpr-compliance/*,security-whitepaper/*,cookie-settings/*,press-media-kit/*}`

### 14.3 Provenance

- **Generated from Commit:** `0d14632` (`dev` branch)
- **Generated on:** `2026-11-11`
- **Last verified:** `2026-11-11` against running Chrome (`1440×900`, `1024×768`, `390×844`) and committed `docs/design-assets/*`.
