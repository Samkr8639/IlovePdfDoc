import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { SeoService } from '../../core/services/seo.service';

interface ArchitectureModel {
  badge: string;
  badgeClass: string;
  title: string;
  scope: string;
  executionEnvironment: string;
  networkTransmission: string;
  storagePersistence: string;
  lifecycle: string;
}

interface ThreatRow {
  threatVector: string;
  riskDescription: string;
  technicalMitigation: string;
  residualRisk: string;
}

interface SecurityControlItem {
  control: string;
  implementation: string;
  status: 'Verified Implemented' | 'Planned Roadmap';
  details: string;
}

interface LifecycleStep {
  step: string;
  phase: string;
  clientBehavior: string;
  serverBehavior: string;
}

@Component({
  selector: 'app-security-whitepaper',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './security-whitepaper.component.html',
  styleUrl: './security-whitepaper.component.css'
})
export class SecurityWhitepaperComponent implements OnInit {
  private seo = inject(SeoService);

  readonly architectureModels: ArchitectureModel[] = [
    {
      badge: 'Model A · Primary Architecture',
      badgeClass: 'pill-green',
      title: 'Client-Side WebAssembly Sandbox',
      scope: 'Merge, Split, Rotate, Compress, Organize, Protect, Unlock',
      executionEnvironment: 'Local browser thread memory (HTML5 / WebAssembly / pdf-lib)',
      networkTransmission: '0 bytes of document content leave the client machine',
      storagePersistence: '0 seconds. No external storage or server logging',
      lifecycle: 'Instantly cleared when browser tab or worker terminates'
    },
    {
      badge: 'Model B · Ephemeral Server Pipeline',
      badgeClass: 'pill-blue',
      title: 'Volatile RAM Streaming Buffer',
      scope: 'PDF to Word (DOCX) Conversions & OCR Text Reconstruction',
      executionEnvironment: 'Isolated Node.js microservice process memory (multer.memoryStorage)',
      networkTransmission: 'Encrypted via TLS 1.3 in-transit over HTTPS endpoints',
      storagePersistence: 'Volatile RAM only. 0 bytes written to persistent disks or databases',
      lifecycle: 'Auto-purged via garbage collection or within maximum 60 minutes'
    }
  ];

  readonly lifecycleSteps: LifecycleStep[] = [
    {
      step: '01',
      phase: 'Selection & File Ingestion',
      clientBehavior: 'User selects PDF files using the browser file picker API. Files reside strictly in client device memory.',
      serverBehavior: 'No server interaction occurs for client-side tools. For conversion tools, file selection remains purely local until convert action is initiated.'
    },
    {
      step: '02',
      phase: 'Header & Boundary Validation',
      clientBehavior: 'Client inspects PDF magic byte header (%PDF-), verifies non-zero byte size, and checks password flags.',
      serverBehavior: 'Server enforces strict Multer limits (50MB per file, max 10 files) and runs validatePdfInput() checking magic bytes, page count, and encryption.'
    },
    {
      step: '03',
      phase: 'Document Processing',
      clientBehavior: 'Operations execute locally via pdf-lib WebAssembly modules. CPU and memory utilization are isolated to user browser tab.',
      serverBehavior: 'Server parses text streams via pdf-parse/docx inside volatile memory buffers. Document contents are never indexed or fed into AI models.'
    },
    {
      step: '04',
      phase: 'Result Generation & Delivery',
      clientBehavior: 'New PDF binary blob is assembled in browser memory and passed directly to local browser download manager.',
      serverBehavior: 'Server compiles DOCX or ZIP binary buffer in volatile memory and responds with binary stream. Download URL is cryptographically random (UUIDv4).'
    },
    {
      step: '05',
      phase: 'Disposal & Memory Zeroization',
      clientBehavior: 'Document bytes are freed immediately upon tab close, reload, or page change by browser garbage collector.',
      serverBehavior: 'In-memory job records expire and are pruned within 60 minutes (JOB_RETENTION_MS). Manual immediate deletion is supported via DELETE API.'
    }
  ];

