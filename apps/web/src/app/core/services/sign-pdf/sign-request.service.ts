import { Injectable } from '@angular/core';
import {
  ApiFeaturesData,
  ApiResponse,
  CreateSignRequestInput,
  PdfPageBoxMetrics,
  SIGN_PDF_FEATURES,
  SignFieldElement,
  SignRequestOrder,
  SignRequestStatus
} from '@paperflow/contracts';
import { environment } from '../../../../environments/environment';

export interface SenderRequestCreateResult {
  requestId: string;
  statusUrl: string;
  senderAccessToken: string;
  expiresAt: string;
  originalSha256: string;
  signerStatusSummaries: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    orderIndex: number;
  }>;
  devSigningLinks?: Record<string, string>;
}

export interface SenderRequestStatusView {
  requestId: string;
  title: string;
  status: SignRequestStatus;
  order: SignRequestOrder;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  originalSha256: string;
  finalSha256?: string;
  auditChainValid: boolean;
  signers: Array<{
    id: string;
    name: string;
    email: string;
    color: string;
    orderIndex: number;
    status: string;
    signedAt?: string;
    declinedReason?: string;
  }>;
  auditLog: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
  }>;
}

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
  private readonly baseUrl = environment.apiBaseUrl || '/api/v1';
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

  async startSenderOtp(
    email: string,
    signal?: AbortSignal
  ): Promise<{ sent: boolean; expiresInSeconds: number; _devOtpCode?: string }> {
    const csrf = await this.ensureCsrfToken(signal);
    const res = await fetch(`${this.baseUrl}/sign/sender/verify-start`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {})
      },
      body: JSON.stringify({ email }),
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Failed to send verification code.'));
    }
    const json = (await res.json()) as ApiResponse<{ sent: boolean; expiresInSeconds: number; _devOtpCode?: string }>;
    return json.data;
  }

  async verifySenderOtp(
    email: string,
    code: string,
    signal?: AbortSignal
  ): Promise<{ verified: boolean }> {
    const csrf = await this.ensureCsrfToken(signal);
    const res = await fetch(`${this.baseUrl}/sign/sender/verify-confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {})
      },
      body: JSON.stringify({ email, code }),
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Invalid verification code.'));
    }
    const json = (await res.json()) as ApiResponse<{ verified: boolean }>;
    return json.data;
  }

  async createRequest(
    pdfBytes: Uint8Array,
    filename: string,
    payload: CreateSignRequestInput,
    signal?: AbortSignal
  ): Promise<SenderRequestCreateResult> {
    const csrf = await this.ensureCsrfToken(signal);
    const form = new FormData();
    form.append('file', new Blob([pdfBytes.slice(0).buffer], { type: 'application/pdf' }), filename);
    form.append('payload', JSON.stringify(payload));
    const res = await fetch(`${this.baseUrl}/sign/requests`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'x-csrf-token': csrf } : undefined,
      body: form,
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Could not create signature request.'));
    }
    const json = (await res.json()) as ApiResponse<SenderRequestCreateResult>;
    return json.data;
  }

  async getRequestStatus(
    requestId: string,
    senderToken: string,
    signal?: AbortSignal
  ): Promise<SenderRequestStatusView> {
    const res = await fetch(`${this.baseUrl}/sign/requests/${encodeURIComponent(requestId)}`, {
      credentials: 'include',
      headers: { 'x-sender-token': senderToken },
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Could not load request status.'));
    }
    const json = (await res.json()) as ApiResponse<SenderRequestStatusView>;
    return json.data;
  }

  async resendSigner(
    requestId: string,
    senderToken: string,
    signerId: string,
    newEmail?: string,
    signal?: AbortSignal
  ): Promise<{ resent: boolean; email: string; devSigningUrl?: string }> {
    const csrf = await this.ensureCsrfToken(signal);
    const res = await fetch(`${this.baseUrl}/sign/requests/${encodeURIComponent(requestId)}/resend`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-sender-token': senderToken,
        ...(csrf ? { 'x-csrf-token': csrf } : {})
      },
      body: JSON.stringify({ signerId, ...(newEmail ? { newEmail } : {}) }),
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Could not resend invitation.'));
    }
    const json = (await res.json()) as ApiResponse<{ resent: boolean; email: string; devSigningUrl?: string }>;
    return json.data;
  }

  async cancelRequest(
    requestId: string,
    senderToken: string,
    signal?: AbortSignal
  ): Promise<{ status: 'cancelled' }> {
    const csrf = await this.ensureCsrfToken(signal);
    const res = await fetch(`${this.baseUrl}/sign/requests/${encodeURIComponent(requestId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'x-sender-token': senderToken,
        ...(csrf ? { 'x-csrf-token': csrf } : {})
      },
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Could not cancel signature request.'));
    }
    const json = (await res.json()) as ApiResponse<{ status: 'cancelled' }>;
    return json.data;
  }

  async downloadFinalPdf(
    requestId: string,
    senderToken: string,
    signal?: AbortSignal
  ): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}/sign/requests/${encodeURIComponent(requestId)}/final`, {
      credentials: 'include',
      headers: { 'x-sender-token': senderToken },
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Final signed PDF is not available yet.'));
    }
    return res.blob();
  }

  async downloadCertificatePdf(
    requestId: string,
    senderToken: string,
    signal?: AbortSignal
  ): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}/sign/requests/${encodeURIComponent(requestId)}/certificate`, {
      credentials: 'include',
      headers: { 'x-sender-token': senderToken },
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Certificate of completion is not available yet.'));
    }
    return res.blob();
  }

  async signWithCertificateOnServer(
    pdfBytes: Uint8Array,
    filename: string,
    certFile: File,
    password: string,
    reason?: string,
    location?: string,
    signal?: AbortSignal
  ): Promise<{ blob: Blob; signerCn: string; issuerCn: string }> {
    const csrf = await this.ensureCsrfToken(signal);
    const form = new FormData();
    form.append('pdf', new Blob([pdfBytes.slice(0).buffer], { type: 'application/pdf' }), filename);
    form.append('certificate', certFile, certFile.name);
    form.append('password', password);
    if (reason?.trim()) form.append('reason', reason.trim());
    if (location?.trim()) form.append('location', location.trim());
    const res = await fetch(`${this.baseUrl}/sign/certificate-sign`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'x-csrf-token': csrf } : undefined,
      body: form,
      signal
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorMessage(res, 'Certificate signing failed. Check your certificate and password.'));
    }
    const blob = await res.blob();
    return {
      blob,
      signerCn: decodeURIComponent(res.headers.get('X-Signer-CN') || 'Certificate Signer'),
      issuerCn: decodeURIComponent(res.headers.get('X-Signer-Issuer') || 'Unknown Issuer')
    };
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
