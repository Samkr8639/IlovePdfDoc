import { z } from 'zod';

/** Feature toggles governing Sign PDF capabilities across phases. */
export interface SignPdfFeatureFlags {
  readonly signYourself: boolean;
  readonly requestSignatures: boolean;
  readonly digitalCertificate: boolean;
}

export const SIGN_PDF_FEATURES: SignPdfFeatureFlags = {
  signYourself: true,
  requestSignatures: true,
  digitalCertificate: true
} as const;

export const SIGN_PDF_LIMITS = {
  clientMaxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
  clientMaxPages: 500,
  maxImageSizeBytes: 5 * 1024 * 1024, // 5 MB
  maxImageDimensionPx: 4000,
  serverMaxFileSizeBytes: 25 * 1024 * 1024, // 25 MB
  serverMaxPages: 100,
  maxSigners: 10,
  maxMessageLength: 1000,
  maxTitleLength: 200,
  minExpiryDays: 1,
  maxExpiryDays: 60,
  defaultExpiryDays: 14,
  reminderIntervalDays: 3,
  dailyQuotaPerSender: 5,
  retentionCompletedDays: 30,
  retentionClosedDays: 14
} as const;

export type SignFieldType =
  | 'signature'
  | 'initials'
  | 'name'
  | 'date'
  | 'text'
  | 'stamp'
  | 'checkbox';

export type SignDateFormat =
  | 'dd/mm/yyyy'
  | 'mm/dd/yyyy'
  | 'd MMM yyyy'
  | 'yyyy-mm-dd'
  | 'd MMMM yyyy';

export interface SignFontDescriptor {
  id: string;
  name: string;
  cssFamily: string;
  woffFile: string;
  supportsDevanagari: boolean;
  isScript: boolean;
}

export const SIGN_SCRIPT_FONTS: readonly SignFontDescriptor[] = [
  {
    id: 'caveat',
    name: 'Caveat',
    cssFamily: "'SignCaveat', cursive",
    woffFile: 'caveat-latin-600-normal.woff',
    supportsDevanagari: false,
    isScript: true
  },
  {
    id: 'dancing-script',
    name: 'Dancing Script',
    cssFamily: "'SignDancingScript', cursive",
    woffFile: 'dancing-script-latin-600-normal.woff',
    supportsDevanagari: false,
    isScript: true
  },
  {
    id: 'great-vibes',
    name: 'Great Vibes',
    cssFamily: "'SignGreatVibes', cursive",
    woffFile: 'great-vibes-latin-400-normal.woff',
    supportsDevanagari: false,
    isScript: true
  },
  {
    id: 'sacramento',
    name: 'Sacramento',
    cssFamily: "'SignSacramento', cursive",
    woffFile: 'sacramento-latin-400-normal.woff',
    supportsDevanagari: false,
    isScript: true
  },
  {
    id: 'kalam',
    name: 'Kalam (Latin & Devanagari)',
    cssFamily: "'SignKalam', 'SignKalamDevanagari', cursive",
    woffFile: 'kalam-latin-400-normal.woff',
    supportsDevanagari: true,
    isScript: true
  },
  {
    id: 'alex-brush',
    name: 'Alex Brush',
    cssFamily: "'SignAlexBrush', cursive",
    woffFile: 'alex-brush-latin-400-normal.woff',
    supportsDevanagari: false,
    isScript: true
  },
  {
    id: 'satisfy',
    name: 'Satisfy',
    cssFamily: "'SignSatisfy', cursive",
    woffFile: 'satisfy-latin-400-normal.woff',
    supportsDevanagari: false,
    isScript: true
  },
  {
    id: 'patrick-hand',
    name: 'Patrick Hand',
    cssFamily: "'SignPatrickHand', cursive",
    woffFile: 'patrick-hand-latin-400-normal.woff',
    supportsDevanagari: false,
    isScript: true
  }
] as const;

