import {
  PdfPageBoxMetrics,
  SIGN_PDF_FEATURES,
  SIGN_PDF_LIMITS,
  SignDateFormat,
  SignFieldElement,
  SignFieldType,
  SignStampShape
} from '@paperflow/contracts';

export { SIGN_PDF_FEATURES, SIGN_PDF_LIMITS };

export type SignWorkflowStage = 'upload' | 'editor' | 'processing' | 'completed';
export type SignModeChoice = 'only_me' | 'several_people';
export type SignTypeChoice = 'simple' | 'digital_certificate';
export type SignatureDialogTab = 'draw' | 'type' | 'upload';
export type SignatureDialogKind = 'signature' | 'initials';

export interface SavedSignatureRecord {
  id: string;
  kind: SignatureDialogKind;
  pngBlob: Blob;
  previewUrl?: string;
  label?: string;
  created: number;
}

export interface PdfInspectionSummary {
  pageCount: number;
  hasExistingDigitalSignatures: boolean;
  hasAcroFormFields: boolean;
  acroFormFieldCount: number;
  isEncrypted: boolean;
  pagesMeta: PdfPageBoxMetrics[];
}

export interface SignFieldPaletteItem {
  type: SignFieldType;
  label: string;
  required: boolean;
  description: string;
  defaultWidthPt: number;
  defaultHeightPt: number;
}

export const SIGN_FIELD_PALETTE: readonly SignFieldPaletteItem[] = [
  {
    type: 'signature',
    label: 'Signature',
    required: true,
    description: 'Your primary electronic signature',
    defaultWidthPt: 180,
    defaultHeightPt: 60
  },
  {
    type: 'initials',
    label: 'Initials',
    required: false,
    description: 'Initials derived or drawn',
    defaultWidthPt: 76,
    defaultHeightPt: 44
  },
  {
    type: 'name',
    label: 'Name',
    required: false,
    description: 'Full name as selectable text',
    defaultWidthPt: 160,
    defaultHeightPt: 26
  },
  {
    type: 'date',
    label: 'Date',
    required: false,
    description: 'Formatted signing date',
    defaultWidthPt: 120,
    defaultHeightPt: 26
  },
  {
    type: 'text',
    label: 'Text',
    required: false,
    description: 'Custom text annotation',
    defaultWidthPt: 170,
    defaultHeightPt: 28
  },
  {
    type: 'stamp',
    label: 'Company stamp',
    required: false,
    description: 'Image or custom seal stamp',
    defaultWidthPt: 120,
    defaultHeightPt: 120
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    required: false,
    description: 'Checkmark box field',
    defaultWidthPt: 24,
    defaultHeightPt: 24
  }
] as const;

export interface SignerDraft {
  id: string;
  name: string;
  email: string;
  orderIndex: number;
  color: string;
}

export const SIGNER_CHIP_COLORS = ['#0F766E', '#14213D', '#0284C7', '#D97706', '#7C3AED', '#DC2626', '#059669', '#4F46E5', '#C54E37', '#0369A1'] as const;

export interface SignExportOutcome {
  blob: Blob;
  url: string;
  filename: string;
  sizeBytes: number;
  formattedSize: string;
  fieldsApplied: number;
  pagesSigned: number[];
  warnings: string[];
  originalPageCount: number;
}

export interface AppliedPagesTarget {
  field: SignFieldElement;
  pages: number[];
}

export interface SignStampDraft {
  mode: 'build' | 'upload';
  line1: string;
  line2: string;
  shape: SignStampShape;
  color: string;
  uploadedDataUrl: string | null;
}

export interface DefaultDateOption {
  value: SignDateFormat;
  label: string;
}

export const SIGN_DATE_FORMAT_OPTIONS: readonly DefaultDateOption[] = [
  { value: 'dd/mm/yyyy', label: 'dd/mm/yyyy (11/11/2026)' },
  { value: 'mm/dd/yyyy', label: 'mm/dd/yyyy (11/11/2026)' },
  { value: 'd MMM yyyy', label: 'd MMM yyyy (11 Nov 2026)' },
  { value: 'yyyy-mm-dd', label: 'yyyy-mm-dd (2026-11-11)' },
  { value: 'd MMMM yyyy', label: '14 November 2026 (Long)' }
] as const;

/** Sanitizes a document filename preserving stem and appending `-signed.pdf`. */
export function buildSignedFilename(originalName: string): string {
  const cleaned = (originalName || 'document.pdf')
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'document';
  return `${cleaned}-signed.pdf`;
}

