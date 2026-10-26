import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

interface FaqItem {
  question: string;
  answer: string;
}

interface ToolItem {
  id: string;
  name: string;
  route: string;
  description: string;
  executionMode: 'browser' | 'hybrid';
}

interface ToolCategoryGroup {
  category: string;
  description: string;
  tools: ToolItem[];
}

interface ExecutionSpec {
  category: string;
  tools: string;
  executionEngine: string;
  networkTransfer: string;
  retention: string;
}

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css'
})
export class AboutUsComponent implements OnInit {
  private seo = inject(SeoService);

  readonly expandedFaq = signal<number | null>(0);

  readonly faqs: FaqItem[] = [
    {
      question: 'Are my files uploaded to your servers when I merge, split, or compress PDFs?',
      answer: 'No. Core document utilities—including Merge PDF, Split PDF, Compress PDF, Rotate, and Organize—execute entirely inside your browser using WebAssembly and client-side JavaScript. Your files are read into local memory and processed on your device’s CPU. No document data is transmitted across the internet.'
    },
    {
      question: 'How do server-assisted tools like PDF to Word handle document privacy?',
      answer: 'For complex layout reconstruction that requires deep geometry parsing and DOCX XML synthesis, files are transmitted over an encrypted TLS connection directly to our conversion engine. The file is processed strictly in ephemeral RAM and the resulting document is returned to you. The temporary memory is immediately purged upon response completion. We do not store files on persistent disk, do not inspect document content, and never use user files to train AI models.'
    },
    {
      question: 'Is PDF flow free, and are there file limits?',
      answer: 'Yes, PDF flow is completely free for everyday use without forced watermarks or mandatory account signups. To ensure smooth browser performance and prevent browser tab crashes on personal computers, we set practical limits (for example, up to 30 files or 50 MB per task for merging).'
    },
    {
      question: 'Does PDF flow work across desktop, tablet, and mobile devices?',
      answer: 'Yes. Because PDF flow is built entirely on modern web standards (HTML5, WebAssembly, and Canvas APIs), it works uniformly across Google Chrome, Apple Safari, Mozilla Firefox, and Microsoft Edge on macOS, Windows, Linux, iOS, and Android without requiring software downloads or browser extensions.'
    },
    {
      question: 'Why does PDF flow offer 26+ languages?',
      answer: 'Document workflows are universal. We localized PDF flow into 26+ native languages so students, legal professionals, and teams worldwide can manipulate sensitive documents with confidence in their native language.'
    }
  ];

  readonly executionSpecs: ExecutionSpec[] = [
    {
      category: 'Core Document Utilities',
      tools: 'Merge, Split, Rotate, Organize, Compress',
      executionEngine: 'In-browser sandbox (WebAssembly & JS)',
      networkTransfer: 'Zero bytes uploaded (100% local)',
      retention: '0 seconds (flushed when tab closes)'
    },
    {
      category: 'Layout Reconstruction',
      tools: 'PDF to Word (DOCX)',
      executionEngine: 'Ephemeral memory conversion engine',
      networkTransfer: 'Encrypted in-transit stream (TLS 1.3)',
      retention: 'Purged immediately after output delivery'
    },
    {
      category: 'Document Security',
      tools: 'Protect PDF, Unlock PDF',
      executionEngine: 'Local client-side cryptography',
      networkTransfer: 'Zero bytes uploaded (100% local)',
      retention: 'Passwords never leave your browser'
    }
  ];

  readonly toolGroups: ToolCategoryGroup[] = [
    {
      category: 'Organize & Structure',
      description: 'Rearrange, combine, and clean multi-page document packages.',
      tools: [
        { id: 'merge-pdf', name: 'Merge PDF', route: '/merge-pdf', description: 'Combine multiple PDFs into a single document.', executionMode: 'browser' },
        { id: 'split-pdf', name: 'Split PDF', route: '/split-pdf', description: 'Separate pages or extract specific ranges.', executionMode: 'browser' },
        { id: 'organize-pdf', name: 'Organize PDF', route: '/organize-pdf', description: 'Reorder, rotate, or delete individual pages.', executionMode: 'browser' },
        { id: 'remove-pages', name: 'Remove Pages', route: '/remove-pages', description: 'Delete unnecessary pages from your file.', executionMode: 'browser' }
      ]
    },
    {
      category: 'Optimize & Convert',
      description: 'Reduce file overhead and transform documents across formats.',
      tools: [
        { id: 'compress-pdf', name: 'Compress PDF', route: '/compress-pdf', description: 'Shrink file size while preserving readability.', executionMode: 'browser' },
        { id: 'pdf-to-word', name: 'PDF to Word', route: '/pdf-to-word', description: 'Reconstruct layouts, tables, and text into DOCX.', executionMode: 'hybrid' },
        { id: 'pdf-to-excel', name: 'PDF to Excel', route: '/pdf-to-excel', description: 'Extract tabular records into clean spreadsheets.', executionMode: 'hybrid' },
        { id: 'word-to-pdf', name: 'Word to PDF', route: '/word-to-pdf', description: 'Convert editable DOCX files into fixed-layout PDFs.', executionMode: 'hybrid' }
      ]
    },
    {
      category: 'Edit & Security',
      description: 'Annotate, stamp, and protect sensitive legal and personal records.',
      tools: [
        { id: 'protect-pdf', name: 'Protect PDF', route: '/protect-pdf', description: 'Encrypt documents with client-side passwords.', executionMode: 'browser' },
        { id: 'unlock-pdf', name: 'Unlock PDF', route: '/unlock-pdf', description: 'Remove password restrictions from your files.', executionMode: 'browser' },
        { id: 'rotate-pdf', name: 'Rotate PDF', route: '/rotate-pdf', description: 'Correct portrait and landscape page orientations.', executionMode: 'browser' },
        { id: 'watermark-pdf', name: 'Watermark PDF', route: '/watermark-pdf', description: 'Add custom text or image stamps to pages.', executionMode: 'browser' }
      ]
    }
  ];

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'About PDF flow — Straightforward, Privacy-First Document Tools',
      description: 'PDF flow provides straightforward, browser-first PDF utilities. Learn how our client-side WebAssembly architecture and ephemeral processing keep your documents private.',
      keywords: [
        'about pdf flow',
        'browser pdf tools',
        'client-side pdf processing',
        'private pdf tools',
        'pdf security and privacy',
        'webassembly pdf'
      ],
      canonical: 'https://pdfflow.app/about-us',
      faqs: this.faqs
    });

    this.injectJsonLdSchema();
  }

  toggleFaq(index: number): void {
    this.expandedFaq.update(current => (current === index ? null : index));
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
          '@id': 'https://pdfflow.app/about-us#webpage',
          'url': 'https://pdfflow.app/about-us',
          'name': 'About Us — PDF flow',
          'description': 'Straightforward, browser-native PDF tools built with client-side privacy.',
          'publisher': {
            '@id': 'https://pdfflow.app/#organization'
          }
        },
        {
          '@type': 'Organization',
          '@id': 'https://pdfflow.app/#organization',
          'name': 'PDF flow',
          'url': 'https://pdfflow.app/',
          'description': 'Privacy-first document productivity utilities running in your browser.',
          'sameAs': []
        }
      ]
    });

    document.head.appendChild(script);
  }
}
