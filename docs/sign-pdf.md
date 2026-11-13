# Sign PDF — Architecture, Security, Infrastructure Proposal & Compliance Guide

> **Feature Status**:
> - **Phase 1 ("Only me" — Browser-only simple electronic signature)**: **Live (`SIGN_PDF_FEATURES.signYourself = true`)**
> - **Phase 2 ("Several people" — Multi-signer requests & tracking)**: **Live (`SIGN_PDF_FEATURES.requestSignatures = true`; API enabled by default in dev/staging, opt-in `SIGN_REQUESTS_ENABLED=true` in production)**
> - **Phase 3 ("Digital signature (.p12 / .pfx)")**: **Live (`SIGN_PDF_FEATURES.digitalCertificate = true`; hybrid WebCrypto PBES2 browser signing + consented OpenSSL fallback for legacy 3DES)**

---

## 1. Architecture Overview

### Phase 1: Client-Side Signing (`/sign-pdf`)
- **Zero Server Uploads**: When a user selects **Only me**, 100% of PDF parsing, inspection, canvas rendering, signature creation, coordinate mapping, and final PDF export executes in browser memory (`ArrayBuffer` / `Uint8Array` / `Blob`). No network requests are issued during document signing.
- **Reused Edit PDF Primitives**:
  - `CoordinateTransformService` (delegating to `@paperflow/contracts`)
  - `CommandHistoryService` (undo/redo stack for add, move, resize, edit, delete, batch replicate)
  - `ViewportNavigationService`
  - `PdfThumbnailsPanelComponent` & `PdfBottomBarComponent`
  - `DropzoneComponent`, `ProcessingStateComponent`, `ResultViewComponent`, `PtAdSlotComponent`
- **Shared Core Exporter (`@paperflow/sign-core`)**:
  - Used identically by the Angular web client (`SignExportService`) and the Node Express API (`SignWorkflowService`) so field coordinates, rotations, PNG scaling, Unicode font embedding, and Certificates of Completion match bit-for-bit.
- **Offline Typography (`/fonts/sign/`)**:
  - 8 self-hosted OFL script fonts (`Caveat`, `Dancing Script`, `Great Vibes`, `Sacramento`, `Kalam` Latin + Devanagari, `Alex Brush`, `Satisfy`, `Patrick Hand`) + `Noto Sans` (Latin, Latin-Ext, Cyrillic, Devanagari, Arabic) bundled locally with `@pdf-lib/fontkit@1.1.1` + `regenerator-runtime/runtime`. Zero external Google Fonts fetches at runtime (strict CSP compliant).
- **Local IndexedDB Signature Book (`pdftailor-sign-db`)**:
  - Off by default; users opt in via *"Save this signature on this device"*. Supports deleting individual signatures or clearing all. Fails gracefully in private/restricted browser modes without blocking signing.

### Phase 2: Remote Multi-Party Signing (`/api/v1/sign/*`, `/sign-pdf`, `/sign/:token`)
- Controlled via `SIGN_PDF_FEATURES.requestSignatures` (frontend) and `isSignRequestsEnabled()` in `apps/api/src/config/env.ts` (enabled in non-production by default; requires explicit `SIGN_REQUESTS_ENABLED=true` in production).
- Designed around clean dependency-injected interfaces in `apps/api/src/services/sign/interfaces.ts` (`SigningRequestRepository`, `DocumentStorage`, `EmailService`, `Scheduler`).
- Uses disk-backed persistent storage (`apps/api/src/services/sign/disk-store.ts` -> `DiskSigningRequestRepository`, `DiskDocumentStorage`, `OutboxEmailService` writing under `SIGN_STORE_DIR` / `<TEMP_UPLOAD_DIR>/sign-store`) in runtime and `InMemory*` in `NODE_ENV=test` Jest specs.
- In `/sign-pdf`, selecting **Several people** unlocks recipient management (up to 10 recipients, sequential/parallel ordering, color-coded assignee badges on fields), a consented **Review & Send** modal (with optional 6-digit sender OTP verification), and a **Signature Request Tracker** (live status refresh, email update/resend, dev signing links when no SMTP server is configured, cancel, final PDF & audit certificate downloads).

