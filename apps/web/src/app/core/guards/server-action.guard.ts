import { Injectable } from '@angular/core';

/**
 * Security guard guaranteeing no outbound network request carrying user document bytes
 * can execute without verifiable, recorded explicit user consent.
 */
@Injectable({
  providedIn: 'root'
})
export class ServerActionGuard {
  private activeConsents = new Set<string>();

  /**
   * Check whether consent has been granted for the specific action in this session
   */
  hasConsent(actionId: string): boolean {
    if (this.activeConsents.has(actionId)) {
      return true;
    }
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = sessionStorage.getItem(`pt_upload_consent_${actionId}`);
        if (stored === 'true') {
          this.activeConsents.add(actionId);
          return true;
        }
      }
    } catch {
      // sessionStorage unavailable or restricted
    }
    return false;
  }

  /**
   * Records explicit consent for an action
   */
  recordConsent(actionId: string, persistSession = false): void {
    this.activeConsents.add(actionId);
    if (persistSession) {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem(`pt_upload_consent_${actionId}`, 'true');
        }
      } catch {
        // sessionStorage unavailable
      }
    }
  }

  /**
   * Revokes consent for an action
   */
  revokeConsent(actionId: string): void {
    this.activeConsents.delete(actionId);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(`pt_upload_consent_${actionId}`);
      }
    } catch {
      // sessionStorage unavailable
    }
  }

  /**
   * Throws an error if consent has not been granted for the given action
   */
  assertConsent(actionId: string): void {
    if (!this.hasConsent(actionId)) {
      throw new Error(
        `ServerActionGuard: Unauthorized server action attempt without explicit user consent: [${actionId}]`
      );
    }
  }
}

