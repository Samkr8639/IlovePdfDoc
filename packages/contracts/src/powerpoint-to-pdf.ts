// ============================================================
// PowerPoint to PDF — Shared types & Zod schemas
// ============================================================

import { z } from 'zod';

export type PowerPointToPdfOutput = 'pdf' | 'pdfa';
export type PptLayout = 'slides' | 'notes' | 'handout';
export type HandoutPerPage = 1 | 2 | 3 | 4 | 6 | 9;
export type PageOrientation = 'portrait' | 'landscape';
export type SlidePageSize = 'as_slide' | 'a4_landscape' | 'letter_landscape';
export type ImageQuality = 'standard' | 'smaller';

export interface HandoutOptions {
  perPage: HandoutPerPage;
  orientation: PageOrientation;
  frames: boolean;
}

export interface SlideSelectionOptions {
  mode: 'all' | 'range';
  range?: string;
  includeHidden: boolean;
}

export interface PowerPointToPdfOptions {
  output?: PowerPointToPdfOutput;
  layout?: PptLayout;
  handout?: HandoutOptions;
  slides?: SlideSelectionOptions;
  pageSize?: SlidePageSize;
  comments?: boolean;
  bookmarks?: boolean;
  tagged?: boolean;
  hyperlinks?: boolean;
  imageQuality?: ImageQuality;
  merge?: boolean;
}

export const handoutOptionsSchema = z.object({
  perPage: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(6),
    z.literal(9)
  ]).default(3),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  frames: z.boolean().default(false)
});

export const slideSelectionSchema = z.object({
  mode: z.enum(['all', 'range']).default('all'),
  range: z.string().max(255).optional(),
  includeHidden: z.boolean().default(false)
});

export const powerpointToPdfOptionsSchema = z.object({
  output: z.enum(['pdf', 'pdfa']).default('pdf'),
  layout: z.enum(['slides', 'notes', 'handout']).default('slides'),
  handout: handoutOptionsSchema.optional(),
  slides: slideSelectionSchema.default({ mode: 'all', includeHidden: false }),
  pageSize: z.enum(['as_slide', 'a4_landscape', 'letter_landscape']).default('as_slide'),
  comments: z.boolean().default(false),
  bookmarks: z.boolean().default(true),
  tagged: z.boolean().default(true),
  hyperlinks: z.boolean().default(true),
  imageQuality: z.enum(['standard', 'smaller']).default('standard'),
  merge: z.boolean().default(false)
});

export interface PowerPointToPdfFileItem {
  id?: string;
  inputName: string;
  outputName: string;
  slideCount: number;
  pageCount: number;
  sizeBytes: number;
  originalSizeBytes?: number;
  formattedOriginalSize?: string;
  formattedPdfSize?: string;
  downloadUrl?: string;
  fontsSubstituted: Array<{ requested: string; used: string }>;
  fontsMissing: string[];
}

export interface PowerPointToPdfResponse {
  jobId: string;
  status?: 'completed' | 'processing' | 'failed';
  isZip: boolean;
  downloadUrl: string;
  filename: string;
  sizeBytes: number;
  files: PowerPointToPdfFileItem[];
  warnings: string[];
}
