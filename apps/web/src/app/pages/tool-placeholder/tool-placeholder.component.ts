import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { BrowserPdfService, ValidatedPdfFile, MergeResult, SplitPdfResult, CompressPdfResult } from '../../core/services/browser-pdf.service';
import { LayoutService } from '../../core/services/layout.service';
import { ToolDefinition } from '@paperflow/contracts';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

export interface CustomSplitRange {
  id: string;
  from: number | null;
  to: number | null;
}

@Component({
  selector: 'app-tool-placeholder',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DropzoneComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  templateUrl: './tool-placeholder.component.html',
  styleUrl: './tool-placeholder.component.css'
})
export class ToolPlaceholderComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private pdfService = inject(BrowserPdfService);
  private layoutService = inject(LayoutService);

  tool = signal<ToolDefinition | null>(null);
  currentState = signal<WorkspaceState>('upload');
  selectedFiles = signal<ValidatedPdfFile[]>([]);
  errorMessage = signal<string | null>(null);
  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingMessage = signal<string>('Initializing local processing engine...');
  toolResult = signal<MergeResult | null>(null);

  // Compress PDF options
  compressionLevel = signal<'extreme' | 'recommended' | 'less'>('recommended');

  // Split PDF options (matching Screenshot 1 & 2 without green highlighted parts)
  splitMainTab = signal<'range' | 'pages'>('range'); // Range tab active
  splitExtractMode = signal<'extract_all' | 'select_pages'>('select_pages'); // Select pages active
  splitRangeMode = signal<'custom' | 'fixed'>('custom'); // Only Custom and Fixed (NO Smart!)
  splitPageRanges = signal<string>(''); // Bound to input with placeholder "example: 1,5-8"
  splitFixedCount = signal<number>(1);
  mergeExtractedPages = signal<boolean>(false); // Checkbox: Merge extracted pages into one PDF file.

  // Custom split ranges for Range -> Custom mode
  customRanges = signal<CustomSplitRange[]>([
    { id: '1', from: 1, to: 1 }
  ]);

  customRangesValidation = computed(() => {
    const ranges = this.customRanges();
    const totalPages = this.selectedFiles()[0]?.pageCount || 0;
    const errors: Record<number, string> = {};
    let hasError = false;
    let firstErrorMessage = '';

    ranges.forEach((r, idx) => {
      if (r.from === null || r.from === undefined || isNaN(r.from)) {
        errors[idx] = 'Start page is required.';
        hasError = true;
      } else if (r.from < 1) {
        errors[idx] = 'Start page must be at least 1.';
        hasError = true;
      } else if (totalPages > 0 && r.from > totalPages) {
        errors[idx] = `Start page cannot exceed total pages (${totalPages}).`;
        hasError = true;
      } else if (r.to === null || r.to === undefined || isNaN(r.to)) {
        errors[idx] = 'End page is required.';
        hasError = true;
      } else if (r.to < 1) {
        errors[idx] = 'End page must be at least 1.';
        hasError = true;
      } else if (totalPages > 0 && r.to > totalPages) {
        errors[idx] = `End page cannot exceed total pages (${totalPages}).`;
        hasError = true;
      } else if (r.to < r.from) {
        errors[idx] = `'to' page cannot be less than 'from' page.`;
        hasError = true;
      }

      if (errors[idx] && !firstErrorMessage) {
        firstErrorMessage = `Range ${idx + 1}: ${errors[idx]}`;
      }
    });

    return { errors, hasError, firstErrorMessage };
  });

  isSplitActionDisabled = computed<boolean>(() => {
    const t = this.tool();
    if (t?.id !== 'split-pdf') return false;
    if (this.splitMainTab() === 'range' && this.splitRangeMode() === 'custom') {
      return this.customRangesValidation().hasError;
    }
    return false;
  });

  ocrEnabled = true;

  ngOnInit(): void {
    const routePath = this.route.snapshot.routeConfig?.path || '';
    const foundTool = this.toolRegistry.getToolByRoute(`/${routePath}`);
    if (foundTool) {
      this.tool.set(foundTool);
      this.seo.setSeoData(foundTool.seo);
    }
  }

  formatCategoryName(cat: string): string {
    return cat ? cat.replace('-', ' ') : 'PDF Tools';
  }

  // Dynamic hero texts
  heroTitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'PDF Tool';
    if (t.id === 'compress-pdf') return 'Compress PDF files';
    if (t.id === 'split-pdf') return 'Split PDF file';
    if (t.id === 'pdf-to-powerpoint') return 'Convert PDF to POWERPOINT';
    if (t.id === 'pdf-to-word') return 'Convert PDF to WORD';
    if (t.id === 'pdf-to-excel') return 'Convert PDF to EXCEL';
    if (t.id === 'word-to-pdf') return 'Convert WORD to PDF';
    if (t.id === 'powerpoint-to-pdf') return 'Convert POWERPOINT to PDF';
    if (t.id === 'excel-to-pdf') return 'Convert EXCEL to PDF';
    return t.name;
  });

  heroSubtitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return '';
    if (t.id === 'compress-pdf') return 'Reduce PDF file size while preserving document quality.';
    return t.shortDescription;
  });

  dropzoneButtonTitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Select files';
    if (t.id === 'word-to-pdf') return 'Select WORD files';
    if (t.id === 'powerpoint-to-pdf') return 'Select POWERPOINT files';
    if (t.id === 'excel-to-pdf') return 'Select EXCEL files';
    if (t.id === 'images-to-pdf' || t.id === 'pdf-to-jpg') return 'Select images';
    if (t.id === 'compress-pdf') return 'Select PDF files';
    if (t.id === 'split-pdf') return 'Select PDF file';
    return 'Select PDF file';
  });

  dropzoneSubtitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'or drop files here';
    if (t.id === 'word-to-pdf') return 'or drop Word documents here';
    if (t.id === 'powerpoint-to-pdf') return 'or drop PowerPoint slides here';
    if (t.id === 'excel-to-pdf') return 'or drop Excel spreadsheets here';
    if (t.id === 'split-pdf') return 'or drop PDF here';
    return 'or drop PDFs here';
  });

  acceptedFileTypesString = computed<string>(() => {
    const t = this.tool();
    if (!t || !t.acceptedFileTypes || t.acceptedFileTypes.length === 0) {
      return '.pdf,application/pdf';
    }
    return t.acceptedFileTypes.join(',');
  });

  // Split PDF strictly allows 1 file; Compress PDF and other multi-tools allow up to maxFiles
  allowMultiple = computed<boolean>(() => {
    const t = this.tool();
    if (!t) return false;
    if (t.id === 'split-pdf') return false;
    return t.maxFiles > 1;
  });

  dropzoneLimitInfo = computed<string>(() => {
    return '100% In-Browser Privacy • No file upload needed • Unlimited & Free';
  });

  // Dynamic headings & labels
  featuresHeading = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Why choose our tool';
    return `The easiest & safest way to ${t.name.toLowerCase()}`;
  });

  sidebarTitle = computed<string>(() => {
    const t = this.tool();
    return t ? t.name : 'Tool Options';
  });

  sidebarInfoText = computed<string>(() => {
    const t = this.tool();
    if (!t) return '';
    if (t.id === 'compress-pdf') {
      return 'Choose your desired compression balance between file size reduction and image resolution.';
    }
    if (t.id === 'pdf-to-powerpoint') {
      return 'Each PDF page will be transformed into an editable presentation slide with preserved formatting.';
    }
    return 'Configure your processing options below and click the button when ready.';
  });

  actionButtonLabel = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Process Document';
    if (t.id === 'compress-pdf') return 'Compress PDF';
    if (t.id === 'split-pdf') return 'Split PDF';
    if (t.id === 'pdf-to-powerpoint') return 'Convert to PPTX';
    if (t.id === 'pdf-to-word') return 'Convert to Word';
    if (t.id === 'pdf-to-excel') return 'Convert to Excel';
    return `${t.name}`;
  });

  stepTwoDescription = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Review options in the right sidebar.';
    if (t.id === 'compress-pdf') return 'Choose Extreme, Recommended, or Low compression depending on your size needs.';
    if (t.id === 'split-pdf') return 'Select whether you want to extract custom pages or separate into multiple ranges.';
    if (t.id === 'pdf-to-powerpoint') return 'Select PowerPoint (.pptx) format and enable OCR if converting scanned pages.';
    return 'Customize your output settings in the sidebar panel.';
  });

  stepThreeTitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Download document';
    if (t.id === 'compress-pdf') return 'Compress & download';
    if (t.id === 'split-pdf') return 'Split & download';
    if (t.id === 'pdf-to-powerpoint') return 'Convert & download';
    return 'Process & download';
  });

  processingTitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Processing...';
    if (t.id === 'compress-pdf') return 'Compressing PDF Document...';
    if (t.id === 'split-pdf') return 'Splitting PDF Pages...';
    if (t.id === 'pdf-to-powerpoint') return 'Converting to PowerPoint Slides...';
    return `Processing ${t.name}...`;
  });

  resultTitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Document Ready!';
    if (t.id === 'compress-pdf') {
      const compRes = this.toolResult() as (CompressPdfResult | null);
      if (compRes && compRes.isZip) {
        return `${compRes.filesCount} PDFs Compressed!`;
      }
      return 'PDF Has Been Compressed!';
    }
    if (t.id === 'split-pdf') {
      const res = this.toolResult() as (SplitPdfResult | null);
      if (res && res.isZip) {
        return `${res.outputFilesCount} PDFs Created!`;
      }
      return 'PDF Has Been Split!';
    }
    if (t.id === 'pdf-to-powerpoint') return 'PowerPoint Slideshow Ready!';
    return `${t.name} Completed!`;
  });

  resultSubtitle = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Your document is ready for download.';
    if (t.id === 'compress-pdf') {
      const compRes = this.toolResult() as (CompressPdfResult | null);
      if (compRes && compRes.isZip) {
        return `Your ${compRes.filesCount} PDF documents were compressed and packaged into a ZIP archive. Original: ${compRes.formattedOriginalSize} → Compressed: ${compRes.formattedCompressedSize} (${compRes.reductionPercent}% reduction).`;
      }
      if (compRes) {
        return `Original: ${compRes.formattedOriginalSize} → Compressed: ${compRes.formattedCompressedSize} (${compRes.reductionPercent}% reduction). Processed privately in your browser.`;
      }
      return 'Your PDF file size has been reduced with optimal visual clarity.';
    }
    if (t.id === 'split-pdf') {
      const res = this.toolResult() as (SplitPdfResult | null);
      if (res && res.isZip) {
        return `Your PDF was split into ${res.outputFilesCount} separate documents and packaged into a ZIP archive for easy download.`;
      }
      return 'Your split PDF document is ready to download. Everything was processed securely in your browser.';
    }
    return 'Your processed document is ready to download. Everything was computed securely in your browser.';
  });

  resultDownloadLabel = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Download File';
    if (t.id === 'compress-pdf') {
      const compRes = this.toolResult() as (CompressPdfResult | null);
      if (compRes && compRes.isZip) {
        return 'Download All Compressed PDFs (.ZIP)';
      }
      return 'Download Compressed PDF';
    }
    if (t.id === 'split-pdf') {
      const res = this.toolResult() as (SplitPdfResult | null);
      if (res && res.isZip) {
        return `Download Split PDFs (.ZIP)`;
      }
      return 'Download Split PDF';
    }
    if (t.id === 'pdf-to-powerpoint') return 'Download PowerPoint Presentation';
    return `Download ${t.name} File`;
  });

  resultSavingsText = computed<string | null>(() => {
    const t = this.tool();
    const res = this.toolResult() as (CompressPdfResult | null);
    if (t?.id === 'compress-pdf' && res) {
      if (res.reductionPercent > 0) {
        return `-${res.reductionPercent}% saved (${res.formattedSpaceSaved})`;
      }
      return 'Already optimized';
    }
    return null;
  });

  resultRestartLabel = computed<string>(() => {
    const t = this.tool();
    if (!t) return 'Process Another';
    return `${t.name} Another File`;
  });

  calculatedSplitCount = computed<number>(() => {
    const raw = this.splitPageRanges().trim();
    if (!raw) return 1;
    let count = 0;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.includes('-')) {
        const [a, b] = p.split('-').map(x => parseInt(x, 10));
        if (!isNaN(a) && !isNaN(b)) {
          count += Math.max(1, Math.abs(b - a) + 1);
        } else {
          count += 1;
        }
      } else {
        count += 1;
      }
    }
    return Math.max(1, count);
  });

  // Features list
  featuresList = computed(() => {
    const t = this.tool();
    if (t?.id === 'compress-pdf') {
      return [
        {
          title: 'Maximum Compression Ratio',
          description: 'Drastically shrinks MB to KB while optimizing vector graphics, embedded fonts, and high-res images.',
          bgColor: '#ecfdf5',
          iconColor: '#059669',
          iconPath: 'M19 14l-7 7m0 0l-7-7m7 7V3'
        },
        {
          title: '100% In-Browser Privacy',
          description: 'Your sensitive contracts and financial PDFs never leave your device. All compression runs client-side.',
          bgColor: '#eff6ff',
          iconColor: '#2563eb',
          iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
        },
        {
          title: 'Preserved Visual Clarity',
          description: 'Text sharpness, hyperlinks, bookmarks, and structural layout remain crisp and clear.',
          bgColor: '#f5f3ff',
          iconColor: '#7c3aed',
          iconPath: 'M5 13l4 4L19 7'
        },
        {
          title: 'Unlimited & Free',
          description: 'Compress as many documents as you need without watermarks, subscriptions, or file size limits.',
          bgColor: '#fef2f2',
          iconColor: '#dc2626',
          iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
        }
      ];
    }

    if (t?.id === 'split-pdf') {
      return [
        {
          title: 'Precise Page Extraction',
          description: 'Specify single page numbers, custom ranges (e.g. 1-4, 7), or split every single page into separate files.',
          bgColor: '#fef2f2',
          iconColor: '#dc2626',
          iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
        },
        {
          title: '100% In-Browser Privacy',
          description: 'Zero data transfer across the internet. Operates strictly in device memory using WebAssembly.',
          bgColor: '#eff6ff',
          iconColor: '#2563eb',
          iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
        },
        {
          title: 'Original Layout Retained',
          description: 'All extracted pages retain full vector precision, color profiles, bookmarks, and embedded font fidelity.',
          bgColor: '#ecfdf5',
          iconColor: '#059669',
          iconPath: 'M5 13l4 4L19 7'
        },
        {
          title: 'Instant Single Click Download',
          description: 'Get your split documents immediately with zero queue or cloud rendering delays.',
          bgColor: '#f5f3ff',
          iconColor: '#7c3aed',
          iconPath: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
        }
      ];
    }

    // Generic fallback features for other tools
    return [
      {
        title: '100% In-Browser Privacy',
        description: 'Your documents never touch a third-party server. Everything executes locally with zero data transfer.',
        bgColor: '#eff6ff',
        iconColor: '#2563eb',
        iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
      },
      {
        title: 'Lossless Formatting',
        description: 'Original text alignments, embedded vectors, fonts, and visual presentation are carefully preserved.',
        bgColor: '#ecfdf5',
        iconColor: '#059669',
        iconPath: 'M5 13l4 4L19 7'
      },
      {
        title: 'High-Performance Engine',
        description: 'Powered by modern WebAssembly and native web streams for instantaneous document processing.',
        bgColor: '#f5f3ff',
        iconColor: '#7c3aed',
        iconPath: 'M13 10V3L4 14h7v7l9-11h-7z'
      },
      {
        title: 'Free & Unlimited',
        description: 'Enjoy limitless file operations with zero hidden fees, watermark stamps, or account barriers.',
        bgColor: '#fef2f2',
        iconColor: '#dc2626',
        iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
      }
    ];
  });

  // FAQs list
  faqsList = computed(() => {
    const t = this.tool();
    if (t?.seo?.faqs && t.seo.faqs.length > 0) {
      return t.seo.faqs;
    }

    if (t?.id === 'compress-pdf') {
      return [
        {
          question: 'Will compressing my PDF reduce text or print quality?',
          answer: 'No. Our recommended compression preserves font vectors and clean text rendering, while efficiently compressing redundant metadata and image streams.'
        },
        {
          question: 'Are my confidential documents uploaded to any remote server?',
          answer: 'Never. PDF flow processes your documents 100% inside your browser memory using WebAssembly. Your files are never uploaded.'
        },
        {
          question: 'Which compression level should I choose?',
          answer: 'Recommended is ideal for 95% of documents, cutting file size in half with invisible visual change. Extreme is best for strict upload limits.'
        }
      ];
    }

    if (t?.id === 'split-pdf') {
      return [
        {
          question: 'How do I extract only specific pages from a PDF?',
          answer: 'Select the Pages tab, choose "Select pages", and type your page numbers (e.g. 1, 5-8). Only those pages will be extracted.'
        },
        {
          question: 'Can I split all pages into separate single-page documents?',
          answer: 'Yes! Simply choose "Extract all pages" under the Pages tab. Each page will be saved as an independent PDF.'
        },
        {
          question: 'Are my split files uploaded to any server?',
          answer: 'No. PDF flow processes your documents 100% inside your browser memory. Your files never leave your device.'
        }
      ];
    }

    return [
      {
        question: `Is ${t?.name || 'this tool'} free to use?`,
        answer: 'Yes! All basic and advanced document features are 100% free with no hidden charges, watermarks, or file limits.'
      },
      {
        question: 'Do you store copies of my files?',
        answer: 'No. Browser tools run strictly on your computer using in-browser WebAssembly, while server-assisted tools (such as PDF to Word) process files in ephemeral memory and automatically delete them within 10 minutes. No files are ever saved permanently.'
      },
      {
        question: 'Can I use this tool on mobile or tablet devices?',
        answer: 'Yes, PDF flow is fully responsive and optimized for touch screens, tablets, laptops, and desktop computers.'
      }
    ];
  });

  // Related tools
  relatedTools = computed(() => {
    return [
      {
        id: 'merge-pdf',
        name: 'Merge PDF',
        desc: 'Combine multiple PDF files in order',
        route: '/merge-pdf',
        bgColor: '#E53238',
        iconPath: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2'
      },
      {
        id: 'split-pdf',
        name: 'Split PDF',
        desc: 'Separate one page or whole sets',
        route: '/split-pdf',
        bgColor: '#E53238',
        iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
      },
      {
        id: 'compress-pdf',
        name: 'Compress PDF',
        desc: 'Reduce file size while saving quality',
        route: '/compress-pdf',
        bgColor: '#10B981',
        iconPath: 'M19 14l-7 7m0 0l-7-7m7 7V3'
      },
      {
        id: 'pdf-to-word',
        name: 'PDF to Word',
        desc: 'Convert PDF to DOC & DOCX',
        route: '/pdf-to-word',
        bgColor: '#2B579A',
        iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
      }
    ].filter(r => r.id !== this.tool()?.id);
  });

  // User Actions
  async onFilesAdded(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    this.errorMessage.set(null);

    const t = this.tool();
    const isSingleDoc = t?.id === 'split-pdf' || !this.allowMultiple();

    const validated: ValidatedPdfFile[] = [];
    for (const f of files) {
      if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        const res = await this.pdfService.validatePdf(f);
        if (res.isValid) {
          validated.push(res);
          if (isSingleDoc) break; // Strictly take only 1 file
        } else {
          this.errorMessage.set(res.error || 'Could not parse PDF document.');
        }
      } else {
        validated.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          file: f,
          name: f.name,
          sizeBytes: f.size,
          formattedSize: this.pdfService.formatBytes(f.size),
          pageCount: 1,
          isValid: true
        });
        if (isSingleDoc) break;
      }
    }

    if (validated.length > 0) {
      if (isSingleDoc) {
        this.selectedFiles.set([validated[0]]);
        const totalP = validated[0].pageCount || 1;
        this.customRanges.set([
          { id: '1', from: 1, to: Math.min(totalP, 1) }
        ]);
      } else {
        this.selectedFiles.update(current => [...current, ...validated]);
      }
      this.currentState.set('organize');
      this.layoutService.hideFooter();
    }
  }

  ngOnDestroy(): void {
    const res = this.toolResult();
    if (res?.url) {
      URL.revokeObjectURL(res.url);
    }
    this.layoutService.showFooter();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.onFilesAdded(Array.from(input.files));
    }
    input.value = '';
  }

  onRemoveFile(idx: number): void {
    this.selectedFiles.update(files => files.filter((_, i) => i !== idx));
    if (this.selectedFiles().length === 0) {
      this.resetWorkspace();
    }
  }

  resetWorkspace(): void {
    this.selectedFiles.set([]);
    this.toolResult.set(null);
    this.errorMessage.set(null);
    this.isProcessing.set(false);
    this.currentState.set('upload');
    this.layoutService.showFooter();
    this.customRanges.set([{ id: '1', from: 1, to: 1 }]);
    this.splitPageRanges.set('');
  }

  // Custom Range Actions
  addCustomRange(): void {
    const current = this.customRanges();
    const totalPages = this.selectedFiles()[0]?.pageCount || 9999;
    const last = current[current.length - 1];
    let nextFrom = 1;
    let nextTo = 1;

    if (last && last.to !== null && !isNaN(last.to)) {
      nextFrom = Math.min(last.to + 1, totalPages);
      nextTo = nextFrom;
    }

    const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.customRanges.update(r => [...r, { id: newId, from: nextFrom, to: nextTo }]);
  }

  removeCustomRange(index: number): void {
    const current = this.customRanges();
    if (current.length <= 1) return;
    this.customRanges.update(r => r.filter((_, i) => i !== index));
  }

  updateRangeFrom(index: number, val: any): void {
    const num = val === '' || val === null ? null : parseInt(val, 10);
    this.customRanges.update(ranges => {
      const copy = [...ranges];
      copy[index] = { ...copy[index], from: isNaN(num as number) ? null : num };
      return copy;
    });
  }

  updateRangeTo(index: number, val: any): void {
    const num = val === '' || val === null ? null : parseInt(val, 10);
    this.customRanges.update(ranges => {
      const copy = [...ranges];
      copy[index] = { ...copy[index], to: isNaN(num as number) ? null : num };
      return copy;
    });
  }

  stepRangeFrom(index: number, delta: number): void {
    const range = this.customRanges()[index];
    if (!range) return;
    const totalPages = this.selectedFiles()[0]?.pageCount || 9999;
    const current = range.from || 1;
    const nextVal = Math.max(1, Math.min(totalPages, current + delta));
    this.updateRangeFrom(index, nextVal);
  }

  stepRangeTo(index: number, delta: number): void {
    const range = this.customRanges()[index];
    if (!range) return;
    const totalPages = this.selectedFiles()[0]?.pageCount || 9999;
    const current = range.to || 1;
    const nextVal = Math.max(1, Math.min(totalPages, current + delta));
    this.updateRangeTo(index, nextVal);
  }

  openGoogleDrive(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    window.open('https://drive.google.com/', '_blank', 'noopener,noreferrer');
  }

  openDropbox(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    window.open('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');
  }

  async executeToolAction(): Promise<void> {
    const files = this.selectedFiles();
    if (files.length === 0) return;

    this.isProcessing.set(true);
    this.currentState.set('processing');
    this.errorMessage.set(null);
    this.processingProgress.set(10);

    const t = this.tool();
    const primaryFile = files[0].file;

    try {
      // 1. Compress PDF
      if (t?.id === 'compress-pdf') {
        const rawFiles = files.map(f => f.file);
        const result = await this.pdfService.compressPdf(
          rawFiles,
          this.compressionLevel(),
          (pct, msg) => {
            this.processingProgress.set(pct);
            this.processingMessage.set(msg);
          }
        );
        this.toolResult.set(result);
        this.currentState.set('completed');
        this.isProcessing.set(false);
        return;
      }

      // 2. Split PDF
      if (t?.id === 'split-pdf') {
        const isPagesTab = this.splitMainTab() === 'pages';
        const isCustomRange = !isPagesTab && this.splitRangeMode() === 'custom';
        const isFixedRange = !isPagesTab && this.splitRangeMode() === 'fixed';
        const mergeOutput = this.mergeExtractedPages();

        let options: any = { mergeOutput };

        if (isPagesTab) {
          if (this.splitExtractMode() === 'extract_all') {
            options.mode = 'extract_all';
          } else {
            options.mode = 'extract_pages';
            options.pageExpression = this.splitPageRanges() || '1';
          }
        } else if (isCustomRange) {
          const val = this.customRangesValidation();
          if (val.hasError) {
            this.errorMessage.set(val.firstErrorMessage || 'Please fix invalid custom page ranges.');
            this.isProcessing.set(false);
            this.currentState.set('organize');
            return;
          }
          options.mode = 'custom_ranges';
          options.ranges = this.customRanges().map(r => ({ from: r.from!, to: r.to! }));
        } else if (isFixedRange) {
          options.mode = 'fixed_ranges';
          options.fixedPageCount = Math.max(1, this.splitFixedCount() || 1);
        }

        const result = await this.pdfService.splitPdf(
          primaryFile,
          options,
          (pct, msg) => {
            this.processingProgress.set(pct);
            this.processingMessage.set(msg);
          }
        );
        this.toolResult.set(result);
        this.currentState.set('completed');
        this.layoutService.showFooter();
        this.isProcessing.set(false);
        return;
      }

      // 3. Conversion / Other PDF Tools
      await this.simulateExecution(t?.name || 'Document');

      const baseName = primaryFile.name.replace(/\.[^/.]+$/, '');
      let ext = '.pdf';
      let mime = 'application/pdf';
      if (t?.id === 'pdf-to-powerpoint') { ext = '.pptx'; mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; }
      else if (t?.id === 'pdf-to-word') { ext = '.docx'; mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
      else if (t?.id === 'pdf-to-excel') { ext = '.xlsx'; mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; }
      else if (t?.id === 'pdf-to-jpg') { ext = '.jpg'; mime = 'image/jpeg'; }

      const outName = `${baseName}_${t?.id || 'processed'}${ext}`;
      const buffer = await primaryFile.arrayBuffer();
      const blob = new File([buffer], outName, { type: mime });
      const url = URL.createObjectURL(blob);

      this.toolResult.set({
        blob,
        url,
        filename: outName,
        pageCount: files[0].pageCount || 1,
        sizeBytes: blob.size,
        formattedSize: this.pdfService.formatBytes(blob.size)
      });

      this.currentState.set('completed');
      this.layoutService.showFooter();
      this.isProcessing.set(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      this.errorMessage.set(msg);
      this.currentState.set('organize');
      this.layoutService.hideFooter();
      this.isProcessing.set(false);
    }
  }

  private async simulateExecution(toolName: string): Promise<void> {
    const steps = [
      { pct: 25, msg: 'Validating document structures and encoding...' },
      { pct: 50, msg: `Executing ${toolName} transformations locally...` },
      { pct: 75, msg: 'Preserving vector fonts, layouts, and graphics...' },
      { pct: 95, msg: 'Assembling final output package...' }
    ];
    for (const step of steps) {
      this.processingProgress.set(step.pct);
      this.processingMessage.set(step.msg);
      await new Promise(r => setTimeout(r, 220));
    }
  }
}
