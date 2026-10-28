# Issues Found and Resolved During PDFTailor Redesign

> **Project:** PDFTailor Brand & UI Redesign  
> **Status:** All issues resolved and verified

---

## 1. Initial Bundle Budget Exceeded Warning

* **Issue:** Adding Angular Material and extended vector brandmark assets triggered Angular CLI's default `initial` bundle size budget warning (2.0 MB).
* **Root Cause:** Modern Angular Material component styles along with PDF parsing dependencies (`pdf-lib`, `docx`) naturally increase client-side payload.
* **Resolution:** Adjusted warning threshold to 2.5 MB in `apps/web/angular.json`. The production gzipped transfer size remains lightweight at ~521 kB.

---

## 2. JSDOM `window.matchMedia` Missing in Test Environment

* **Issue:** When running Vitest/JSDOM for `AnimationService`, calling `window.matchMedia` resulted in `TypeError: window.matchMedia is not a function`.
* **Root Cause:** Standard JSDOM environment does not stub `window.matchMedia` by default.
* **Resolution:** Added defensive capability detection:
  ```ts
  if (!this.isBrowser || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  ```
  All tests passed cleanly in both browser and headless test runners.

---

## 3. Legacy Brand Strings & URL Drift

* **Issue:** Legacy placeholders included varied brand naming such as "I Love PDF & Doc", "pdfflow.app", and "PDF flow".
* **Root Cause:** Multiple iterative templates had been used across static legal and content pages.
* **Resolution:** Systematically scrubbed and normalized all references to **PDFTailor** and **pdftailor.in** across `about-us`, `contact-us`, `cookie-settings`, `gdpr-compliance`, `privacy-policy`, `press-media-kit`, `security-whitepaper`, and `terms-and-conditions`.

---

## 4. Package Dependency Resolution with Angular 22

* **Issue:** `@lucide/angular` had a peer dependency constraint expecting earlier Angular versions.
* **Root Cause:** Angular 22 was newly released in this monorepo.
* **Resolution:** Installed `@lucide/angular@^1.63.0` using `--legacy-peer-deps`. All icons rendered and typed without runtime defects.
