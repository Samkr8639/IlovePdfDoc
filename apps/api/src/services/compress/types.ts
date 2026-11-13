export type CompressionLevel = 'extreme' | 'recommended' | 'less';

export interface CompressionProfile {
  level: CompressionLevel;
  maxDpi: number;
  jpegQuality: number;
  chromaSubsampling: '4:2:0' | '4:4:4';
  stripMetadata: boolean;
  removePieceInfo: boolean;
  optimizeIcc: boolean;
  enableBilevelThreshold: boolean;
  minSavingsThreshold: number; // e.g. 0.05 = 5%
}

export const COMPRESSION_PROFILES: Record<CompressionLevel, CompressionProfile> = {
  extreme: {
    level: 'extreme',
    maxDpi: 72, // Range 72-85 DPI for >70% reduction
    jpegQuality: 35, // High compression
    chromaSubsampling: '4:2:0',
    stripMetadata: true,
    removePieceInfo: true,
    optimizeIcc: true,
    enableBilevelThreshold: true,
    minSavingsThreshold: 0.05
  },
  recommended: {
    level: 'recommended',
    maxDpi: 120, // Standard screen resolution for ~50% reduction
    jpegQuality: 58,
    chromaSubsampling: '4:2:0',
    stripMetadata: false,
    removePieceInfo: true,
    optimizeIcc: true,
    enableBilevelThreshold: false,
    minSavingsThreshold: 0.05
  },
  less: {
    level: 'less',
    maxDpi: 180, // Sharp graphics for ~20% reduction
    jpegQuality: 80,
    chromaSubsampling: '4:4:4',
    stripMetadata: false,
    removePieceInfo: false,
    optimizeIcc: false,
    enableBilevelThreshold: false,
    minSavingsThreshold: 0.05
  }
};

export interface CompressionStats {
  originalBytes: number;
  compressedBytes: number;
  spaceSavedBytes: number;
  reductionPercentage: number;
  pageCount: number;
  imagesProcessed: number;
  imagesOptimized: number;
  imagesDeduplicated: number;
  savingsReason: string;
  durationMs: number;
  isScannedDocument?: boolean;
}

export interface CompressPdfOptions {
  level?: CompressionLevel;
  scannedMode?: boolean;
  targetSizeBytes?: number;
  maxExecutionTimeMs?: number;
}
