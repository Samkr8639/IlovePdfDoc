import { z } from 'zod';

/**
 * Feature execution runtime environment
 */
export type FeatureRunEnvironment = 'browser' | 'server';

/**
 * Unique identifiers for all tools within the Edit PDF workspace
 */
export type EditPdfFeatureId =
  | 'select'
  | 'text'
  | 'image'
  | 'draw'
  | 'shapes'
  | 'highlight'
  | 'whiteout'
  | 'sign'
  | 'link'
  | 'ocr';

/**
 * Feature Category in the Edit PDF sidebar
 */
export type EditPdfFeatureCategory = 'tools' | 'cloud_tools';

/**
 * Configuration definition for an individual Edit PDF feature tool
 */
export interface EditPdfFeatureConfig {
  id: EditPdfFeatureId;
  name: string;
  icon: string;
  category: EditPdfFeatureCategory;
  runsOn: FeatureRunEnvironment;
  flag?: string;
  tooltip?: string;
  description?: string;
}

/**
 * Typed registry of all features available within the Edit PDF tool
 */
export const EDIT_PDF_FEATURES: readonly EditPdfFeatureConfig[] = [
  // 1. Core Browser Editing Tools
  {
    id: 'select',
    name: 'Select',
    icon: 'pointer',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Select and transform objects'
  },
  {
    id: 'text',
    name: 'Text',
    icon: 'type',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Add new text anywhere on page'
  },
  {
    id: 'image',
    name: 'Image',
    icon: 'image',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Insert images (PNG, JPG, SVG)'
  },
  {
    id: 'draw',
    name: 'Draw',
    icon: 'edit-3',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Freehand pen & annotations'
  },
  {
    id: 'shapes',
    name: 'Shapes',
    icon: 'square',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Rectangles, circles, and lines'
  },
  {
    id: 'highlight',
    name: 'Highlight',
    icon: 'highlighter',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Highlight text and content areas'
  },
  {
    id: 'whiteout',
    name: 'Whiteout',
    icon: 'eraser',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Redact or erase content'
  },
  {
    id: 'sign',
    name: 'Sign',
    icon: 'feather',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Draw, type, or upload signature'
  },
  {
    id: 'link',
    name: 'Link',
    icon: 'link-2',
    category: 'tools',
    runsOn: 'browser',
    tooltip: 'Add clickable web hyperlink'
  },

  // 2. Cloud Tools (Explicit User Confirmation Required)
  {
    id: 'ocr',
    name: 'Make text editable',
    icon: 'cloud-lightning',
    category: 'cloud_tools',
    runsOn: 'server',
    flag: 'features.ocr',
    tooltip: 'Sends this PDF to our server',
    description: 'Transform scanned pages into searchable or editable text'
  }
] as const;

/**
 * Result modes for OCR execution
 */
export type EditPdfOcrMode = 'searchable' | 'editable';

/**
 * OCR Request options schema (Zod)
 */
export const EditPdfOcrOptionsSchema = z.object({
  languages: z
    .array(z.string().trim().min(2).max(10))
    .min(1, 'At least 1 language must be selected')
    .max(3, 'Maximum of 3 languages allowed')
    .default(['eng']),
  pages: z
    .string()
    .trim()
    .min(1, 'Page selection is required')
    .max(200)
    .default('all'),
  deskew: z.boolean().default(true),
  mode: z.enum(['searchable', 'editable']).default('searchable')
});

export type EditPdfOcrOptions = z.infer<typeof EditPdfOcrOptionsSchema>;

/**
 * State of an OCR background processing job
 */
export type EditPdfOcrJobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

/**
 * OCR Job Status Response schema (Zod)
 */
export const EditPdfOcrJobStatusSchema = z.object({
  jobId: z.string(),
  state: z.enum(['queued', 'running', 'done', 'failed', 'cancelled']),
  progress: z.number().min(0).max(100),
  page: z.number().int().positive().optional(),
  pages: z.number().int().positive().optional(),
  error: z.string().optional()
});

export type EditPdfOcrJobStatus = z.infer<typeof EditPdfOcrJobStatusSchema>;

/**
 * Single recognized word with bounding box and confidence score
 * bbox is [x0, y0, x1, y1] in PDF points (origin at bottom-left, rotation-normalised)
 */
export const EditPdfOcrWordSchema = z.object({
  text: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  confidence: z.number().min(0).max(100)
});

export type EditPdfOcrWord = z.infer<typeof EditPdfOcrWordSchema>;

/**
 * Single recognized line of text
 */
export const EditPdfOcrLineSchema = z.object({
  text: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  baselineY: z.number(),
  fontSizePt: z.number().positive(),
  confidence: z.number().min(0).max(100),
  words: z.array(EditPdfOcrWordSchema)
});

export type EditPdfOcrLine = z.infer<typeof EditPdfOcrLineSchema>;

/**
 * Processed OCR result for a single PDF page
 */
export const EditPdfOcrPageResultSchema = z.object({
  index: z.number().int().nonnegative(),
  widthPt: z.number().positive(),
  heightPt: z.number().positive(),
  rotation: z.number().int(),
  lines: z.array(EditPdfOcrLineSchema)
});

export type EditPdfOcrPageResult = z.infer<typeof EditPdfOcrPageResultSchema>;

/**
 * Complete OCR Job Result payload
 */
export const EditPdfOcrResultSchema = z.object({
  jobId: z.string(),
  pages: z.array(EditPdfOcrPageResultSchema),
  language: z.string(),
  averageConfidence: z.number().min(0).max(100),
  warnings: z.array(z.string())
});

export type EditPdfOcrResult = z.infer<typeof EditPdfOcrResultSchema>;

/**
 * Installed Tessdata language descriptor
 */
export interface TessdataLanguage {
  code: string;
  name: string;
  nativeName?: string;
  isPopular?: boolean;
}

export const SUPPORTED_OCR_LANGUAGES: readonly TessdataLanguage[] = [
  { code: 'eng', name: 'English', isPopular: true },
  { code: 'hin', name: 'Hindi', nativeName: 'हिन्दी', isPopular: true },
  { code: 'mar', name: 'Marathi', nativeName: 'मराठी', isPopular: true },
  { code: 'tam', name: 'Tamil', nativeName: 'தமிழ்', isPopular: true },
  { code: 'tel', name: 'Telugu', nativeName: 'తెలుగు', isPopular: true },
  { code: 'ben', name: 'Bengali', nativeName: 'বাংলা', isPopular: true },
  { code: 'guj', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kan', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'mal', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pan', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'urd', name: 'Urdu', nativeName: 'اردو' },
  { code: 'spa', name: 'Spanish', nativeName: 'Español', isPopular: true },
  { code: 'fra', name: 'French', nativeName: 'Français' },
  { code: 'deu', name: 'German', nativeName: 'Deutsch' },
  { code: 'por', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ara', name: 'Arabic', nativeName: 'العربية' },
  { code: 'chi_sim', name: 'Chinese Simplified', nativeName: '简体中文' },
  { code: 'jpn', name: 'Japanese', nativeName: '日本語' }
] as const;

