import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css'
})
export class AboutUsComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'About Us - The Story & Mission Behind PDF flow | Free & Secure PDF Tools',
      description: 'Learn about PDF flow’s mission to make document tools accessible, 100% private, and fast for everyone worldwide. Discover our client-side technology, privacy principles, and global impact.',
      keywords: [
        'about pdf flow',
        'pdf tools mission',
        'client-side pdf processing',
        'private document editing',
        'secure pdf tools',
        'browser pdf editor'
      ],
      canonical: 'https://paperflow.app/about-us',
      faqs: [
        {
          question: 'Is PDF flow really 100% free to use?',
          answer: 'Yes! All core tools are completely free to use with generous file limits and zero hidden subscriptions.'
        },
        {
          question: 'Are my files and sensitive documents safe?',
          answer: 'Absolutely. Because our tools execute in your browser runtime via WebAssembly, your documents never travel to external storage.'
        },
        {
          question: 'Do I need to download or install any desktop software?',
          answer: 'No installation is required. PDF flow operates directly inside modern web browsers like Chrome, Firefox, Safari, and Edge.'
        },
        {
          question: 'How does PDF flow handle multiple languages?',
          answer: 'You can switch between 26+ native languages instantly using the language selector in our footer.'
        }
      ]
    });

    this.injectJsonLdSchema();
  }

  private injectJsonLdSchema(): void {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('about-jsonld-schema');
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = 'about-jsonld-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'AboutPage',
          '@id': 'https://paperflow.app/about-us#webpage',
          'url': 'https://paperflow.app/about-us',
          'name': 'About Us - PDF flow',
          'description': 'PDF flow is an online document toolkit providing client-side private PDF editing and conversion.',
          'publisher': {
            '@id': 'https://paperflow.app/#organization'
          }
        },
        {
          '@type': 'Organization',
          '@id': 'https://paperflow.app/#organization',
          'name': 'PDF flow',
          'url': 'https://paperflow.app/',
          'logo': 'https://paperflow.app/favicon.ico',
          'description': 'Modern, 100% private in-browser PDF utilities and document productivity toolkit.',
          'sameAs': [
            'https://x.com',
            'https://linkedin.com',
            'https://facebook.com'
          ]
        }
      ]
    });

    document.head.appendChild(script);
  }
}