  readonly threatMatrix: ThreatRow[] = [
    {
      threatVector: 'Malicious / Exploitative PDF Files',
      riskDescription: 'Corrupted PDFs, malformed cross-reference tables, or exploit payloads targeting parser vulnerabilities.',
      technicalMitigation: 'Magic byte inspection (%PDF-), pdf-lib structural verification, and isolated memory parsing. Server rejects unparsable streams with HTTP 422.',
      residualRisk: 'Zero-day parser memory vulnerabilities; mitigated by isolated sandboxed execution and frequent dependency updates.'
    },
    {
      threatVector: 'Eavesdropping & In-Transit Interception',
      riskDescription: 'Interception of documents during network upload/download for server-assisted conversions.',
      technicalMitigation: 'Mandatory HTTPS with TLS 1.3 and HSTS headers enforced via Helmet middleware. Cleartext HTTP requests are dropped or redirected.',
      residualRisk: 'Compromised client-side device or rogue proxy certificates installed on user operating system.'
    },
    {
      threatVector: 'Unauthorized Download Access (IDOR)',
      riskDescription: 'Third party attempting to guess or brute-force conversion download URLs to access another user document.',
      technicalMitigation: 'Download endpoints utilize 128-bit cryptographically secure UUIDv4 identifiers (e.g., /jobs/{uuid}/download/{uuid}) with 60-minute time-to-live.',
      residualRisk: 'Unauthorized access is impossible without possession of the exact 36-character random UUID token.'
    },
    {
      threatVector: 'Denial of Service (DoS) & Memory Exhaustion',
      riskDescription: 'Oversized file payloads or rapid-fire conversions intended to exhaust server memory buffers.',
      technicalMitigation: 'Hard limits enforced at HTTP server boundary: max 50MB per file, max 10 files per request, 10MB JSON body limits, and job memory auto-pruning.',
      residualRisk: 'Distributed flood traffic requiring reverse-proxy edge rate-limiting and DDoS mitigation (Cloudflare/CDN).'
    },
    {
      threatVector: 'Secondary Data Ingestion / AI Training',
      riskDescription: 'User documents being scanned, cataloged, or repurposed for artificial intelligence or machine learning datasets.',
      technicalMitigation: 'Zero persistent storage architecture. Server code does not contain database writes, external analytics beacons, or telemetry logging.',
      residualRisk: 'None. Document text layers exist only transiently in RAM buffers during the conversion runtime.'
    }
  ];

  readonly securityControls: SecurityControlItem[] = [
    {
      control: 'Security HTTP Headers (Helmet)',
      implementation: 'helmet() middleware deployed in API pipeline',
      status: 'Verified Implemented',
      details: 'Sets X-Content-Type-Options: nosniff, X-Frame-Options, Strict-Transport-Security, and removes X-Powered-By.'
    },
    {
      control: 'Strict CORS Policy',
      implementation: 'cors() configured with explicit origin and method restrictions',
      status: 'Verified Implemented',
      details: 'Only permitted frontend origins can invoke conversion endpoints; restricted to GET, POST, DELETE, OPTIONS.'
    },
    {
      control: 'Volatile RAM Storage Only',
      implementation: 'multer.memoryStorage() in Node.js conversion service',
      status: 'Verified Implemented',
      details: 'Files reside in Node.js Buffer memory. No disk-write logic (fs.writeFile to disk) exists in production conversion pipeline.'
    },
    {
      control: 'Automated 60-Minute Memory Purge',
      implementation: 'In-memory jobStore with pruneExpiredJobs() periodic cleanup',
      status: 'Verified Implemented',
      details: 'Every job auto-expires 60 minutes after generation. Manual deletion supported via DELETE /api/v1/pdf-to-word/jobs/:jobId.'
    },
    {
      control: 'Zero User Account Databases',
      implementation: 'Stateless, anonymous architecture',
      status: 'Verified Implemented',
      details: 'No user tables, passwords, or persistent session tokens are stored, eliminating credential stuffing and account takeover risks.'
    },
    {
      control: 'Isolated MicroVM Worker Sandboxing',
      implementation: 'Process isolation for high-risk format conversions',
      status: 'Planned Roadmap',
      details: 'Future architectural enhancement to execute server-assisted format transformations in ephemeral gVisor/Wasm microVM containers.'
    },
    {
      control: 'End-to-End Client Encryption for Server Conversions',
      implementation: 'Pre-upload envelope encryption with client key exchange',
      status: 'Planned Roadmap',
      details: 'Enabling client-side encryption of server conversion buffers where only the browser possesses decryption keys.'
    }
  ];

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'Security Architecture & Document Processing Whitepaper — PDF flow',
      description: 'Review the technical security whitepaper for PDF flow. Explore our client-side WebAssembly execution, volatile RAM conversion buffers, and threat mitigations.',
      keywords: [
        'pdf flow security whitepaper',
        'pdf security architecture',
        'document processing security',
        'client-side webassembly pdf',
        'volatile ram conversion',
        'pdf privacy controls',
        'threat model pdf'
      ],
      canonical: 'https://pdfflow.app/security-whitepaper',
      faqs: []
    });
  }
}
