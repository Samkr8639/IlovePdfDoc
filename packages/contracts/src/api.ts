export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp: string;
    durationMs?: number;
  };
}

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: {
    requestId?: string;
    timestamp: string;
  };
}

export interface HealthCheckData {
  status: 'healthy' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
  };
  features: {
    browserProcessingAvailable: boolean;
    serverProcessingAvailable: boolean;
  };
}

export type ProcessingStage = 
  | 'idle' 
  | 'validating' 
  | 'reading' 
  | 'processing' 
  | 'optimizing' 
  | 'packaging' 
  | 'completed' 
  | 'failed';

export interface ProcessingState {
  stage: ProcessingStage;
  progressPercent: number;
  message: string;
  outputBlob?: Blob;
  outputFilename?: string;
  outputSizeBytes?: number;
  error?: string;
}

export interface ContactSubmissionPayload {
  name: string;
  email: string;
  subject: string;
  userType: 'individual' | 'company';
  productInterests: string[];
  message: string;
}

export interface ContactSubmissionResult {
  ticketId: string;
  receivedAt: string;
  estimatedResponseHours: number;
  message: string;
}