---

## 2. Field Model & Coordinate Transforms (`0° / 90° / 180° / 270°` + `CropBox` + `UserUnit`)

Field placements (`SignFieldElement` in `packages/contracts/src/sign-pdf.ts`) store **canonical unrotated PDF user units** (`xPt`, `yPt`, `widthPt`, `heightPt`, bottom-left MediaBox origin):

1. Displayed page dimensions (`getPdfPageDisplaySize`):
   - Takes `page.widthPt`, `page.heightPt` (CropBox extents), swaps axes for `90°`/`270°`, multiplies by `page.userUnit ?? 1.0` and `zoom`.
2. Screen-to-PDF conversion (`screenPointToPdfPointCoords`) & inverse (`pdfPointToScreenPointCoords`):
   - Accounts for `cropBoxXPt`, `cropBoxYPt`, page rotation (`0`, `90`, `180`, `270`), `userUnit`, and zoom/DPR.
   - Tested empirically against `pdfjs-dist` `page.getViewport({ scale }).convertToPdfPoint(...)` across all four rotations, non-zero CropBox `[50, 100, 650, 820]`, and `UserUnit = 2.0`, achieving `<= 0.5 pt` accuracy.
3. Export Rotation Compensation (`@paperflow/sign-core`):
   - `pdf-lib` `drawImage` / `drawText` rotate around their origin relative to unrotated PDF user coordinates, so `@paperflow/sign-core` computes each rotated bounding anchor and applies `rotate: degrees(normRot)` so text, images, stamps, and vector checkmarks render upright in PDF viewers.

---

## 3. Export Mapping & Known Limitations

- **Field Mapping**:
  - `signature`, `initials`, `stamp`: embedded PNG images (`<= 3× @ 300 DPI` alpha-preserving downscale), optional caption (`"Signed by <name> · <date>"`).
  - `name`, `date`, `text`: selectable PDF text streams subset with `Noto Sans` or chosen script font; falls back transparently to crisp high-DPI PNG rasterization if a rare Unicode script glyph lacks font coverage.
  - `checkbox`: vector rectangle + vector checkmark strokes.
- **AcroForm Flattening**: Optional (`flattenFormFields` toggle when interactive form fields are detected).
- **Existing Cryptographic Signatures (`/ByteRange` & `/Sig`)**: Detected on load; user must confirm before entering the editor because re-saving a visual signature invalidates prior cryptographic signatures.
- **Encrypted PDFs**: Password prompt unlocks for viewing via `pdfjs-dist` in memory; re-exported output is **unencrypted** and displays a clear warning banner because `pdf-lib` does not preserve encryption passwords.
- **Simple vs Qualified Signatures**: Phase 1 & Phase 2 provide **simple visual electronic signatures** (plus Phase 2 tamper-evident audit trail), **not** QES, PAdES-LTV, or Aadhaar eSign certificates.

---

## 4. Phase 2 Infrastructure Options Proposal (Before Enabling in Production)

Currently `apps/api` contains **no database, object storage, SMTP provider, or persistent job queue**. Do not set `SIGN_REQUESTS_ENABLED=true` in production until adapters implementing `apps/api/src/services/sign/interfaces.ts` are wired to persistent infra:

| Layer | Option A (Low-Cost / MVP) | Option B (Scalable Cloud Prod) | Estimated Monthly Cost (10k reqs/mo) |
| :--- | :--- | :--- | :--- |
| **Database (`SigningRequestRepository`)** | Managed PostgreSQL (Neon / Supabase / RDS t4g.micro) | Aurora PostgreSQL / Cloud SQL HA with point-in-time recovery | A: \$0–\$19/mo · B: \$45–\$120/mo |
| **Encrypted Document Storage (`DocumentStorage`)** | Cloudflare R2 or AWS S3 + KMS CMK + app-level AES-256-GCM DEK | AWS S3 multi-region w/ Object Lock + KMS envelope keys | A: \$1–\$5/mo · B: \$10–\$25/mo |
| **Transactional Email (`EmailService`)** | Postmark / Resend (verified SPF, DKIM, DMARC) | Amazon SES dedicated IP / Postmark Enterprise | A: \$15/mo · B: \$10–\$35/mo |
| **Delayed Jobs (`Scheduler`)** | `pg-boss` inside PostgreSQL (zero extra broker!) | Redis + BullMQ or GCP Cloud Tasks | A: \$0 extra · B: \$15–\$30/mo |

