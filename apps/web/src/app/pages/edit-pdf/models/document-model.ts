export type EditToolType =
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

export interface PageDimensions {
  pageIndex: number;
  widthPt: number;
  heightPt: number;
  rotation: number; // 0, 90, 180, 270
}

export type ElementType =
  | 'text'
  | 'image'
  | 'draw'
  | 'shape'
  | 'highlight'
  | 'whiteout'
  | 'sign'
  | 'link'
  | 'ocr-layer';

export interface BaseEditElement {
  id: string;
  pageIndex: number;
  type: ElementType;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  rotation?: number;
  groupId?: string;
}

export interface LowConfidenceWord {
  text: string;
  pageIndex: number;
  bbox: [number, number, number, number];
  confidence: number;
}

export interface TextLineBounds {
  text: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

export interface TextEditElement extends BaseEditElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSizePt: number;
  color: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeout?: boolean;
  align?: 'left' | 'center' | 'right';
  baselineY?: number;
  isOcrLine?: boolean;
  isPageTextLine?: boolean;
  isEdited?: boolean;
  originalText?: string;
  originalXPt?: number;
  originalYPt?: number;
  originalWidthPt?: number;
  originalHeightPt?: number;
  originalLines?: TextLineBounds[];
  ocrConfidence?: number;
  lowConfidenceWords?: LowConfidenceWord[];
  html?: string;
  linkUrl?: string;
}

export interface ImageEditElement extends BaseEditElement {
  type: 'image';
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface DrawPoint {
  xPt: number;
  yPt: number;
}

export interface DrawEditElement extends BaseEditElement {
  type: 'draw';
  points: DrawPoint[];
  strokeColor: string;
  strokeWidth: number;
}

export interface ShapeEditElement extends BaseEditElement {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'line' | 'arrow' | 'star' | 'polygon';
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  points?: Array<{ x: number; y: number }>;
}

export interface HighlightEditElement extends BaseEditElement {
  type: 'highlight';
  color: string;
  opacity: number;
}

export interface WhiteoutEditElement extends BaseEditElement {
  type: 'whiteout';
  fillColor: string;
}

export interface SignEditElement extends BaseEditElement {
  type: 'sign';
  dataUrl: string;
  signMode?: 'type' | 'draw' | 'upload';
  signatureText?: string;
  fontFamily?: string;
  color?: string;
  fontSizePt?: number;
}

export interface LinkEditElement extends BaseEditElement {
  type: 'link';
  url: string;
}

export interface OcrWordItem {
  text: string;
  bbox: [number, number, number, number];
  confidence: number;
}

export interface OcrLineItem {
  text: string;
  bbox: [number, number, number, number];
  baselineY: number;
  fontSizePt: number;
  confidence: number;
  words: OcrWordItem[];
}

export interface OcrTextLayerElement extends BaseEditElement {
  type: 'ocr-layer';
  lines: OcrLineItem[];
  language?: string;
  averageConfidence?: number;
}

export type EditElement =
  | TextEditElement
  | ImageEditElement
  | DrawEditElement
  | ShapeEditElement
  | HighlightEditElement
  | WhiteoutEditElement
  | SignEditElement
  | LinkEditElement
  | OcrTextLayerElement;

export interface AreaSelectionState {
  pageIndex: number;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  snapshotDataUrl: string | null;
  naturalWidth?: number;
  naturalHeight?: number;
  isDragging?: boolean;
  dragTargetPageIndex?: number;
  dragCurrentXPt?: number;
  dragCurrentYPt?: number;
  originalXPt: number;
  originalYPt: number;
  originalPageIndex: number;
  originalWidthPt: number;
  originalHeightPt: number;
  capturedElementIds?: string[];
}

