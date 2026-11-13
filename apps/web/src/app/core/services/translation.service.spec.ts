import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { TranslationService, SUPPORTED_LANGUAGES } from './translation.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ fallbackLang: 'en' }),
        TranslationService
      ]
    });
    service = TestBed.inject(TranslationService);
  });

  it('should be created and default to English', () => {
    expect(service).toBeTruthy();
    expect(service.languages.length).toBe(26);
    expect(service.currentLanguage().code).toBe('en');
  });

  it('should support all 26 defined languages and update signals and html attributes', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      service.setLanguage(lang.code);
      expect(service.currentLanguage().code).toBe(lang.code);
      expect(document.documentElement.lang).toBe(lang.code);

      if (lang.dir === 'rtl') {
        expect(document.documentElement.dir).toBe('rtl');
      } else {
        expect(document.documentElement.dir).toBe('ltr');
      }

      expect(localStorage.getItem('user_language')).toBe(lang.code);
    }
  });

  it('should fallback to English for unknown language code', () => {
    service.setLanguage('xyz-unknown');
    expect(service.currentLanguage().code).toBe('en');
  });
});