**Local / Docker Dev Stack**:
- `docker-compose.yml` running `postgres:16-alpine` + `minio` (S3-compatible) + `mailpit` (SMTP UI on `localhost:8025`), paired with `.env` `SIGN_MASTER_KEY` (64 hex chars).

---

## 5. Phase 2 State Machine, Security & Audit Trail

### State Transitions
- **Request Status**: `draft` → `in_progress` → `completed` | `declined` | `cancelled` | `expired`
- **Signer Status**: `pending` (sequential queue) → `sent` → `opened` → `signed` | `declined` | `cancelled` | `expired`
- **Sequential Order Guard**: Signers with `orderIndex > lowestUnsignedOrderIndex` receive `409 NOT_YOUR_TURN` until earlier signers finish; upon completion, the next signer automatically receives a fresh 256-bit token & email.
- **Single-Use & Rotation**: Completing revokes the signer token immediately (`404 LINK_INVALID` on reuse). `POST /requests/:id/resend` (including changing signer email) revokes the old token hash before issuing a new token. Declining cancels all other pending signers.

### Cryptography & Abuse Controls
- **Bearer Tokens**: 256-bit `crypto.randomBytes(32).toString('base64url')`. Only **HMAC-SHA256** digests keyed by `SIGN_MASTER_KEY` are stored; comparisons use `crypto.timingSafeEqual`.
- **Encryption at Rest**: Fresh random 256-bit DEK per PDF (`aes-256-gcm`, 12-byte IV, auth tag), with DEK wrapped by `SIGN_MASTER_KEY`.
- **Audit Chain**: Append-only `AuditLogEntry` list (`created`, `sent`, `resent`, `opened`, `viewed`, `consent_given`, `field_completed`, `signed`, `declined`, `expired`, `cancelled`, `downloaded`) linked by `prevHash` + SHA-256 `entryHash` (`verifyAuditChain()`).
- **Certificate of Completion**: Appended by `@paperflow/sign-core` (`appendCertificateOfCompletionPage`) containing request ID, title, sender, original & final SHA-256 hashes, signer metadata + UTC timestamps + IP/User-Agent, and audit events.
- **Upload Sanitization (`sanitise-pdf.ts`)**: Enforces `%PDF-` header, `<= 25 MB`, `<= 100 pages`, rejects encrypted PDFs (`422`), strips `/JS`, `/JavaScript`, `/OpenAction`, `/AA`, `/Launch`, `/EmbeddedFiles`, `/SubmitForm`, `/ImportData`.
- **Email & Browser Safety**: CRLF header stripping, strict HTML escaping, `Reply-To = senderEmail`, zero tracking pixels, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, double-submit CSRF cookie/header protection (`pt_csrf` + `x-csrf-token`), rate limits + sender quotas (`10/hr`, `50/day`), sender 6-digit OTP (`10m` expiry, `5` attempts max → `429 OTP_LOCKED`), retention sweep (`30d` completed, `14d` inactive), GDPR export & hard delete.

---

## 6. Legal & Compliance Notes (Pre-Launch Checklist)

