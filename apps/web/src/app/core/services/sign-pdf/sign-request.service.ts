import { Injectable } from '@angular/core';
import {
  ApiFeaturesData,
  ApiResponse,
  PdfPageBoxMetrics,
  SIGN_PDF_FEATURES,
  SignFieldElement,
  SignRequestOrder
} from '@paperflow/contracts';
import { environment } from '../../../../environments/environment';

export interface SignerSessionPayload {
  requestId: string;
  title: string;
  message: string;
  senderName: string;
  expiresAt: string;
  order: SignRequestOrder;
  pageCount: number;
  pagesMeta: PdfPageBoxMetrics[];
  signer: {
    id: string;
    name: string;
    email: string;
    color: string;
    status: string;
  };
  isYourTurn: boolean;
  waitingOn?: string;
  assignedFields: SignFieldElement[];
}

export interface CompletedFieldSubmission {
  fieldId: string;
  imageDataUrl?: string;
  text?: string;
  checked?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SignRequestService {
  private readonly baseUrl = environment.apiBaseUrl || 'http://localhost:4000/api/v1';
  private csrfToken: string | null = null;

  async getFeatures(signal?: AbortSignal): Promise<ApiFeaturesData> {
    if (!SIGN_PDF_FEATURES.requestSignatures) {
      return { signRequestsEnabled: false };
    }
    try {
      const res = await fetch(`${this.baseUrl}/features`, { signal });
      if (!res.ok) {
        return { signRequestsEnabled: false };
      }
      const json = (await res.json()) as ApiResponse<ApiFeaturesData>;
      return json?.data || { signRequestsEnabled: false };
    } catch {
      return { signRequestsEnabled: false };
    }
  }

  async ensureCsrfToken(signal?: AbortSignal): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const res = await fetch(`${this.baseUrl}/sign/csrf`, {
      credentials: 'include',
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Remote signing requests are currently disabled.'));
    }
    const json = (await res.json()) as ApiResponse<{ csrfToken: string }>;
    this.csrfToken = json.data?.csrfToken || '';
    return this.csrfToken;
  }

  async getSignerSession(token: string, signal?: AbortSignal): Promise<SignerSessionPayload> {
    const res = await fetch(`${this.baseUrl}/sign/t/${encodeURIComponent(token)}`, {
      credentials: 'include',
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Unable to open signing link.'));
    }
    const json = (await res.json()) as ApiResponse<SignerSessionPayload>;
    return json.data;
  }

  async fetchSignerPdfBytes(token: string, signal?: AbortSignal): Promise<Uint8Array> {
    const res = await fetch(`${this.baseUrl}/sign/t/${encodeURIComponent(token)}/document`, {
      credentials: 'include',
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Unable to load document PDF.'));
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  async completeSigner(
    token: string,
    payload: { consentGiven: boolean; completedFields: CompletedFieldSubmission[] },
    signal?: AbortSignal
  ): Promise<{ status: 'partial' | 'completed'; completedAt?: string; finalSha256?: string }> {
    const csrf = await this.ensureCsrfToken(signal);
    const res = await fetch(`${this.baseUrl}/sign/t/${encodeURIComponent(token)}/complete`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {})
      },
      body: JSON.stringify(payload),
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Could not submit signature.'));
    }
    const json = (await res.json()) as ApiResponse<{ status: 'partial' | 'completed'; completedAt?: string; finalSha256?: string }>;
    return json.data;
  }

  async declineSigner(token: string, reason: string, signal?: AbortSignal): Promise<{ status: 'declined' }> {
    const csrf = await this.ensureCsrfToken(signal);
    const res = await fetch(`${this.baseUrl}/sign/t/${encodeURIComponent(token)}/decline`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {})
      },
      body: JSON.stringify({ reason }),
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Could not decline document.'));
    }
    const json = (await res.json()) as ApiResponse<{ status: 'declined' }>;
    return json.data;
  }

  private async extractErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
      const json = await res.json();
      return json?.error?.message || fallback;
    } catch {
      return fallback;
    }
  }
}
