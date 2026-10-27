import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { SeoService } from '../../core/services/seo.service';

interface BrandAssetItem {
  id: string;
  name: string;
  category: string;
  format: 'SVG' | 'PNG' | 'ICO';
  dimensions: string;
  filesize: string;
  previewUrl: string;
  downloadUrl: string;
  bgMode: 'light' | 'dark' | 'checker';
  description: string;
  guidelines: string;
}

interface ColorToken {
  name: string;
  role: string;
  hex: string;
  rgb: string;
  cmyk: string;
  isDarkText: boolean;
}

@Component({
  selector: 'app-press-media-kit',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './press-media-kit.component.html',
  styleUrl: './press-media-kit.component.css'
})
export class PressMediaKitComponent implements OnInit {
  private seo = inject(SeoService);

  readonly copiedId = signal<string | null>(null);

  readonly officialInfo = {
    name: 'PDF flow (also known as PDF&Doc)',
    url: 'https://pdfflow.app',
    tagline: 'Private, High-Speed Document Processing Without the Cloud Drag',
    founded: 'Production Architecture Active 2026',
    headquarters: 'Distributed / Cloud Edge & Client-Side Execution',
    pressContact: 'jhonesjr01@gmail.com',
    supportRoute: '/contact-us'
  };

  readonly shortBoilerplate = 
    `PDF flow (PDF&Doc) is a privacy-first web document processing platform providing fast, browser-based PDF utilities. Built with modern WebAssembly and minimal server footprint, PDF flow empowers users to merge, split, compress, and convert documents without forced accounts, file retention, or invasive ad-tracking networks.`;

  readonly extendedBoilerplate = 
    `PDF flow (PDF&Doc) is a modern web-based document platform engineered for privacy, speed, and usability. By executing supported file manipulations directly inside the user's browser sandbox via WebAssembly and limiting complex conversions to ephemeral, RAM-only processing without permanent disk storage, PDF flow sets a new standard for document utility confidentiality. The platform provides over twenty specialized PDF workflows—including conversion, page extraction, password encryption, and compression—free of mandatory account signups and third-party advertising trackers.`;

  readonly colorTokens: ColorToken[] = [
    {
      name: 'Coral Primary',
      role: 'Core brand identity, key buttons, and active accent elements',
      hex: '#E53935',
      rgb: 'rgb(229, 57, 53)',
      cmyk: 'C:0 M:75 Y:77 K:10',
      isDarkText: false
    },
    {
      name: 'Coral Warm',
      role: 'Gradients, highlight badges, and hover focus states',
      hex: '#FF553E',
      rgb: 'rgb(255, 85, 62)',
      cmyk: 'C:0 M:67 Y:76 K:0',
      isDarkText: false
    },
    {
      name: 'Deep Slate',
      role: 'Primary headlines, high-contrast containers, and dark-mode bars',
      hex: '#0F172A',
      rgb: 'rgb(15, 23, 42)',
      cmyk: 'C:64 M:45 Y:0 K:84',
      isDarkText: false
    },
    {
      name: 'Muted Slate',
      role: 'Subtitles, secondary labels, borders, and metadata text',
      hex: '#475569',
      rgb: 'rgb(100, 116, 139)',
      cmyk: 'C:28 M:16 Y:0 K:45',
      isDarkText: false
    },
    {
      name: 'Canvas White',
      role: 'Page canvas, primary cards, and editorial content backgrounds',
      hex: '#FFFFFF',
      rgb: 'rgb(255, 255, 255)',
      cmyk: 'C:0 M:0 Y:0 K:0',
      isDarkText: true
    },
    {
      name: 'Emerald Verified',
      role: 'Security badges, operational confirmations, and privacy indicators',
      hex: '#059669',
      rgb: 'rgb(5, 150, 105)',
      cmyk: 'C:97 M:0 Y:30 K:41',
      isDarkText: false
    }
  ];

