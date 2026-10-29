import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Location } from '@angular/common';
import { routes } from './app.routes';
import { provideTranslateService } from '@ngx-translate/core';

describe('App Routes: Live vs Coming Soon Navigation', () => {
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideTranslateService({ fallbackLang: 'en' })
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  const comingSoonPaths = [
    'word-to-pdf',
    'powerpoint-to-pdf',
    'excel-to-pdf',
    'edit-pdf',
    'pdf-to-jpg',
    'images-to-pdf',
    'sign-pdf',
    'watermark-pdf',
    'rotate-pdf',
    'html-to-pdf',
    'unlock-pdf',
    'protect-pdf'
  ];

  for (const path of comingSoonPaths) {
    it(`should NOT navigate to coming soon tool /${path} and redirect to root`, async () => {
      await router.navigateByUrl(`/${path}`);
      expect(location.path()).toBe('');
    });
  }

  it('should allow navigation to live tool /pdf-to-excel', async () => {
    await router.navigateByUrl('/pdf-to-excel');
    expect(location.path()).toBe('/pdf-to-excel');
  });

  it('should allow navigation to live tool /pdf-to-word', async () => {
    await router.navigateByUrl('/pdf-to-word');
    expect(location.path()).toBe('/pdf-to-word');
  });

  it('should allow navigation to live tool /merge-pdf', async () => {
    await router.navigateByUrl('/merge-pdf');
    expect(location.path()).toBe('/merge-pdf');
  });
});
