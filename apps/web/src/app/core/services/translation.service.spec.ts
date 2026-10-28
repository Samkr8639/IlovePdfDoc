import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { TranslationService, SUPPORTED_LANGUAGES } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
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
    expect(service.languages.length).toBeGreaterThan(10);
    expect(service.currentLanguage().code).toBe('en');
  });

  it('should update currentLanguage signal on setLanguage', () => {
    service.setLanguage('hi');
    expect(service.currentLanguage().code).toBe('hi');
    expect(service.currentLanguage().nativeName).toBe('हिन्दी');

    service.setLanguage('es');
    expect(service.currentLanguage().code).toBe('es');
    expect(service.currentLanguage().nativeName).toBe('Español');
  });

  it('should fallback to English for unknown language code', () => {
    service.setLanguage('xyz-unknown');
    expect(service.currentLanguage().code).toBe('en');
  });
});
