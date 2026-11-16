/**
 * Watermark Document Model
 * Shared normalized data structures used across Preview and Export.
 */

import {
  WatermarkFileSettings,
  WatermarkGridPosition,
  WatermarkLayer,
  WatermarkMarginUnit
} from '@paperflow/contracts';

export interface VisualPageBox {
  pageIndex: number;
  cropBox: [number, number, number, number]; // [minX, minY, maxX, maxY] in points
  mediaBox: [number, number, number, number];
  rotation: number; // 0, 90, 180, 270
  userUnit: number;
  // Effective visual dimensions in points after rotation and UserUnit
  visualWidth: number;
  visualHeight: number;
}

export interface WatermarkPlacement {
  // Center of watermark in visual page coordinates (origin bottom-left, 0 to visualWidth, 0 to visualHeight)
  centerX: number;
  centerY: number;
  // Watermark unrotated dimensions in points
  width: number;
  height: number;
  // Rotated bounding box dimensions
  rotatedWidth: number;
  rotatedHeight: number;
  // Rotation angle in degrees
  rotation: number;
  // Scale / font size
  fontSize?: number;
  opacity: number;
  layer: WatermarkLayer;
}

export interface WatermarkPageLayout {
  pageIndex: number;
  visualPage: VisualPageBox;
  isIncluded: boolean;
  placements: WatermarkPlacement[];
  isMosaic: boolean;
  totalTilesCount: number;
  exceededTileCap: boolean;
  doesNotFit: boolean;
}

export interface WatermarkDocumentModel {
  fileId: string;
  filename: string;
  totalPages: number;
  pages: VisualPageBox[];
  settings: WatermarkFileSettings;
  resolvedPageLayouts: WatermarkPageLayout[];
}

export function convertMarginToPoints(margin: number, unit: WatermarkMarginUnit): number {
  switch (unit) {
    case 'in':
      return margin * 72;
    case 'pt':
      return margin;
    case 'mm':
    default:
      return margin * (72 / 25.4);
  }
}