export const SIGN_FALLBACK_FONT_FILES = {
  kalamDevanagari: 'kalam-devanagari-400-normal.woff',
  notoLatin: 'noto-sans-latin-400-normal.woff',
  notoLatinExt: 'noto-sans-latin-ext-400-normal.woff',
  notoCyrillic: 'noto-sans-cyrillic-400-normal.woff',
  notoDevanagari: 'noto-sans-devanagari-devanagari-400-normal.woff',
  notoArabic: 'noto-sans-arabic-arabic-400-normal.woff'
} as const;

export type SignStampShape = 'rectangle' | 'rounded' | 'circle';

export interface SignFieldElement {
  id: string;
  pageIndex: number;
  type: SignFieldType;
  /** X in unrotated PDF user units (bottom-left MediaBox origin, incl. CropBox offset). */
  xPt: number;
  /** Y in unrotated PDF user units (bottom-left MediaBox origin, incl. CropBox offset). */
  yPt: number;
  widthPt: number;
  heightPt: number;
  rotation?: number;
  zIndex?: number;
  signerId?: string;
  required?: boolean;
  /** Base64 PNG data URL for signature/initials/stamp images. */
  imageDataUrl?: string;
  /** Optional text value for name/date/text/typed signature/initials/stamp. */
  text?: string;
  fontId?: string;
  fontSizePt?: number;
  color?: string;
  dateFormat?: SignDateFormat;
  checked?: boolean;
  stampShape?: SignStampShape;
  stampLine2?: string;
  /** Optional caption rendered beneath a signature field ("Signed by <name> · <date>"). */
  showSigningDetailsLine?: boolean;
  signingDetailsText?: string;
}

export interface PdfPageBoxMetrics {
  pageIndex: number;
  /** Visible CropBox width in unrotated PDF points. */
  widthPt: number;
  /** Visible CropBox height in unrotated PDF points. */
  heightPt: number;
  /** Page rotation in degrees (0, 90, 180, 270). */
  rotation: number;
  /** CropBox X offset from MediaBox origin (default 0). */
  cropBoxXPt?: number;
  /** CropBox Y offset from MediaBox origin (default 0). */
  cropBoxYPt?: number;
  /** PDF page UserUnit multiplier (default 1.0). */
  userUnit?: number;
}

export interface PdfScreenPoint {
  x: number;
  y: number;
}

export interface PdfCoordPoint {
  xPt: number;
  yPt: number;
}

