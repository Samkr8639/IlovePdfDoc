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

function nativeImport(url: string): Promise<any> {
  return new Function('s', 'return import(s)')(url);
}

async function getScanner() {
  let analyzePath = path.resolve(__dirname, 'analyze.mjs');
  if (!fs.existsSync(analyzePath)) {
    analyzePath = path.resolve(__dirname, '../../../src/services/pdf-layout/analyze.mjs');
  }
  if (!fs.existsSync(analyzePath)) {
    analyzePath = path.resolve(__dirname, '../../src/services/pdf-layout/analyze.mjs');
  }
  const url = pathToFileURL(analyzePath).href;
  const targetUrl = process.env.JEST_WORKER_ID ? `${url}?jest=${Date.now()}_${Math.random()}` : url;
  return nativeImport(targetUrl);
}

export async function analyzePdf(buffer: Buffer | Uint8Array, opts: any = {}): Promise<PdfLayoutModel> {
  const mod = await getScanner();
  return mod.analyzePdf(buffer, opts);
}
