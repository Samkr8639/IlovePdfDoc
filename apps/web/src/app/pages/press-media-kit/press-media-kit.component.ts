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
    name: 'PDFTailor',
    url: 'https://pdftailor.in',
    tagline: 'Private, High-Speed Document Processing in Your Browser',
    founded: 'Production Architecture Active 2026',
    headquarters: 'Distributed / Cloud Edge & Client-Side Execution',
    pressContact: 'jhonesjr01@gmail.com',
    supportRoute: '/contact-us'
  };

  readonly shortBoilerplate = 
    `PDFTailor is a privacy-first web document processing platform providing fast, browser-based PDF utilities. Built with modern WebAssembly and minimal server footprint, PDFTailor empowers users to merge, split, compress, and convert documents without forced accounts, file retention, or invasive ad-tracking networks.`;

  readonly extendedBoilerplate = 
    `PDFTailor is a bespoke web-based document platform engineered for privacy, speed, and usability. By executing supported file manipulations directly inside the user's browser sandbox via WebAssembly and limiting complex conversions to ephemeral, RAM-only processing without permanent disk storage, PDFTailor sets a new standard for document utility confidentiality. The platform provides specialized PDF workflows—including conversion, page extraction, password encryption, and compression—free of mandatory account signups and third-party advertising trackers.`;

  readonly colorTokens: ColorToken[] = [
    {
      name: 'Primary Navy',
      role: 'Core brand identity, key navigation bars, and high-contrast containers',
      hex: '#14213D',
      rgb: 'rgb(20, 33, 61)',
      cmyk: 'C:67 M:46 Y:0 K:76',
      isDarkText: false
    },
    {
      name: 'Teal Accent',
      role: 'Action buttons, active highlights, links, and focal interactive elements',
      hex: '#0F766E',
      rgb: 'rgb(15, 118, 110)',
      cmyk: 'C:87 M:0 Y:7 K:54',
      isDarkText: false
    },
    {
      name: 'Teal Hover',
      role: 'Hover elevation states and darker active button borders',
      hex: '#0B5D57',
      rgb: 'rgb(11, 93, 87)',
      cmyk: 'C:88 M:0 Y:6 K:64',
      isDarkText: false
    },
    {
      name: 'Deep Ink',
      role: 'Primary typography, readable headlines, and deep text contrast',
      hex: '#0B1220',
      rgb: 'rgb(11, 18, 32)',
      cmyk: 'C:66 M:44 Y:0 K:87',
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
      name: 'Amber Highlight',
      role: 'Status badges, live indicators, and special highlights',
      hex: '#D98E04',
      rgb: 'rgb(217, 142, 4)',
      cmyk: 'C:0 M:35 Y:98 K:15',
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
      filesize: '1.2 KB',
      previewUrl: '/pdftailor-logo.svg',
      downloadUrl: '/pdftailor-logo.svg',
      bgMode: 'light',
      description: 'The standard horizontal brandmark featuring the tailored document emblem and Sora wordmark.',
      guidelines: 'Use on white or light neutral backgrounds. Maintain at least 24px clear margin around all sides.'
    },
    {
      id: 'logo-white-svg',
      name: 'White / Reverse Brand Logo',
      category: 'Official Logo / Dark Backgrounds',
      format: 'SVG',
      dimensions: '420 × 90 px (Scalable Vector)',
      filesize: '1.2 KB',
      previewUrl: '/pdftailor-logo-white.svg',
      downloadUrl: '/pdftailor-logo-white.svg',
      bgMode: 'dark',
      description: 'The inverted white wordmark variant designed specifically for dark backgrounds, navy containers, and video overlays.',
      guidelines: 'Exclusively for dark navy (#14213D) or black backgrounds. Do not apply over light surfaces.'
    },
    {
      id: 'mark-teal-svg',
      name: 'Brand Symbol / App Icon',
      category: 'Logomark / Icon',
      format: 'SVG',
      dimensions: '120 × 120 px (Scalable Vector)',
      filesize: '0.9 KB',
      previewUrl: '/pdftailor-icon.svg',
      downloadUrl: '/pdftailor-icon.svg',
      bgMode: 'light',
      description: 'Standalone tailored document symbol for mobile app icons, favicons, social avatars, and square containers.',
      guidelines: 'Minimum rendering size is 24 × 24 px. Do not alter internal proportions.'
    },
    {
      id: 'mark-white-svg',
      name: 'White App Icon / Symbol',
      category: 'Logomark / Icon',
      format: 'SVG',
      dimensions: '120 × 120 px (Scalable Vector)',
      filesize: '0.9 KB',
      previewUrl: '/pdftailor-icon-white.svg',
      downloadUrl: '/pdftailor-icon-white.svg',
      bgMode: 'dark',
      description: 'White monochrome tailored document emblem with luminous teal accent for dark backgrounds.',
      guidelines: 'Use on dark surfaces or inverted themes.'
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
      detail: 'PDFTailor contains zero Meta pixels, Google AdSense tags, or behavioral remarketing beacons. We do not sell user data.'
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
      title: 'Press & Media Kit — Official Brand Assets & Resources | PDFTailor',
      description: 'Download official high-resolution logos, brand guidelines, color palettes, and verified product information for PDFTailor.',
      keywords: [
        'pdftailor press kit',
        'pdftailor media kit',
        'pdftailor logo download',
        'brand assets',
        'official press resources',
        'pdftailor brand kit'
      ],
      canonical: 'https://pdftailor.in/press-media-kit',
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
