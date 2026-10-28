import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

interface RetentionRow {
  category: string;
  location: string;
  period: string;
  disposal: string;
}

interface RightCard {
  title: string;
  scope: string;
  description: string;
}

interface CollectionCategory {
  title: string;
  subtitle: string;
  items: string[];
}

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css'
})
export class PrivacyPolicyComponent implements OnInit {
  private seo = inject(SeoService);

  readonly showBackToTop = signal<boolean>(false);

  readonly retentionSchedule: RetentionRow[] = [
    {
      category: 'Client-Side Documents',
      location: 'Local browser memory (RAM) only',
      period: '0 seconds (Duration of browser session)',
      disposal: 'Automatically flushed by web browser when tab or window closes'
    },
    {
      category: 'Hybrid Conversion Jobs',
      location: 'Volatile server memory buffers (RAM)',
      period: 'Max 60 minutes (or immediately after download)',
      disposal: 'Automated memory pruning routine & garbage collection zeroization'
    },
    {
      category: 'Contact & Support Tickets',
      location: 'Encrypted support ticketing database',
      period: 'Retained until inquiry resolution (or up to 2 years)',
      disposal: 'Permanent deletion from support management records upon request'
    },
    {
      category: 'Technical Network Logs',
      location: 'Protected access & routing log store',
      period: '30 to 90 days',
      disposal: 'Automated log rotation and permanent cryptographic overwriting'
    }
  ];

  readonly privacyRights: RightCard[] = [
    {
      title: 'Right of Access',
      scope: 'GDPR Art. 15 / CCPA § 1798.100',
      description: 'You have the right to request confirmation of whether we process personal data relating to you, and to obtain a copy of that data.'
    },
    {
      title: 'Right to Erasure',
      scope: 'GDPR Art. 17 / CCPA § 1798.105',
      description: 'You have the right to request the permanent deletion of your personal data or support communications, subject to lawful exceptions.'
    },
    {
      title: 'Right to Rectification',
      scope: 'GDPR Art. 16',
      description: 'You have the right to request the correction of inaccurate, outdated, or incomplete personal data we hold about you.'
    },
    {
      title: 'Right to Restrict or Object',
      scope: 'GDPR Art. 18 & 21',
      description: 'You have the right to object to or restrict processing carried out under legitimate business interests.'
    },
    {
      title: 'Right to Data Portability',
      scope: 'GDPR Art. 20',
      description: 'You have the right to receive your personal data in a structured, commonly used, and machine-readable format.'
    },
    {
      title: 'Right to Non-Discrimination',
      scope: 'CCPA § 1798.125',
      description: 'We will never deny services, charge different prices, or degrade quality if you choose to exercise your privacy rights.'
    }
  ];

  readonly collectionCategories: CollectionCategory[] = [
    {
      title: 'Technical & Operational Data',
      subtitle: 'Automatically logged strictly for network delivery and DDoS mitigation',
      items: [
        'Internet Protocol (IP) address (transiently held for rate-limiting and DDoS defense)',
        'Browser metadata: user-agent string, browser engine version, and operating system',
        'Request timestamps, HTTP headers, referring endpoints, and response status codes',
        'Language preference (stored locally in browser localStorage for UI adaptation)'
      ]
    },
    {
      title: 'Support & Inquiries Data',
      subtitle: 'Voluntarily provided when submitting a ticket through our Contact page',
      items: [
        'Full name and business or personal contact email address',
        'Inquiry subject, user classification (individual or company), and product interests',
        'Detailed message body and communication thread history',
        'Automatically assigned ticket reference code (e.g., TKT-2026-XXXXX)'
      ]
    },
    {
      title: 'What We Strictly Do NOT Collect',
      subtitle: 'Data types deliberately excluded from our platform architecture',
      items: [
        'Document content indexing: We never scan, OCR, read, or catalog your file contents',
        'Model training data: Your files are never used to train AI or machine learning models',
        'Credit card numbers, bank account details, or billing addresses',
        'Government identifiers, passports, driver licenses, or biometric/health information',
        'Third-party cross-site advertising identifiers, cookies, or tracking beacons'
      ]
    }
  ];

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'Privacy Policy — PDFTailor Document Processing & Data Protection',
      description: 'Read the PDFTailor Privacy Policy. Learn how our client-side WebAssembly architecture and ephemeral conversion pipelines protect your files and personal data.',
      keywords: [
        'pdftailor privacy policy',
        'document privacy',
        'client-side data protection',
        'pdf security',
        'gdpr compliance',
        'file privacy'
      ],
      canonical: 'https://pdftailor.in/privacy-policy',
      faqs: []
    });

    this.injectJsonLdSchema();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (typeof window === 'undefined') return;
    this.showBackToTop.set(window.scrollY > 400);
  }

  scrollToTop(): void {
    if (typeof window === 'undefined') return;
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  private injectJsonLdSchema(): void {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('privacy-jsonld-schema');
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = 'privacy-jsonld-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': 'https://pdftailor.in/privacy-policy#webpage',
          'url': 'https://pdftailor.in/privacy-policy',
          'name': 'Privacy Policy — PDFTailor',
          'description': 'Comprehensive privacy policy and document retention disclosure for PDFTailor services.',
          'publisher': {
            '@id': 'https://pdftailor.in/#organization'
          }
        }
      ]
    });

    document.head.appendChild(script);
  }
}
