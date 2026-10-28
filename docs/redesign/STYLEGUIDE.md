# PDFTailor Design System & Styleguide: Ocean Workspace

> **Version:** 1.0.0  
> **Brand Identity:** PDFTailor  
> **Domain:** [pdftailor.in](https://pdftailor.in)  
> **Status:** Production Verified

---

## 1. Visual Identity & Theme Architecture

PDFTailor departs completely from generic, aggressive red document tool aesthetics (e.g. iLovePDF), introducing the **Ocean Workspace** design language: a high-trust, editorial, and precision-engineered aesthetic built for privacy-conscious individuals and enterprise teams.

### 1.1 Core Brand Colors

| Token Name | Hex Value | Semantic Role | WCAG Contrast (on white) |
| :--- | :--- | :--- | :--- |
| `--pt-navy-950` | `#0B1220` | Deep Ink Background / Dark Shells | 17.8:1 (AAA) |
| `--pt-navy-900` | `#14213D` | Primary Brand Navy, Dark Cards, Headers | 14.5:1 (AAA) |
| `--pt-navy-800` | `#1E293B` | Slate Borders, Dark Subheaders | 10.6:1 (AAA) |
| `--pt-teal-700` | `#0F766E` | Primary Action Teal, Interactive Elements | 4.8:1 (AA) |
| `--pt-teal-800` | `#0B5D57` | Hover Action Teal, High-Contrast Text | 7.1:1 (AAA) |
| `--pt-teal-50` | `#ECF7F5` | Light Teal Tint for Badges and Highlights | Substrate |
| `--pt-amber-500`| `#D98E04` | Warm Accent, Warning Badges, Star Ratings | 3.5:1 (UI Components) |
| `--pt-gray-50` | `#F8FAFC` | Surface Wash / Page Background | Substrate |
| `--pt-gray-100` | `#F1F5F9` | Neutral Card Substrate, Dividers | Substrate |
| `--pt-gray-200` | `#E2E8F0` | Subtle Borders | Substrate |
| `--pt-gray-700` | `#334155` | Secondary Body Text | 7.4:1 (AAA) |
| `--pt-gray-900` | `#0F172A` | Primary Body Text | 18.2:1 (AAA) |

---

## 2. Typography

PDFTailor uses self-hosted, variable WOFF2 web fonts to avoid third-party tracking and network latency.

* **Editorial Headings:** `Sora`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
  * Weight range: 600, 700, 800
  * Letter-spacing: `-0.025em` (tight, crisp, authoritative)
* **Body & UI Elements:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
  * Weight range: 400, 500, 600
  * Line-height: `1.5` to `1.6` for optimal readability
* **Telemetry & Metadata:** `ui-monospace`, "SF Mono", "Cascadia Code", monospace
  * Font-size: `0.75rem` to `0.85rem` with uppercase styling where applicable

---

## 3. Elevation & Depth

* **Card Elevation 1 (`--pt-shadow-sm`):** `0 1px 2px 0 rgba(11, 18, 32, 0.05)`
* **Card Elevation 2 (`--pt-shadow-md`):** `0 4px 6px -1px rgba(11, 18, 32, 0.08), 0 2px 4px -2px rgba(11, 18, 32, 0.05)`
* **Hover / Floating (`--pt-shadow-lg`):** `0 10px 15px -3px rgba(11, 18, 32, 0.10), 0 4px 6px -4px rgba(11, 18, 32, 0.05)`
* **Modal / Flyout (`--pt-shadow-xl`):** `0 20px 25px -5px rgba(11, 18, 32, 0.15), 0 8px 10px -6px rgba(11, 18, 32, 0.08)`

---

## 4. Components

### 4.1 Buttons
* **Primary Giant Action:** Background `--pt-teal-700` (`#0F766E`), color `#FFFFFF`, font-weight 700. Hover state: `--pt-teal-800` (`#0B5D57`) with subtle `-1px` transform.
* **Secondary Outline:** Border `1px solid var(--pt-gray-300)`, background `#FFFFFF`, text `--pt-gray-800`. Hover state: background `--pt-gray-50`.
* **Dark Shell CTA:** Background `--pt-navy-900`, text `#FFFFFF`. Hover: `--pt-navy-800`.

### 4.2 Badges & Pills (`PtBadgeComponent`)
* **Live / Operational:** Background `var(--pt-teal-50)`, border `1px solid rgba(15, 118, 110, 0.2)`, text `var(--pt-teal-800)`.
* **Private / In-Browser:** Background `rgba(20, 33, 61, 0.06)`, text `var(--pt-navy-900)`.

### 4.3 Workspace Shell (`PtWorkspaceLayoutComponent`)
* Left/Center panel: Interactive document drag-and-drop workbench with grid alignment.
* Right sidebar: Action configuration panel (`380px` fixed desktop, full-width responsive mobile) with immediate parameter feedback and fixed conversion trigger button.

---

## 5. Motion & Accessibility

* **GSAP Animation Service:** Scoped via `gsap.context()` for clean Angular component lifecycle destruction.
* **Prefers-Reduced-Motion:** Guaranteed fallback for users with vestibular sensitivities or reduced motion settings via `(prefers-reduced-motion: reduce)`.
* **Focus States:** High-visibility dual-ring focus indicators (`outline: 2px solid var(--pt-teal-700); outline-offset: 2px;`).
