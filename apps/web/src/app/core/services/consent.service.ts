import { Injectable, signal, effect } from '@angular/core';

export interface CookieConsentPreferences {
  necessary: boolean;      // Always true
  functional: boolean;     // Language & UI preferences
  analytics: boolean;      // Performance & diagnostic
  advertising: boolean;    // Marketing & advertising
  timestamp: string;       // ISO date string
  version: string;         // '1.0'
}

export const STORAGE_CONSENT_KEY = 'pdf_flow_cookie_consent';

const DEFAULT_PREFERENCES: CookieConsentPreferences = {
  necessary: true,
  functional: true,
  analytics: false,
  advertising: false,
  timestamp: new Date().toISOString(),
  version: '1.0'
};

@Injectable({
  providedIn: 'root'
})
export class ConsentService {
  readonly preferences = signal<CookieConsentPreferences>(this.loadPreferences());
  readonly hasSavedNotification = signal<boolean>(false);
  readonly lastSavedTime = signal<string | null>(null);

  constructor() {
    // Keep localStorage synchronized whenever preferences change via save
  }

  loadPreferences(): CookieConsentPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_CONSENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CookieConsentPreferences>;
        return {
          necessary: true,
          functional: parsed.functional ?? true,
          analytics: parsed.analytics ?? false,
          advertising: parsed.advertising ?? false,
          timestamp: parsed.timestamp || new Date().toISOString(),
          version: parsed.version || '1.0'
        };
      }
    } catch {
      // Fallback if localStorage access is blocked
    }
    return { ...DEFAULT_PREFERENCES };
  }

  setCategory(category: 'functional' | 'analytics' | 'advertising', value: boolean): void {
    this.preferences.update(prev => ({
      ...prev,
      [category]: value
    }));
  }

  savePreferences(): void {
    const current = {
      ...this.preferences(),
      necessary: true,
      timestamp: new Date().toISOString()
    };

    try {
      localStorage.setItem(STORAGE_CONSENT_KEY, JSON.stringify(current));
    } catch {
      // Silently catch storage write errors
    }

    this.preferences.set(current);
    this.lastSavedTime.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    this.hasSavedNotification.set(true);

    // If functional is disabled, clean up non-essential translation cookies
    if (!current.functional) {
      this.clearFunctionalCookies();
    }
  }

  acceptAll(): void {
    const updated: CookieConsentPreferences = {
      necessary: true,
      functional: true,
      analytics: true,
      advertising: true,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    try {
      localStorage.setItem(STORAGE_CONSENT_KEY, JSON.stringify(updated));
    } catch {}

    this.preferences.set(updated);
    this.lastSavedTime.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    this.hasSavedNotification.set(true);
  }

  rejectOptional(): void {
    const updated: CookieConsentPreferences = {
      necessary: true,
      functional: false,
      analytics: false,
      advertising: false,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    try {
      localStorage.setItem(STORAGE_CONSENT_KEY, JSON.stringify(updated));
    } catch {}

    this.preferences.set(updated);
    this.lastSavedTime.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    this.hasSavedNotification.set(true);
    this.clearFunctionalCookies();
  }

  resetToDefaults(): void {
    try {
      localStorage.removeItem(STORAGE_CONSENT_KEY);
    } catch {}

    this.preferences.set({ ...DEFAULT_PREFERENCES, timestamp: new Date().toISOString() });
    this.lastSavedTime.set(null);
    this.hasSavedNotification.set(false);
  }

  private clearFunctionalCookies(): void {
    if (typeof document !== 'undefined') {
      const domains = ['', window.location.hostname, `.${window.location.hostname}`];
      for (const d of domains) {
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; ${d ? 'domain=' + d : ''}`;
      }
    }
  }
}
