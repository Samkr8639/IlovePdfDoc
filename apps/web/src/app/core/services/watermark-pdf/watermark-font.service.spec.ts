import { describe, it, expect, beforeEach } from 'vitest';
import { WatermarkFontService } from './watermark-font.service';

describe('WatermarkFontService', () => {
  let service: WatermarkFontService;

  beforeEach(() => {
    service = new WatermarkFontService();
  });

  it('detects emoji in strings (R-040)', () => {
    expect(service.hasEmoji('CONFIDENTIAL')).toBe(false);
    expect(service.hasEmoji('Confidential 🚀 Top Secret')).toBe(true);
    expect(service.hasEmoji('Draft ⚠️')).toBe(true);
    expect(service.hasEmoji('Regular 123 !@#')).toBe(false);
  });

  it('detects Unicode scripts correctly (R-040)', () => {
    expect(service.detectScript('CONFIDENTIAL')).toBe('latin');
    expect(service.detectScript('गोपनीय')).toBe('indic'); // Devanagari
    expect(service.detectScript('রহস্যজনক')).toBe('indic'); // Bengali
    expect(service.detectScript('سري للغاية')).toBe('arabic'); // Arabic
    expect(service.detectScript('חסוי')).toBe('hebrew'); // Hebrew
    expect(service.detectScript('ลับ')).toBe('thai'); // Thai
    expect(service.detectScript('机密')).toBe('cjk'); // Chinese
    expect(service.detectScript('社外秘')).toBe('cjk'); // Japanese
    expect(service.detectScript('대외비')).toBe('cjk'); // Korean
  });

  it('provides script metadata and RTL flags', () => {
    const arabic = service.getScriptInfo('arabic');
    expect(arabic.isRtl).toBe(true);
    expect(arabic.recommendedFontFamily).toContain('Arabic');

    const indic = service.getScriptInfo('indic');
    expect(indic.isRtl).toBe(false);

    const latin = service.getScriptInfo('latin');
    expect(latin.isRtl).toBe(false);
    expect(latin.url).toBe('/standard_fonts/LiberationSans-Regular.ttf');
  });
});
