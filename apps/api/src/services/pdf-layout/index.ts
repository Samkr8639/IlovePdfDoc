export interface TextRun {
  text: string;
  font: string;
  rawFont: string;
  generic: string;
  bold: boolean;
  italic: boolean;
  color: string;
  fs: number;
}

export interface TextBlock {
  x: number;
  y: number; // baseline Y
  pitch: number;
  fs: number;
  width: number;
  right: number;
  align: 'left' | 'right' | 'center';
  lines: TextRun[][];
}

export interface LayoutLine {
  x: number;
  y: number;
  w: number;
  h: number;
  vertical: boolean;
  color: string;
  style: 'solid' | 'dotted' | 'dashed';
  thickness: number;
}

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  lw?: number;
}

export interface LayoutImage {
  x: number;
  y: number;
  w: number;
  h: number;
  png: Buffer;
}

export interface LayoutPage {
  width: number;
  height: number;
  blocks: TextBlock[];
  lines: LayoutLine[];
  boxes: LayoutBox[];
  images: LayoutImage[];
}

export interface PdfLayoutModel {
  title?: string;
  pages: LayoutPage[];
  warnings: string[];
}

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export async function analyzePdf(buffer: Buffer | Uint8Array, opts: any = {}): Promise<PdfLayoutModel> {
  let analyzePath = path.resolve(__dirname, 'analyze.mjs');
  if (!fs.existsSync(analyzePath)) {
    analyzePath = path.resolve(__dirname, '../../src/services/pdf-layout/analyze.mjs');
  }
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (url: string) => Promise<any>;
  const mod = await dynamicImport(pathToFileURL(analyzePath).href);
  return mod.analyzePdf(buffer, opts);
}