  readonly brandAssets: BrandAssetItem[] = [
    {
      id: 'logo-primary-svg',
      name: 'Primary Brand Logo (Horizontal)',
      category: 'Official Logo / Vector',
      format: 'SVG',
      dimensions: '420 × 90 px (Scalable Vector)',
      filesize: '2.4 KB',
      previewUrl: '/pdf-flow-logo-primary.svg',
      downloadUrl: '/pdf-flow-logo-primary.svg',
      bgMode: 'light',
      description: 'The standard horizontal brandmark featuring the layered document heart emblem and Space Grotesk wordmark.',
      guidelines: 'Use on white or light neutral backgrounds. Maintain at least 24px clear margin around all sides.'
    },
    {
      id: 'logo-white-svg',
      name: 'White / Reverse Brand Logo',
      category: 'Official Logo / Dark Backgrounds',
      format: 'SVG',
      dimensions: '420 × 90 px (Scalable Vector)',
      filesize: '2.5 KB',
      previewUrl: '/pdf-flow-logo-white.svg',
      downloadUrl: '/pdf-flow-logo-white.svg',
      bgMode: 'dark',
      description: 'The inverted white wordmark variant designed specifically for dark backgrounds, slate containers, and video overlays.',
      guidelines: 'Exclusively for dark slate (#0F172A) or black backgrounds. Do not apply over light surfaces.'
    },
    {
      id: 'mark-coral-svg',
      name: 'Brand Symbol / App Icon',
      category: 'Logomark / Icon',
      format: 'SVG',
      dimensions: '120 × 120 px (Scalable Vector)',
      filesize: '1.8 KB',
      previewUrl: '/pdf-flow-mark-coral.svg',
      downloadUrl: '/pdf-flow-mark-coral.svg',
      bgMode: 'light',
      description: 'Standalone layered document heart symbol for mobile app icons, favicons, social avatars, and square containers.',
      guidelines: 'Minimum rendering size is 24 × 24 px. Do not alter internal angle or heart proportion.'
    },
    {
      id: 'logo-png-hi-res',
      name: 'High-Resolution Brand Logo',
      category: 'Raster Image / Print & Web',
      format: 'PNG',
      dimensions: '1000 × 1000 px',
      filesize: '1.05 MB',
      previewUrl: '/logo.png',
      downloadUrl: '/logo.png',
      bgMode: 'checker',
      description: 'Master high-density transparent PNG export for print layouts, slide presentations, and raster publishing.',
      guidelines: 'High-resolution lossless asset with alpha transparency channel. Do not apply drop shadows or bevels.'
    },
    {
      id: 'favicon-ico',
      name: 'Browser Favicon Package',
      category: 'Web Asset',
      format: 'ICO',
      dimensions: 'Multi-resolution (16/32/48 px)',
      filesize: '15.1 KB',
      previewUrl: '/favicon.ico',
      downloadUrl: '/favicon.ico',
      bgMode: 'light',
      description: 'Standard multi-layer ICO container for browser tab headers and bookmark icons.',
      guidelines: 'Use strictly for browser tab bookmarks and application shortcut links.'
    }
  ];

  readonly confirmedFacts = [
    {
      title: 'Browser-Local Execution',
      detail: 'Core PDF manipulations (merging, splitting, page rotation) run directly inside client WebAssembly, requiring zero cloud upload.'
    },
    {
      title: 'Ephemeral Cloud Architecture',
      detail: 'Complex document conversions execute in isolated, RAM-only server environments with automated memory wipe upon file completion.'
    },
    {
      title: 'Zero Forced Accounts',
      detail: 'Users can convert, merge, compress, and edit documents immediately without registration, passwords, or credit card collection.'
    },
    {
      title: 'No Third-Party Ad Trackers',
      detail: 'PDF flow contains zero Meta pixels, Google AdSense tags, or behavioral remarketing beacons. We do not sell user data.'
    },
    {
      title: '20+ Specialized Utilities',
      detail: 'Comprehensive suite covering PDF conversion (Word, Excel, PowerPoint, JPG), page extraction, OCR, compression, encryption, and repair.'
    },
    {
      title: 'Universal Device Support',
      detail: 'Fully responsive web application optimized for modern Chromium, WebKit, and Gecko browser engines across desktop, tablet, and mobile.'
    }
  ];

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'Press & Media Kit — Official Brand Assets & Resources | PDF flow',
      description: 'Download official high-resolution logos, brand guidelines, color palettes, and verified product information for PDF flow / PDF&Doc.',
      keywords: [
        'pdf flow press kit',
        'pdf flow media kit',
        'pdf flow logo download',
        'brand assets',
        'official press resources',
        'pdf and doc brand kit'
      ],
      canonical: 'https://pdfflow.app/press-media-kit',
      faqs: []
    });
  }

  copyToClipboard(text: string, id: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.copiedId.set(id);
        setTimeout(() => {
          if (this.copiedId() === id) {
            this.copiedId.set(null);
          }
        }, 2200);
      }).catch(() => {
        this.fallbackCopy(text, id);
      });
    } else {
      this.fallbackCopy(text, id);
    }
  }

  private fallbackCopy(text: string, id: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.copiedId.set(id);
      setTimeout(() => {
        if (this.copiedId() === id) {
          this.copiedId.set(null);
        }
      }, 2200);
    } catch {
      // Ignore
    }
  }
}
