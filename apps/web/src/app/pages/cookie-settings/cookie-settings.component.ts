import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { SeoService } from '../../core/services/seo.service';
import { ConsentService } from '../../core/services/consent.service';

interface CookieInventoryRow {
  name: string;
  provider: string;
  category: string;
  mechanism: string;
  duration: string;
  purpose: string;
}

@Component({
  selector: 'app-cookie-settings',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass],
  templateUrl: './cookie-settings.component.html',
  styleUrl: './cookie-settings.component.css'
})
export class CookieSettingsComponent implements OnInit {
  private seo = inject(SeoService);
  readonly consentService = inject(ConsentService);

  readonly inventoryRows: CookieInventoryRow[] = [
    {
      name: 'pdf_flow_cookie_consent',
      provider: 'PDFTailor (First-Party)',
      category: 'Strictly Necessary',
      mechanism: 'Browser LocalStorage',
      duration: '1 Year (Persistent)',
      purpose: 'Stores your saved cookie consent categories and timestamp so preferences persist across visits.'
    },
    {
      name: 'user_language',
      provider: 'PDFTailor (First-Party)',
      category: 'Functional / Preference',
      mechanism: 'Browser LocalStorage',
      duration: '1 Year (Persistent)',
      purpose: 'Remembers your selected interface language preference chosen in the footer selector.'
    },
    {
      name: 'googtrans',
      provider: 'Google Translate / PDFTailor',
      category: 'Functional / Preference',
      mechanism: 'HTTP Cookie',
      duration: 'Session / 30 Days',
      purpose: 'Enables automatic text translation into your preferred language when selected.'
    }
  ];

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'Cookie Settings & Privacy Preferences — PDFTailor',
      description: 'Manage your cookie settings and privacy preferences on PDFTailor. Configure functional, analytics, and advertising preferences with instant client persistence.',
      keywords: [
        'pdftailor cookie settings',
        'cookie preferences',
        'privacy consent manager',
        'manage cookies',
        'local storage preferences'
      ],
      canonical: 'https://pdftailor.in/cookie-settings',
      faqs: []
    });
  }

  onToggle(category: 'functional' | 'analytics' | 'advertising', event: Event): void {
    const input = event.target as HTMLInputElement;
    this.consentService.setCategory(category, input.checked);
  }

  savePreferences(): void {
    this.consentService.savePreferences();
  }

  acceptAll(): void {
    this.consentService.acceptAll();
  }

  rejectOptional(): void {
    this.consentService.rejectOptional();
  }

  resetToDefaults(): void {
    this.consentService.resetToDefaults();
  }
}