- **US (ESIGN Act & UETA)**: Requires affirmative intent to sign, clear disclosure + consent to electronic records (`consentGiven` checkbox + timestamped audit log), attribution, and downloadable copy retention for all parties.
- **EU (eIDAS Regulation 910/2014)** & **UK (ECA 2000)**: Phase 1 & Phase 2 qualify as **Simple Electronic Signatures (SES)**—legally admissible for standard NDAs, HR agreements, vendor contracts, and commercial approvals, though NOT equivalent to Advanced (AdES) or Qualified (QES) signatures where statutory formalities mandate qualified certificates (e.g., certain real-estate deeds or statutory corporate filings).
- **India (IT Act 2000)**: Electronic signatures under Section 3/3A vs **Aadhaar eSign / DSC**; legal notices clearly state this is a visual electronic signature and not Aadhaar eSign / CCA certificate signing.
- **Pre-Launch Counsel Review Checklist**:
  1. Confirm country-by-country excluded document disclosures (wills, trusts, negotiable instruments, powers of attorney, real property conveyances).
  2. Review Privacy Policy / DPA subprocessor list (DB, encrypted object storage, email provider, retention periods).
  3. Approve electronic disclosure consent wording shown before `"Finish Signing"`.
  4. Verify log redaction, breach notification SLA, and GDPR/CCPA erasure automation against production storage logs.

---

## 7. Phase 3 Architecture (`Digital signature (certificate)`)

- **Flag**: `SIGN_PDF_FEATURES.digitalCertificate = true`
- **Zero-Upload Primary Path (`@paperflow/sign-core`: `pkcs12-browser.ts` & `pades.ts`)**:
  1. Pure TypeScript ASN.1 BER/DER parser + WebCrypto PBES2 (`PBKDF2-SHA1/256/384/512` + `AES-128/192/256-CBC`) extracts the leaf certificate chain and PKCS#8 RSA/ECDSA private key directly in browser memory.
  2. ISO 32000 PAdES writer (`applyDetachedPdfSignature`) injects `/FT /Sig`, `/Filter /Adobe.PPKLite`, `/SubFilter /adbe.pkcs7.detached`, and computes `/ByteRange` + `/Contents <...>` 16,384-hex placeholder.
  3. Builds DER-encoded CMS `SignedData` (`RSASSA-PKCS1-v1_5` SHA-256 or ECDSA `P-256`/`P-384` DER) with zero external dependencies and zero server network requests.
- **Consented Legacy Fallback (`POST /api/v1/sign/certificate-sign` + `apps/api/src/services/sign/certificate-sign.ts`)**:
  - When a user provides a legacy 3DES/RC2 `.p12`/`.pfx` that WebCrypto cannot decrypt (`UnsupportedPkcs12CipherError`), the UI prompts via `UploadConsentService`. Upon explicit consent, `apps/api` executes LibreSSL `/usr/bin/openssl` inside an isolated `0o700` temp directory immediately scrubbed in `finally {}` and returns the signed PDF alongside `X-Signer-CN` and `X-Signer-Issuer` headers.
- **Verification**: Both browser WebCrypto and OpenSSL `.p12` PAdES outputs pass `openssl cms -verify -binary` and detect single-byte document tampering.

---

## 8. Environment Flags & Testing

### Environment Variables (`apps/api`)
- `SIGN_REQUESTS_ENABLED`: Defaults to `true` in non-production environments and `false` in `production` (set `SIGN_REQUESTS_ENABLED=true` explicitly for production multi-signer requests)
- `SIGN_STORE_DIR`: Optional directory path for persistent disk store (defaults to `<TEMP_UPLOAD_DIR>/sign-store`)
- `SIGN_MASTER_KEY` (required 32+ char / 64-hex secret in production when enabled; persisted local dev key or ephemeral fallback in dev/test)
- `APP_PUBLIC_URL=http://localhost:4200`
- `SIGN_REQUIRE_SENDER_OTP=false` (optional global header/env enforcement)
- Swap `Disk*` adapters in `apps/api/src/routes/sign.route.ts` with PostgreSQL + S3/R2 + SMTP env adapters for multi-instance cloud HA.

### Running Automated Tests
```bash
# 1. Build shared contracts & sign-core engine
npm run build:contracts

# 2. Backend API Jest + supertest suite (PAdES/OpenSSL, multi-signer state machine, crypto, disk persistence)
npm --workspace=apps/api run test

# 3. Frontend Sign PDF Vitest suite (core services, component state/a11y, /sign/:token, routing)
npm --workspace=apps/web test
```

---

## 9. Enhanced Fields, WYSIWYG Engine & Sidebar Redesign

