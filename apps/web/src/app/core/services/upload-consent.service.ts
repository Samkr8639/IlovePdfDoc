import { Injectable, inject, signal } from '@angular/core';
import { ServerActionGuard } from '../guards/server-action.guard';

export interface UploadConsentOptions {
  title?: string;
  actionId: string;
  pageCountDescription: string;
  purposeDescription?: string;
  retentionDescription?: string;
  privacyPolicyUrl?: string;
  confirmText?: string;
  cancelText?: string;
}

export interface UploadConsentState {
  isOpen: boolean;
  options: UploadConsentOptions;
  resolve: (value: boolean) => void;
  triggerElement: HTMLElement | null;
}

@Injectable({
  providedIn: 'root'
})
export class UploadConsentService {
  private serverActionGuard = inject(ServerActionGuard);

  readonly state = signal<UploadConsentState | null>(null);

  /**
   * Prompts user with the Upload Consent Dialog before transmitting PDF bytes to backend.
   * If consent was previously granted for this session, resolves true immediately without prompt.
   */
  async ask(options: UploadConsentOptions): Promise<boolean> {
    // Check if consent was already remembered for this session
    if (this.serverActionGuard.hasConsent(options.actionId)) {
      return true;
    }

    const triggerElement = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;

    return new Promise<boolean>((resolve) => {
      this.state.set({
        isOpen: true,
        options: {
          title: options.title || 'Upload PDF Pages to Cloud Tool',
          actionId: options.actionId,
          pageCountDescription: options.pageCountDescription,
          purposeDescription:
            options.purposeDescription ||
            'Processing Optical Character Recognition (OCR) to detect layout, text, and make document content editable.',
          retentionDescription:
            options.retentionDescription ||
            'Files are processed in memory and permanently deleted after 10 minutes or upon completion.',
          privacyPolicyUrl: options.privacyPolicyUrl || '/privacy-policy',
          confirmText: options.confirmText || 'Send and continue',
          cancelText: options.cancelText || 'Cancel'
        },
        resolve,
        triggerElement
      });
    });
  }

  /**
   * Called by UploadConsentDialogComponent when user approves consent
   */
  confirm(persistSession = false): void {
    const currentState = this.state();
    if (!currentState) return;

    this.serverActionGuard.recordConsent(currentState.options.actionId, persistSession);
    this.closeDialog(currentState, true);
  }

  /**
   * Called by UploadConsentDialogComponent when user declines or presses Escape
   */
  cancel(): void {
    const currentState = this.state();
    if (!currentState) return;

    this.closeDialog(currentState, false);
  }

  private closeDialog(state: UploadConsentState, result: boolean): void {
    this.state.set(null);
    state.resolve(result);

    // Restore focus to original trigger element for WCAG 2.2 AA compliance
    if (state.triggerElement && typeof state.triggerElement.focus === 'function') {
      setTimeout(() => {
        try {
          state.triggerElement?.focus();
        } catch {
          // Ignore focus errors
        }
      }, 0);
    }
  }
}