export interface PdfScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfCoordRect {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

export function normalizePageRotation(rotation: number): 0 | 90 | 180 | 270 {
  const norm = ((Math.round(rotation) % 360) + 360) % 360;
  if (norm === 90 || norm === 180 || norm === 270) return norm;
  return 0;
}

/** Returns rendered canvas display size in CSS pixels at the given zoom (already accounting for rotation and UserUnit). */
export function getPdfPageDisplaySize(page: PdfPageBoxMetrics, zoom = 1.0): { width: number; height: number } {
  const safeZoom = Math.max(0.1, zoom);
  const unit = Math.max(0.1, page.userUnit ?? 1.0);
  const rot = normalizePageRotation(page.rotation);
  const sideways = rot === 90 || rot === 270;
  const wPt = (sideways ? page.heightPt : page.widthPt) * unit;
  const hPt = (sideways ? page.widthPt : page.heightPt) * unit;
  return {
    width: Math.round(wPt * safeZoom),
    height: Math.round(hPt * safeZoom)
  };
}

/** Converts CSS screen coordinates (top-left of rendered CropBox canvas) to PDF user units (bottom-left MediaBox origin). */
export function screenPointToPdfPointCoords(
  screen: PdfScreenPoint,
  page: PdfPageBoxMetrics,
  zoom = 1.0,
  dpr = 1.0
): PdfCoordPoint {
  const safeScale = Math.max(0.1, zoom) * Math.max(0.1, page.userUnit ?? 1.0) * Math.max(0.1, dpr);
  const ux = screen.x / safeScale;
  const uy = screen.y / safeScale;
  const cropX = page.cropBoxXPt ?? 0;
  const cropY = page.cropBoxYPt ?? 0;
  const rot = normalizePageRotation(page.rotation);

  switch (rot) {
    case 90:
      return { xPt: cropX + uy, yPt: cropY + ux };
    case 180:
      return { xPt: cropX + (page.widthPt - ux), yPt: cropY + uy };
    case 270:
      return { xPt: cropX + (page.widthPt - uy), yPt: cropY + (page.heightPt - ux) };
    case 0:
    default:
      return { xPt: cropX + ux, yPt: cropY + (page.heightPt - uy) };
  }
}

/** Converts PDF user units (bottom-left MediaBox origin) to screen pixels (top-left of rendered CropBox canvas). */
export function pdfPointToScreenPointCoords(
  pdf: PdfCoordPoint,
  page: PdfPageBoxMetrics,
  zoom = 1.0,
  dpr = 1.0
): PdfScreenPoint {
  const safeScale = Math.max(0.1, zoom) * Math.max(0.1, page.userUnit ?? 1.0) * Math.max(0.1, dpr);
  const lx = pdf.xPt - (page.cropBoxXPt ?? 0);
  const ly = pdf.yPt - (page.cropBoxYPt ?? 0);
  const rot = normalizePageRotation(page.rotation);

  let ux = 0;
  let uy = 0;
  switch (rot) {
    case 90:
      ux = ly;
      uy = lx;
      break;
    case 180:
      ux = page.widthPt - lx;
      uy = ly;
      break;
    case 270:
      ux = page.heightPt - ly;
      uy = page.widthPt - lx;
      break;
    case 0:
    default:
      ux = lx;
      uy = page.heightPt - ly;
      break;
  }

  return {
    x: ux * safeScale,
    y: uy * safeScale
  };
}

export function screenRectToPdfRectCoords(
  rect: PdfScreenRect,
  page: PdfPageBoxMetrics,
  zoom = 1.0,
  dpr = 1.0
): PdfCoordRect {
  const p1 = screenPointToPdfPointCoords({ x: rect.x, y: rect.y }, page, zoom, dpr);
  const p2 = screenPointToPdfPointCoords({ x: rect.x + rect.width, y: rect.y + rect.height }, page, zoom, dpr);
  const minX = Math.min(p1.xPt, p2.xPt);
  const minY = Math.min(p1.yPt, p2.yPt);
  const maxX = Math.max(p1.xPt, p2.xPt);
  const maxY = Math.max(p1.yPt, p2.yPt);
  return {
    xPt: minX,
    yPt: minY,
    widthPt: Math.max(1, maxX - minX),
    heightPt: Math.max(1, maxY - minY)
  };
}

export function pdfRectToScreenRectCoords(
  rect: PdfCoordRect,
  page: PdfPageBoxMetrics,
  zoom = 1.0,
  dpr = 1.0
): PdfScreenRect {
  const topLeft = pdfPointToScreenPointCoords({ xPt: rect.xPt, yPt: rect.yPt + rect.heightPt }, page, zoom, dpr);
  const bottomRight = pdfPointToScreenPointCoords({ xPt: rect.xPt + rect.widthPt, yPt: rect.yPt }, page, zoom, dpr);
  const minX = Math.min(topLeft.x, bottomRight.x);
  const minY = Math.min(topLeft.y, bottomRight.y);
  const maxX = Math.max(topLeft.x, bottomRight.x);
  const maxY = Math.max(topLeft.y, bottomRight.y);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

/** Splits grapheme clusters safely (handles Devanagari matras/virama & emoji surrogates). */
function firstGrapheme(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    for (const s of seg.segment(trimmed)) {
      if (s.segment && /\p{L}|\p{N}/u.test(s.segment)) {
        return s.segment;
      }
    }
  }
  const chars = Array.from(trimmed).filter(c => /\p{L}|\p{N}/u.test(c));
  return chars[0] || '';
}

/**
 * Unicode-aware initials extraction:
 * - Splits whitespace & hyphens (`Jean-Luc Picard` -> `JLP`)
 * - Single word (`Alice` -> `A` or `AL`? Single initial uppercase `A`)
 * - Handles Devanagari clusters without tearing combining vowel signs
 */
export function deriveInitials(fullName: string): string {
  const clean = (fullName || '').trim();
  if (!clean) return '';
  const tokens = clean.split(/[\s\-_]+/).filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    const g = firstGrapheme(tok);
    if (g) {
      out.push(g.toLocaleUpperCase());
    }
    if (out.length >= 4) break;
  }
  return out.join('');
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatSigningDate(date: Date, format: SignDateFormat): string {
  const d = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = d.getDate();
  const dd = String(day).padStart(2, '0');
  const monthIdx = d.getMonth();
  const mm = String(monthIdx + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());

  switch (format) {
    case 'dd/mm/yyyy':
      return `${dd}/${mm}/${yyyy}`;
    case 'mm/dd/yyyy':
      return `${mm}/${dd}/${yyyy}`;
    case 'yyyy-mm-dd':
      return `${yyyy}-${mm}-${dd}`;
    case 'd MMMM yyyy':
      return `${day} ${MONTH_LONG[monthIdx]} ${yyyy}`;
    case 'd MMM yyyy':
    default:
      return `${day} ${MONTH_SHORT[monthIdx]} ${yyyy}`;
  }
}

export function getDefaultDateFormatForLocale(locale?: string): SignDateFormat {
  const loc = (locale || (typeof navigator !== 'undefined' ? navigator.language : '') || '').toLowerCase();
  if (loc.startsWith('en-us')) return 'mm/dd/yyyy';
  if (loc.startsWith('ja') || loc.startsWith('zh') || loc.startsWith('ko') || loc.startsWith('sv')) return 'yyyy-mm-dd';
  if (loc.startsWith('en-gb') || loc.startsWith('en-in') || loc.startsWith('hi') || loc.startsWith('de') || loc.startsWith('fr')) {
    return 'dd/mm/yyyy';
  }
  return 'd MMM yyyy';
}

/** Parses human page range like `1, 3-5` into sorted zero-based unique page indices. */
export function parsePageRange(input: string, totalPages: number): { pages: number[]; error?: string } {
  const clean = (input || '').trim();
  if (!clean) {
    return { pages: [], error: 'Enter page numbers or ranges (for example 1, 3-5).' };
  }
  const seen = new Set<number>();
  const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (a < 1 || b < 1 || a > totalPages || b > totalPages || a > b) {
        return { pages: [], error: `Invalid range "${part}". Valid pages: 1–${totalPages}.` };
      }
      for (let p = a; p <= b; p++) seen.add(p - 1);
    } else if (/^\d+$/.test(part)) {
      const p = Number(part);
      if (p < 1 || p > totalPages) {
        return { pages: [], error: `Page ${p} is out of bounds (1–${totalPages}).` };
      }
      seen.add(p - 1);
    } else {
      return { pages: [], error: `Invalid token "${part}". Use numbers and ranges like 1, 3-5.` };
    }
  }
  return { pages: Array.from(seen).sort((a, b) => a - b) };
}