### Field Model Extensions & Backward Compatibility
- **`SignFieldElement` enhancements**:
  - `textConfig`: `{ content: string, fontFamily?, fontSize: number, color: string, bold?: boolean, italic?: boolean, underline?: boolean, align: 'left'|'center'|'right', lineHeight: number, opacity: number, autoGrow: boolean, boxWidth?: number }`.
  - `stampSource`: `{ kind: 'text', lines: string[], shape: 'rect'|'rounded'|'circle', color: string, borderWidth?: number, fontFamily?: string } | { kind: 'image', originalBlobId?, processedBlobId?, originalDataUrl?, processedDataUrl?, removeBackground?: boolean, tolerance?: number }`. Stores source definition for lossless re-editing.
  - `templateId`: Shared UUID linking placed stamp copies across pages so editing one stamp can update all copies simultaneously.
  - `checkboxConfig`: `{ checked: boolean, mark: 'tick'|'cross'|'dot', boxSize: number, label?: { content: string, fontFamily?, fontSize?: number, color?: string, bold?: boolean, italic?: boolean }, labelPosition: 'right'|'left', groupId?: string }`.
- **Normalization Migration**: `normalizeSignFieldElement()` in `@paperflow/contracts` migrates older persisted fields on load so existing saved documents and local storage retain full compatibility without data loss.

### WYSIWYG Multi-Line Text Engine & Character Decoding
- **Shared Fontkit Layout (`computeTextLayout`)**:
  - Computes deterministic word wrapping, long-word character splitting, line heights, and alignment horizontal offsets (`left`, `center`, `right`) based on font metrics.
  - Reused by both canvas DOM rendering and PDF export (`exportSignedPdf`), guaranteeing that line wraps and visual positioning in the exported PDF match canvas preview within 1 pt.
  - Supports vector underline rendering, font opacity, and subset font embedding.
- **ISO 32000-1 Decoding & Mojibake Repair**:
  - `decodePdfTextString`: Decodes UTF-16BE BOM, UTF-8 BOM, strict UTF-8, and PDFDocEncoding Annex D (maps `0x96` to en dash `–`).
  - `repairMojibakeFilename`: Corrects common double-encoding artifacts (e.g. `Auction Portal à Impulse Decision…` $\to$ `Auction Portal – Impulse Decision…`).

### Company Stamp Re-editing & Templates
- Placed stamps can be re-edited via double-click, Enter/F2, canvas quick toolbar "Edit", or Selected Field panel.
- Stamp dialog pre-fills from `stampSource`: text stamps show editable lines/shape/color; image stamps expose background removal tolerance, replace image, and remove image.
- Scope selector: When multiple copies share a `templateId`, users can choose between *"Update all copies"* (default) or *"Update this stamp only"*.
- Device storage: IndexedDB `stamps` store (`pdftailor-sign-db` v2) stores custom and default stamps locally with zero cloud upload.

### Composite Checkbox with Label & Stacked Options
- Placed checkbox forms a composite vector box + editable inline label (`labelPosition: 'right' | 'left'`).
- Toggled via Space key, canvas click, or Selected Field panel "Checked" switch.
- Mark styles: `tick` (checkmark), `cross` (X mark), or `dot` (radio-style bullet).
- "+ Add another option" button on the field and in the sidebar stacks subsequent checkboxes 8 pt below with group alignment.

### Sidebar Redesign
- **Sticky Header**: Solid background and bottom border; content scrolls cleanly beneath it with zero overlap.
- **Optional Fields Grid**: Compact 2-column grid (44 px tile height, 8 px gap) with hover/focus drag handles, placed count badges (`×2`), and secondary lines for configured values.
- **Dedicated Selected Field Card**: Contextual property inspector for typography (bundled fonts, sizes, swatches, B/I/U, alignment, opacity), checkbox options, and stamp copy controls.
- **Collapsible Details & Options**: Accordion keeping signer metadata compact and uncluttered.
- **Unclipped Scroll Container**: `min-height: 0; overflow-y: auto; padding-bottom: 48px;` ensuring footer buttons never cover any options on any screen resolution.


