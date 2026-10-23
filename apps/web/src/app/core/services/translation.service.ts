import { Injectable, signal } from '@angular/core';

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', dir: 'rtl' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' }
];

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  readonly languages = SUPPORTED_LANGUAGES;
  readonly currentLanguage = signal<SupportedLanguage>(SUPPORTED_LANGUAGES[0]);
  private isInitialized = false;

  constructor() {
    this.initFromStorage();
    this.injectGoogleTranslateScript();
  }

  private initFromStorage(): void {
    if (typeof window === 'undefined') return;

    // Check cookie first or localStorage
    const savedLangCode = localStorage.getItem('user_language');
    const cookieMatch = document.cookie.match(/googtrans=\/en\/([a-zA-Z-]+)/);
    const activeCode = savedLangCode || (cookieMatch ? cookieMatch[1] : 'en');

    const matched = this.languages.find(l => l.code.toLowerCase() === activeCode.toLowerCase());
    if (matched) {
      this.currentLanguage.set(matched);
      if (matched.dir === 'rtl') {
        document.documentElement.dir = 'rtl';
      }
    }
  }

  private injectGoogleTranslateScript(): void {
    if (typeof window === 'undefined') return;

    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            autoDisplay: false,
            includedLanguages: this.languages.map(l => l.code).join(',')
          },
          'google_translate_element'
        );
        this.isInitialized = true;
      }
    };

    // Ensure container exists
    if (!document.getElementById('google_translate_element')) {
      const div = document.createElement('div');
      div.id = 'google_translate_element';
      div.style.display = 'none';
      document.body.appendChild(div);
    }

    // Check if script already injected
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.type = 'text/javascript';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.head.appendChild(script);
    }
  }

  setLanguage(langCode: string): void {
    const target = this.languages.find(l => l.code === langCode) || this.languages[0];
    this.currentLanguage.set(target);

    if (typeof window === 'undefined') return;

    localStorage.setItem('user_language', target.code);

    if (target.dir === 'rtl') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }

    if (target.code === 'en') {
      this.clearCookies();
      const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (combo) {
        combo.value = '';
        combo.dispatchEvent(new Event('change'));
      }
      // Reload to ensure clean pristine English DOM
      window.location.reload();
      return;
    }

    // Set cookies for Google Translate
    this.setCookie('googtrans', `/en/${target.code}`);
    this.setCookie('googtrans', `/en/${target.code}`, window.location.hostname);

    const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (combo) {
      combo.value = target.code;
      combo.dispatchEvent(new Event('change'));
    } else {
      // Reload so Google Translate picks up the cookie on boot
      window.location.reload();
    }
  }

  private setCookie(name: string, value: string, domain?: string): void {
    let cookie = `${name}=${value}; path=/;`;
    if (domain && domain !== 'localhost') {
      cookie += ` domain=${domain};`;
    }
    document.cookie = cookie;
  }

  private clearCookies(): void {
    const domains = ['', `.${window.location.hostname}`, window.location.hostname];
    for (const d of domains) {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; ${d ? 'domain=' + d : ''}`;
    }
  }
}