/* =========================================================================
   PHASE 2 API CONTRACTS & ERROR CODES (Request Signatures from Others)
   ========================================================================= */

export const SIGN_ERROR_CODES = {
  UNSUPPORTED_FILE: { code: 'UNSUPPORTED_FILE', status: 415 },
  FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', status: 413 },
  TOO_MANY_PAGES: { code: 'TOO_MANY_PAGES', status: 413 },
  ENCRYPTED_DOCUMENT: { code: 'ENCRYPTED_DOCUMENT', status: 422 },
  INVALID_OPTIONS: { code: 'INVALID_OPTIONS', status: 400 },
  TOO_MANY_SIGNERS: { code: 'TOO_MANY_SIGNERS', status: 400 },
  INVALID_EMAIL: { code: 'INVALID_EMAIL', status: 400 },
  OTP_INVALID: { code: 'OTP_INVALID', status: 401 },
  OTP_LOCKED: { code: 'OTP_LOCKED', status: 429 },
  LINK_INVALID: { code: 'LINK_INVALID', status: 404 },
  NOT_YOUR_TURN: { code: 'NOT_YOUR_TURN', status: 409 },
  ALREADY_COMPLETED: { code: 'ALREADY_COMPLETED', status: 409 },
  REQUEST_CANCELLED: { code: 'REQUEST_CANCELLED', status: 410 },
  REQUEST_EXPIRED: { code: 'REQUEST_EXPIRED', status: 410 },
  RATE_LIMITED: { code: 'RATE_LIMITED', status: 429 },
  QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', status: 429 },
  EMAIL_FAILED: { code: 'EMAIL_FAILED', status: 502 },
  SERVER_BUSY: { code: 'SERVER_BUSY', status: 503 }
} as const;

