import { Injectable, signal } from '@angular/core';

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  // Column 1
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },

  // Column 2
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)', flag: '🇹🇼' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', flag: '🇪🇸' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },

  // Column 3
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' }
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
    const cookieMatch = document.cookie.match(/googtrans=\/(?:en|auto)\/([a-zA-Z-]+)/);
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
        combo.dispatchEvent(new Event('change', { bubbles: true }));
      }
      window.location.reload();
      return;
    }

    // Set cookies for Google Translate (both /en/ and /auto/ prefixes)
    this.setCookie('googtrans', `/en/${target.code}`);
    this.setCookie('googtrans', `/auto/${target.code}`);

    const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (combo) {
      combo.value = target.code;
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Reload so Google Translate translates the document on load
      window.location.reload();
    }
  }

  private setCookie(name: string, value: string): void {
    const host = window.location.hostname;
    document.cookie = `${name}=${value}; path=/;`;
    if (host && host !== 'localhost' && !host.includes('127.0.0.1')) {
      document.cookie = `${name}=${value}; path=/; domain=.${host};`;
      document.cookie = `${name}=${value}; path=/; domain=${host};`;
    }
  }

  private clearCookies(): void {
    const host = window.location.hostname;
    const past = 'Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = `googtrans=; expires=${past}; path=/;`;
    if (host && host !== 'localhost' && !host.includes('127.0.0.1')) {
      document.cookie = `googtrans=; expires=${past}; path=/; domain=.${host};`;
      document.cookie = `googtrans=; expires=${past}; path=/; domain=${host};`;
    }
  }
}
