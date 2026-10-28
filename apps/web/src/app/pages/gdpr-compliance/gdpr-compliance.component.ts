import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

interface FlowStep {
  number: string;
  title: string;
  actor: string;
  description: string;
  technicalReality: string;
}

interface GdprPrinciple {
  article: string;
  name: string;
  plainEnglish: string;
  implementationApproach: string;
}

interface SubjectRight {
  article: string;
  title: string;
  summary: string;
  practicalApplicability: string;
}

interface SecurityControl {
  domain: string;
  mechanism: string;
  status: string;
  verificationNotes: string;
}

@Component({
  selector: 'app-gdpr-compliance',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './gdpr-compliance.component.html',
  styleUrl: './gdpr-compliance.component.css'
})
export class GdprComplianceComponent implements OnInit {
  private seo = inject(SeoService);

  readonly dataFlowSteps: FlowStep[] = [
    {
      number: '01',
      title: 'Site Visit & Tool Selection',
      actor: 'User Web Browser',
      description: 'The user accesses PDFTailor and selects a document tool (e.g., Merge, Split, Compress, or PDF to Word).',
      technicalReality: 'Static WebAssembly binaries and UI scripts are downloaded to the browser cache. No tracking pixels or profiling cookies are dispatched.'
    },
    {
      number: '02',
      title: 'Local File Selection',
      actor: 'Device File System',
      description: 'The user selects or drags PDF documents from their local computer or mobile device into the workspace.',
      technicalReality: 'Files are read into local browser sandbox memory (RAM) via the HTML5 File API. For client-side tools, no bytes leave the device.'
    },
    {
      number: '03',
      title: 'Execution & Processing',
      actor: 'Client Engine or Transient API',
      description: 'The document operation is performed according to the specific tool architecture.',
      technicalReality: 'Core tools process 100% locally in-browser via pdf-lib/WebAssembly. PDF-to-Word uses TLS 1.3 streaming to ephemeral volatile server RAM.'
    },
    {
      number: '04',
      title: 'Result Delivery & Memory Purge',
      actor: 'Immediate Download',
      description: 'The processed file is compiled and offered immediately for download to the user device.',
      technicalReality: 'Browser RAM is freed when the session/tab closes. Ephemeral server buffers are garbage-collected immediately or purged within 60 minutes.'
    }
  ];

  readonly gdprPrinciples: GdprPrinciple[] = [
    {
      article: 'Art. 5(1)(a)',
      name: 'Lawfulness, Fairness & Transparency',
      plainEnglish: 'Personal data must be processed lawfully, fairly, and in a transparent manner in relation to the data subject.',
      implementationApproach: 'We do not require user accounts. We provide clear, verifiable architectural disclosures distinguishing client-side from ephemeral server tools.'
    },
    {
      article: 'Art. 5(1)(b)',
      name: 'Purpose Limitation',
      plainEnglish: 'Data must be collected for specified, explicit, and legitimate purposes and not further processed in a manner incompatible with those purposes.',
      implementationApproach: 'Uploaded files are handled strictly to execute the conversion or manipulation requested by the user. Document contents are never repurposed for AI training or commercial indexing.'
    },
    {
      article: 'Art. 5(1)(c)',
      name: 'Data Minimisation',
      plainEnglish: 'Personal data must be adequate, relevant, and limited to what is strictly necessary in relation to the purposes for which they are processed.',
      implementationApproach: 'By running processing inside the browser via WebAssembly whenever technically feasible, our systems avoid collecting document payloads altogether.'
    },
    {
      article: 'Art. 5(1)(d)',
      name: 'Accuracy',
      plainEnglish: 'Every reasonable step must be taken to ensure that personal data that are inaccurate are erased or rectified without delay.',
      implementationApproach: 'We do not maintain ongoing user profiles or persistent personal records. Support ticket details can be corrected upon request.'
    },
    {
      article: 'Art. 5(1)(e)',
      name: 'Storage Limitation',
      plainEnglish: 'Data must be kept in a form which permits identification of data subjects for no longer than is necessary for the purposes for which the personal data are processed.',
      implementationApproach: 'Client-side processing stores 0 seconds on our servers. Server conversion buffers reside exclusively in volatile RAM with automatic 60-minute garbage collection.'
    },
    {
      article: 'Art. 5(1)(f)',
      name: 'Integrity & Confidentiality',
      plainEnglish: 'Data must be processed in a manner that ensures appropriate security, including protection against unauthorised or unlawful processing and accidental loss.',
      implementationApproach: 'All network transmissions utilize TLS 1.3 encryption. Ephemeral server workloads operate in isolated containers with zero persistent disk writing.'
    },
    {
      article: 'Art. 5(2)',
      name: 'Accountability',
      plainEnglish: 'The data controller shall be responsible for, and be able to demonstrate compliance with, the principles.',
      implementationApproach: 'We publish verifiable technical explanations, maintain clear data retention schedules, and provide a direct privacy review desk.'
    }
  ];

