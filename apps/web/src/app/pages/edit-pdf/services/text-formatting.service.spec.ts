import { TestBed } from '@angular/core/testing';
import { TextFormattingService } from './text-formatting.service';
import { TextEditElement } from '../models/document-model';

describe('TextFormattingService', () => {
  let service: TextFormattingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TextFormattingService]
    });
    service = TestBed.inject(TextFormattingService);
  });

  it('correctly formats and normalizes URLs', () => {
    expect(service.formatUrl('example.com')).toBe('https://example.com');
    expect(service.formatUrl('http://example.com')).toBe('http://example.com');
    expect(service.formatUrl('https://')).toBe('');
    expect(service.formatUrl('   ')).toBe('');
  });

  it('applies whole element link when no active range selection exists', () => {
    const el: TextEditElement = {
      id: 'txt-1',
      pageIndex: 0,
      type: 'text',
      xPt: 100,
      yPt: 100,
      widthPt: 200,
      heightPt: 30,
      fontFamily: 'Inter',
      fontSizePt: 12,
      color: '#000000',
      text: 'Click here'
    };

    service.applyLink(el, 'https://github.com', null);
    expect(el.linkUrl).toBe('https://github.com');
    expect(el.html).toContain('href="https://github.com"');
    expect(el.html).toContain('Click here');

    service.removeLink(el, null);
    expect(el.linkUrl).toBeUndefined();
    expect(el.html).not.toContain('href=');
  });

  it('detects existing links from HTML or linkUrl', () => {
    const elWithLinkUrl: TextEditElement = {
      id: 'txt-2',
      pageIndex: 0,
      type: 'text',
      xPt: 0,
      yPt: 0,
      widthPt: 100,
      heightPt: 20,
      fontFamily: 'Inter',
      fontSizePt: 12,
      color: '#000000',
      text: 'test',
      linkUrl: 'https://angular.dev'
    };
    expect(service.detectLinkUrl(elWithLinkUrl, null)).toBe('https://angular.dev');

    const elWithHtml: TextEditElement = {
      id: 'txt-3',
      pageIndex: 0,
      type: 'text',
      xPt: 0,
      yPt: 0,
      widthPt: 100,
      heightPt: 20,
      fontFamily: 'Inter',
      fontSizePt: 12,
      color: '#000000',
      text: 'test',
      html: '<a href="https://vite.dev">Vite</a>'
    };
    expect(service.detectLinkUrl(elWithHtml, null)).toBe('https://vite.dev');
  });

  it('handles applyInlineFormatting for strikeThrough, bold, italic, and underline', () => {
    const el: TextEditElement = {
      id: 'txt-format',
      pageIndex: 0,
      type: 'text',
      xPt: 0,
      yPt: 0,
      widthPt: 100,
      heightPt: 20,
      fontFamily: 'Inter',
      fontSizePt: 12,
      color: '#000000',
      text: 'Formatted text'
    };

    const res = service.applyInlineFormatting('strikeThrough', el, null);
    expect(res.handled).toBe(false);
  });
});
