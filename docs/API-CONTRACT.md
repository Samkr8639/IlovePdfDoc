# PaperFlow API & Shared Contracts

This specification defines the communication contracts between the client applications and the backend API service.

---

## 1. Global Conventions

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json` (or `multipart/form-data` for file uploads)
- **Time Format**: ISO 8601 UTC strings (`2026-10-22T09:30:00Z`)
- **Error Codes**: All errors use UPPERCASE_SNAKE_CASE identifiers.

---

## 2. Standard Response Envelopes

### Success Envelope
```typescript
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp: string;
    durationMs?: number;
  };
}
```

### Error Envelope
```typescript
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; issue: string }>;
  };
  meta: {
    requestId?: string;
    timestamp: string;
  };
}
```

---

## 3. Endpoints

### 3.1 Health & Diagnostics
- **Route**: `GET /api/v1/health`
- **Access**: Public
- **Description**: Verifies service status, uptime, node version, and memory usage.

#### Response `200 OK`:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "paperflow-api",
    "version": "1.0.0",
    "timestamp": "2026-10-22T09:30:00.000Z",
    "uptime": 120.45,
    "memory": {
      "rssMb": 48.2,
      "heapUsedMb": 24.1
    },
    "features": {
      "browserProcessingAvailable": true,
      "serverProcessingAvailable": true
    }
  }
}
```

---

### 3.2 Tool Registry Schema

Every tool in PaperFlow conforms to a strict model:

```typescript
export type ProcessingMode = 'browser' | 'server' | 'hybrid';
export type ToolCategory = 'organize' | 'convert' | 'optimize' | 'edit' | 'security';
export type ToolStatus = 'available' | 'beta' | 'planned';

export interface ToolDefinition {
  id: string;                         // e.g. 'merge-pdf'
  name: string;                       // e.g. 'Merge PDF'
  description: string;                // Short description for cards
  category: ToolCategory;
  route: string;                      // e.g. '/merge-pdf'
  icon: string;                       // SVG icon identifier
  processingMode: ProcessingMode;
  acceptedFileTypes: string[];        // e.g. ['.pdf', 'application/pdf']
  maxFiles: number;                   // e.g. 20 for merge, 1 for split
  maxFileSizeBytes: number;           // e.g. 52428800 (50MB)
  status: ToolStatus;
  seo: {
    title: string;
    description: string;
    keywords: string[];
    canonical: string;
  };
}
```

---

## 4. Processing Status Contract (Local & Server)

```typescript
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
  progressPercent: number;           // 0 to 100
  message: string;
  outputBlob?: Blob;
  outputFilename?: string;
  outputSizeBytes?: number;
  error?: string;
}
```