export type SignRequestOrder = 'parallel' | 'sequential';
export type SignRequestStatus = 'draft' | 'in_progress' | 'completed' | 'declined' | 'cancelled' | 'expired';
export type SignerStatus = 'pending' | 'sent' | 'opened' | 'signed' | 'declined' | 'expired' | 'cancelled';

export type AuditEventType =
  | 'created'
  | 'sent'
  | 'resent'
  | 'delivered'
  | 'bounced'
  | 'opened'
  | 'viewed'
  | 'consent_given'
  | 'field_completed'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'downloaded'
  | 'deleted';

export interface AuditLogEntry {
  seq: number;
  eventType: AuditEventType;
  timestampUtc: string;
  requestId: string;
  signerId?: string;
  signerEmail?: string;
  ip?: string;
  userAgent?: string;
  detail?: string;
  prevHash: string;
  entryHash: string;
}

export const SignerInputSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  orderIndex: z.number().int().min(0).max(20).default(0),
  color: z.string().max(32).optional()
});

export const SignFieldPlacementSchema = z.object({
  id: z.string().min(1).max(64),
  pageIndex: z.number().int().min(0).max(500),
  type: z.enum(['signature', 'initials', 'name', 'date', 'text', 'stamp', 'checkbox']),
  xPt: z.number().finite(),
  yPt: z.number().finite(),
  widthPt: z.number().finite().positive().max(2000),
  heightPt: z.number().finite().positive().max(2000),
  rotation: z.number().finite().optional(),
  zIndex: z.number().int().optional(),
  signerId: z.string().min(1).max(64).optional(),
  required: z.boolean().optional(),
  imageDataUrl: z.string().max(8_000_000).optional(),
  text: z.string().max(1000).optional(),
  fontId: z.string().max(64).optional(),
  fontSizePt: z.number().min(6).max(144).optional(),
  color: z.string().max(32).optional(),
  dateFormat: z.enum(['dd/mm/yyyy', 'mm/dd/yyyy', 'd MMM yyyy', 'yyyy-mm-dd', 'd MMMM yyyy']).optional(),
  checked: z.boolean().optional(),
  stampShape: z.enum(['rectangle', 'rounded', 'circle']).optional(),
  stampLine2: z.string().max(200).optional(),
  showSigningDetailsLine: z.boolean().optional(),
  signingDetailsText: z.string().max(200).optional()
});

export const CreateSignRequestSchema = z.object({
  senderName: z.string().trim().min(1).max(120),
  senderEmail: z.string().trim().email().max(254),
  title: z.string().trim().min(1).max(SIGN_PDF_LIMITS.maxTitleLength),
  message: z.string().trim().max(SIGN_PDF_LIMITS.maxMessageLength).optional().default(''),
  order: z.enum(['parallel', 'sequential']).default('parallel'),
  expiryDays: z.number().int().min(SIGN_PDF_LIMITS.minExpiryDays).max(SIGN_PDF_LIMITS.maxExpiryDays).default(SIGN_PDF_LIMITS.defaultExpiryDays),
  remindersEnabled: z.boolean().default(true),
  requireSignerOtp: z.boolean().default(false),
  signers: z.array(SignerInputSchema).min(1).max(SIGN_PDF_LIMITS.maxSigners),
  fields: z.array(SignFieldPlacementSchema).min(1)
});

export type CreateSignRequestInput = z.infer<typeof CreateSignRequestSchema>;

export interface ApiFeaturesData {
  signRequestsEnabled: boolean;
}