  readonly subjectRights: SubjectRight[] = [
    {
      article: 'Art. 15',
      title: 'Right of Access',
      summary: 'You have the right to obtain confirmation as to whether personal data concerning you is being processed, and access to that data.',
      practicalApplicability: 'Because core PDF tools operate client-side without accounts, we hold no personal data for anonymous tool users. Support ticket submitters can request copies of their correspondence records.'
    },
    {
      article: 'Art. 16',
      title: 'Right to Rectification',
      summary: 'You have the right to have inaccurate personal data rectified without undue delay.',
      practicalApplicability: 'Applies to support tickets or communications submitted via our Contact portal. Contact our privacy desk to update email addresses or contact details.'
    },
    {
      article: 'Art. 17',
      title: 'Right to Erasure ("To Be Forgotten")',
      summary: 'You have the right to obtain the erasure of personal data concerning you without undue delay under specified statutory grounds.',
      practicalApplicability: 'Client-side document bytes are already self-erased upon browser closure. Server conversion buffers auto-purge within 60 minutes. Support inquiries can be manually purged upon request.'
    },
    {
      article: 'Art. 18',
      title: 'Right to Restriction of Processing',
      summary: 'You have the right to restrict the processing of your personal data under certain contested circumstances.',
      practicalApplicability: 'Relevant if you contest the accuracy of support ticket information or dispute processing pending resolution.'
    },
    {
      article: 'Art. 20',
      title: 'Right to Data Portability',
      summary: 'You have the right to receive personal data concerning you in a structured, commonly used, and machine-readable format.',
      practicalApplicability: 'Your converted and output PDF/Word files are provided directly to your local device. Any support correspondence records can be exported upon request.'
    },
    {
      article: 'Art. 21',
      title: 'Right to Object',
      summary: 'You have the right to object to processing based on legitimate interests or direct marketing.',
      practicalApplicability: 'We perform zero direct marketing, automated profiling, or ad targeting. You may object to the retention of support correspondence at any time.'
    },
    {
      article: 'Art. 7(3)',
      title: 'Right to Withdraw Consent',
      summary: 'Where processing is based on consent, you have the right to withdraw your consent at any time without affecting prior lawfulness.',
      practicalApplicability: 'You can terminate client-side processing at any instant by closing your browser tab. Consent for support communication can be withdrawn by emailing our desk.'
    },
    {
      article: 'Art. 77',
      title: 'Right to Lodge a Complaint',
      summary: 'You have the right to lodge a complaint with a competent supervisory authority in your EU Member State.',
      practicalApplicability: 'You may contact the Data Protection Authority (DPA) in the EU Member State of your habitual residence, place of work, or place of alleged infringement.'
    }
  ];

  readonly securityControls: SecurityControl[] = [
    {
      domain: 'Network Transport',
      mechanism: 'Strict TLS 1.3 Encryption',
      status: 'Enforced',
      verificationNotes: 'All web traffic and API endpoints require HTTPS with modern cipher suites. HSTS headers prevent protocol downgrade attacks.'
    },
    {
      domain: 'Document Memory Boundary',
      mechanism: 'Client-Side WebAssembly Sandbox',
      status: 'Active for Core Tools',
      verificationNotes: 'Merge, Split, Rotate, Compress, Protect, and Unlock execute inside browser memory (RAM) using pdf-lib. Zero document bytes uploaded.'
    },
    {
      domain: 'Server Conversion Buffer',
      mechanism: 'Volatile RAM Storage (multer.memoryStorage)',
      status: 'Active for PDF to Word',
      verificationNotes: 'Files stream into volatile memory buffers. No permanent disk write routines exist. Automated garbage collection purges memory within max 60 minutes.'
    },
    {
      domain: 'AI Ingestion Safeguard',
      mechanism: 'Strict Contractual & Architectural Exclusion',
      status: 'Enforced Zero Ingestion',
      verificationNotes: 'Documents are never indexed, cataloged, or fed into machine learning models, LLMs, or neural network training datasets.'
    },
    {
      domain: 'Analytics & Tracking',
      mechanism: 'No Third-Party Advertising Trackers',
      status: 'Zero Ad Pixels',
      verificationNotes: 'No Meta pixels, Google Ads tags, or cross-site commercial trackers are present in the web application bundles.'
    }
  ];

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'GDPR Compliance & Data Protection — PDFTailor',
      description: 'Explore the PDFTailor GDPR compliance framework. Verified disclosures on data flows, client-side processing, Art. 5 principles, and data subject rights.',
      keywords: [
        'pdftailor gdpr compliance',
        'data protection',
        'gdpr pdf tools',
        'client-side data privacy',
        'data subject rights',
        'article 5 principles',
        'privacy architecture'
      ],
      canonical: 'https://pdftailor.in/gdpr-compliance',
      faqs: []
    });
  }
}
