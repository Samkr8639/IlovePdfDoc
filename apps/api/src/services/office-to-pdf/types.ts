export type OfficeProfile = 'writer' | 'calc' | 'impress';

export interface OfficeConversionOptions {
  profile: OfficeProfile;
  filterString: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  allowRecalculation?: boolean;
}

export interface OfficeConversionResult {
  pdfBuffer: Buffer;
  pageCount: number;
  warnings: string[];
}
