import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

interface ServiceSpecRow {
  category: string;
  boundary: string;
  legalBasis: string;
  userProtection: string;
}

interface StatutoryCard {
  title: string;
  scope: string;
  description: string;
}

interface TermsGroup {
  title: string;
  subtitle: string;
  items: string[];
}

@Component({
  selector: 'app-terms-and-conditions',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms-and-conditions.component.html',
  styleUrl: './terms-and-conditions.component.css'
})
export class TermsAndConditionsComponent implements OnInit {
  private seo = inject(SeoService);

  readonly serviceSpecs: ServiceSpecRow[] = [
    {
      category: 'In-Browser PDF Operations',
      boundary: 'Local browser RAM sandbox (WebAssembly/pdf-lib)',
      legalBasis: 'User-directed local processing; zero data transmission to external servers',
      userProtection: '100% private execution; zero persistent disk writes or network exposure'
    },
    {
      category: 'Server-Assisted Conversion',
      boundary: 'Volatile server RAM buffer (PDF to Word only)',
      legalBasis: 'Transient technical license strictly to execute the requested conversion',
      userProtection: 'Automatic memory zeroization; max 60-min TTL; zero disk storage'
    },
    {
      category: 'User Document Ownership',
      boundary: 'User retains 100% exclusive title and copyright',
      legalBasis: 'Zero acquisition of ownership, licensing, or commercial derivative rights',
      userProtection: 'Strict guarantee against training AI, LLMs, or indexing file contents'
    },
    {
      category: 'Service Availability (SLA)',
      boundary: '99.9% uptime target over public internet',
      legalBasis: 'Delivered on an "As-Is" and "As-Available" basis without express warranties',
      userProtection: 'Open, transparent maintenance schedules and zero vendor lock-in'
    },
    {
      category: 'Limitation of Liability',
      boundary: 'Free service model ($0 subscriptions/fees)',
      legalBasis: 'Aggregate liability capped at greater of $0.00 or $50.00 USD',
      userProtection: 'Standard consumer protection safe-harbor under applicable jurisdiction'
    },
    {
      category: 'Dispute Resolution',
      boundary: '30-day informal good-faith resolution notice',
      legalBasis: 'Direct review by legal desk at jhonesjr01@gmail.com before arbitration',
      userProtection: 'Fair, informal mediation and severability of unenforceable clauses'
    }
  ];

  readonly statutoryCards: StatutoryCard[] = [
    {
      title: 'Disclaimer of Warranties ("As-Is")',
      scope: 'UCC & Uniform Commercial Code § 2-316',
      description: 'The service and document tools are provided "as-is" and "as-available" without warranties of merchantability, fitness for a particular purpose, or error-free conversion.'
    },
    {
      title: 'Limitation of Liability ($50 Cap)',
      scope: 'Statutory Liability Limitation',
      description: 'Because our tools are free, our maximum aggregate liability for any loss of documents, profits, or data corruption is limited to $0.00 (fees paid) or $50.00 USD.'
    },
    {
      title: 'User Indemnification',
      scope: 'Third-Party Infringement Defense',
      description: 'You agree to defend and indemnify PDFTailor against any claims arising from your breach of these terms or processing copyrighted content without authorization.'
    },
    {
      title: 'Access Throttling & Anti-Abuse',
      scope: 'Platform Defense & Security',
      description: 'We reserve the right to deploy automated rate-limiting, firewall defenses, or IP blocks to terminate automated scraping, DDoS attacks, or malicious payloads.'
    },
    {
      title: 'Governing Law & Severability',
      scope: 'Jurisdiction & Legal Interpretation',
      description: 'Terms are governed by applicable laws. If any clause is found invalid, remaining clauses remain enforceable, and disputes are subject to designated jurisdiction.'
    },
    {
      title: '30-Day Informal Resolution',
      scope: 'Amicable Dispute Settlement',
      description: 'Before initiating legal proceedings, parties agree to submit a 30-day good-faith notice to jhonesjr01@gmail.com to resolve matters informally and efficiently.'
    }
  ];

  readonly termsGroups: TermsGroup[] = [
    {
      title: 'User Document Ownership & Licensing',
      subtitle: 'Complete copyright sovereignty and limited technical execution license',
      items: [
        'You retain 100% complete, exclusive ownership, title, copyright, and IP rights in and to all uploaded documents',
        'You grant PDFTailor strictly a limited, non-exclusive, transient technical license solely to execute conversion and deliver output',
        'Zero AI Ingestion: We never feed, index, train, benchmark, or expose your documents or text to AI or LLM models',
        'You represent and warrant that you own the files or possess all lawful licenses and permissions to process them'
      ]
    },
    {
      title: 'Platform Intellectual Property & Assets',
      subtitle: 'Proprietary marks, UI design, codebases, and open-source acknowledgments',
      items: [
        'PDFTailor, logos, branding, UI designs, stylesheets, and custom code are proprietary property of PDFTailor',
        'You may not copy, mirror, reverse engineer, republish, or frame any proprietary platform assets without permission',
        'Underlying open-source components (e.g., pdf-lib, Angular, Node.js) remain subject to their respective MIT/Apache licenses',
        'No white-labeling or unauthorized commercial resale of our microservices is permitted without written consent'
      ]
    },
    {
      title: 'User Responsibilities & Prohibited Conduct',
      subtitle: 'Standards of lawful conduct, backup obligations, and safety requirements',
      items: [
        'Independent Backups: You must maintain original copies of all source files; we are not liable for accidental tab closures',
        'Zero Malware Tolerance: Uploading viruses, ransomware, trojans, or malicious macros is strictly prohibited',
        'Anti-Scraping: Automated crawlers, scrapers, and botnets that degrade platform performance are strictly blocked',
        'Lawful Processing Only: Using tools for CSAM, copyright infringement, fraud, defamation, or extortion is strictly barred'
      ]
    }
  ];

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'Terms & Conditions — PDFTailor Document Processing & Service Terms',
      description: 'Review the Terms and Conditions for PDFTailor. Engineered with complete user document ownership, zero AI training, and transparent client-side document processing.',
      keywords: [
        'pdftailor terms and conditions',
        'terms of service',
        'pdf tools terms',
        'document processing terms',
        'client-side privacy terms',
        'acceptable use policy',
        'user document ownership'
      ],
      canonical: 'https://pdftailor.in/terms-and-conditions',
      faqs: []
    });
  }
}
