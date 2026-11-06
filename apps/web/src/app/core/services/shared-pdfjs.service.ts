import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure workerSrc once at module load
if (typeof window !== 'undefined' && (pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface LoadPdfOptions {
  password?: string;
  onPasswordRequest?: (callback: (password: string) => void, reason: string) => void;
}

export class PdfPasswordError extends Error {
  constructor(
    public readonly code: 'PASSWORD_REQUIRED' | 'PASSWORD_INCORRECT',
    message: string
  ) {
    super(message);
    this.name = 'PdfPasswordError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class SharedPdfjsService {
  /**
   * Returns the underlying pdfjsLib instance
   */
  get lib(): typeof pdfjsLib {
    return pdfjsLib;
  }

  /**
   * Initializes and loads a PDF document proxy with locally self-hosted assets
   * (cMaps, standard fonts, wasm decoders) and hardened security flags.
   */
  async loadDocument(
    data: Uint8Array | ArrayBuffer,
    options: LoadPdfOptions = {}
  ): Promise<any> {
    const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data);

    const loadingTask = (pdfjsLib as any).getDocument({
      data: uint8Data.slice(0),
      verbosity: 0,
      isEvalSupported: false,
      cMapUrl: '/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/standard_fonts/',
      wasmUrl: '/wasm/',
      password: options.password
    });

    if (options.onPasswordRequest) {
      loadingTask.onPassword = options.onPasswordRequest;
    }

    try {
      return await loadingTask.promise;
    } catch (err: any) {
      const msg = err?.message || String(err);
      const name = err?.name || '';
      if (name === 'PasswordException' || msg.includes('password') || err?.code === 1 || err?.code === 2) {
        if (options.password) {
          throw new PdfPasswordError(
            'PASSWORD_INCORRECT',
            'Incorrect password. Please enter the valid document password.'
          );
        } else {
          throw new PdfPasswordError(
            'PASSWORD_REQUIRED',
            'This PDF is password-protected. Please enter the password to unlock.'
          );
        }
      }
      throw err;
    }
  }

  /**
   * Safely cleans up and destroys a PDF document proxy
   */
  async destroyDocument(doc: any): Promise<void> {
    if (!doc) return;
    try {
      if (typeof doc.cleanup === 'function') {
        doc.cleanup();
      }
      if (typeof doc.destroy === 'function') {
        await doc.destroy();
      }
    } catch (e) {
      console.warn('PDF.js document destroy error (ignored):', e);
    }
  }
}
