export type ProcessingMode = 'browser' | 'server' | 'hybrid';
export type ToolCategory = 'organize' | 'convert' | 'optimize' | 'edit' | 'security' | 'intelligence' | 'workflows';
export type ToolStatus = 'available' | 'beta' | 'planned';

export interface ToolSeo {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  faqs: Array<{ question: string; answer: string }>;
}

export interface ToolDefinition {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: ToolCategory;
  route: string;
  icon: string;
  processingMode: ProcessingMode;
  acceptedFileTypes: string[];
  maxFiles: number;
  maxFileSizeBytes: number;
  status: ToolStatus;
  badgeText?: string;
  isNew?: boolean;
  seo: ToolSeo;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  // ROW 1: 6 TOOLS
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    shortDescription: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    longDescription: 'Merge and combine multiple PDF documents into one cleanly formatted PDF. Reorder pages and files visually before processing. Operates 100% locally in your browser for absolute privacy.',
    category: 'organize',
    route: '/merge-pdf',
    icon: 'layers',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 30,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: '100% In-Browser',
    seo: {
      title: 'Merge PDF Online Free - Combine PDF Files Privately | PDF flow',
      description: 'Merge multiple PDF files into one document free online. Fast, secure, and 100% private in-browser processing with zero file uploads required.',
      keywords: ['merge pdf', 'combine pdf', 'join pdf files', 'free online pdf merger', 'secure pdf merge'],
      canonical: 'https://pdfflow.app/merge-pdf',
      faqs: [
        {
          question: 'Are my PDF files uploaded to any server when I merge them?',
          answer: 'No. PDF flow merges your files directly inside your browser memory using WebAssembly and client-side processing. Your documents never leave your device.'
        }
      ]
    }
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    shortDescription: 'Separate one page or a whole set for easy conversion into independent PDF files.',
    longDescription: 'Extract specific page ranges or split every page into separate PDF documents. Fast, secure, and processed completely on your device.',
    category: 'organize',
    route: '/split-pdf',
    icon: 'scissors',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: 'Client-side',
    seo: {
      title: 'Split PDF Online Free - Separate PDF Pages | PDF flow',
      description: 'Split PDF pages into individual documents or extract custom page ranges quickly and securely in your browser.',
      keywords: ['split pdf', 'separate pdf pages', 'extract pdf pages', 'free pdf splitter'],
      canonical: 'https://pdfflow.app/split-pdf',
      faqs: []
    }
  },
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    shortDescription: 'Reduce file size while optimizing for maximal PDF quality.',
    longDescription: 'Shrink oversized PDF documents for email attachments and web upload limits using intelligent stream optimization.',
    category: 'optimize',
    route: '/compress-pdf',
    icon: 'minimize-2',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 100 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Compress PDF Online - Reduce File Size | PDF flow',
      description: 'Compress PDF files online without losing readability. Free optimization tool.',
      keywords: ['compress pdf', 'reduce pdf size', 'shrink pdf', 'pdf compressor'],
      canonical: 'https://pdfflow.app/compress-pdf',
      faqs: []
    }
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    shortDescription: 'Easily convert your PDF files into easy to edit DOC and DOCX documents.',
    longDescription: 'Transform PDF documents into editable Microsoft Word files with preserved typography, formatting, and layout structure.',
    category: 'convert',
    route: '/merge-pdf',
    icon: 'doc-word',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 5,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Fast',
    seo: {
      title: 'PDF to Word Converter Online | PDF flow',
      description: 'Convert PDF files to editable Word documents online with accuracy.',
      keywords: ['pdf to word', 'convert pdf to docx', 'pdf converter'],
      canonical: 'https://pdfflow.app/pdf-to-word',
      faqs: []
    }
  },
  {
    id: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    shortDescription: 'Turn your PDF files into easy to edit PPT and PPTX slide decks.',
    longDescription: 'Convert slide-based PDF documents into fully editable Microsoft PowerPoint presentations.',
    category: 'convert',
    route: '/pdf-to-powerpoint',
    icon: 'doc-ppt',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 5,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'PDF to PowerPoint Converter | PDF flow',
      description: 'Convert PDF presentations to editable PPTX slides.',
      keywords: ['pdf to powerpoint', 'pdf to pptx', 'convert pdf slides'],
      canonical: 'https://pdfflow.app/pdf-to-powerpoint',
      faqs: []
    }
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    shortDescription: 'Pull data straight from PDFs into Excel spreadsheets in a few short seconds.',
    longDescription: 'Extract tabular data from PDF invoices, financial statements, and reports directly into XLSX spreadsheets.',
    category: 'convert',
    route: '/pdf-to-excel',
    icon: 'doc-excel',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 5,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'PDF to Excel Converter | PDF flow',
      description: 'Extract tables from PDF to editable Excel spreadsheets.',
      keywords: ['pdf to excel', 'pdf to xlsx', 'extract tables from pdf'],
      canonical: 'https://pdfflow.app/pdf-to-excel',
      faqs: []
    }
  },

  // ROW 2: 6 TOOLS
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    shortDescription: 'Make DOC and DOCX files easy to read by converting them to PDF.',
    longDescription: 'Convert Microsoft Word files into standardized, read-only PDF documents that display identically on every screen.',
    category: 'convert',
    route: '/word-to-pdf',
    icon: 'word-to-pdf',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.doc', '.docx'],
    maxFiles: 10,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Word to PDF Converter Online | PDF flow',
      description: 'Convert DOC and DOCX documents to standardized PDF files.',
      keywords: ['word to pdf', 'doc to pdf', 'docx to pdf'],
      canonical: 'https://pdfflow.app/word-to-pdf',
      faqs: []
    }
  },
  {
    id: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    shortDescription: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
    longDescription: 'Preserve slide animations and presentation layouts as a fixed-format PDF document.',
    category: 'convert',
    route: '/powerpoint-to-pdf',
    icon: 'ppt-to-pdf',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.ppt', '.pptx'],
    maxFiles: 10,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'PowerPoint to PDF Converter | PDF flow',
      description: 'Convert PPT and PPTX presentations to PDF format.',
      keywords: ['powerpoint to pdf', 'ppt to pdf', 'pptx to pdf'],
      canonical: 'https://pdfflow.app/powerpoint-to-pdf',
      faqs: []
    }
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    shortDescription: 'Make EXCEL spreadsheets easy to read by converting them to PDF.',
    longDescription: 'Convert XLS and XLSX workbooks into clean, printable PDF documents with custom page orientation.',
    category: 'convert',
    route: '/excel-to-pdf',
    icon: 'excel-to-pdf',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.xls', '.xlsx'],
    maxFiles: 10,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Excel to PDF Converter | PDF flow',
      description: 'Convert Excel spreadsheets to PDF documents.',
      keywords: ['excel to pdf', 'xls to pdf', 'xlsx to pdf'],
      canonical: 'https://pdfflow.app/excel-to-pdf',
      faqs: []
    }
  },
  {
    id: 'edit-pdf',
    name: 'Edit PDF',
    shortDescription: 'Add text, images, shapes or freehand annotations to a PDF document.',
    longDescription: 'Directly annotate, redact, and highlight text inside your PDF files right in your web browser.',
    category: 'edit',
    route: '/edit-pdf',
    icon: 'edit-pen',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Edit PDF Online Free | PDF flow',
      description: 'Edit PDF documents online. Add text, shapes, comments, and highlights.',
      keywords: ['edit pdf', 'annotate pdf', 'online pdf editor'],
      canonical: 'https://pdfflow.app/edit-pdf',
      faqs: []
    }
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    shortDescription: 'Convert each PDF page into a JPG or extract all images contained in a PDF.',
    longDescription: 'Extract high-resolution image assets or convert every page of a document into JPG format.',
    category: 'convert',
    route: '/pdf-to-jpg',
    icon: 'pdf-to-jpg',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'PDF to JPG Converter Online | PDF flow',
      description: 'Convert PDF pages to high-quality JPG images.',
      keywords: ['pdf to jpg', 'pdf to image', 'extract images from pdf'],
      canonical: 'https://pdfflow.app/pdf-to-jpg',
      faqs: []
    }
  },
  {
    id: 'images-to-pdf',
    name: 'JPG to PDF',
    shortDescription: 'Convert JPG images to PDF in seconds. Easily adjust orientation and margins.',
    longDescription: 'Turn photos and image scans into a standardized PDF with customized orientation, margins, and page ordering.',
    category: 'convert',
    route: '/images-to-pdf',
    icon: 'image',
    processingMode: 'browser',
    acceptedFileTypes: ['.jpg', '.jpeg', '.png', '.webp', 'image/jpeg', 'image/png', 'image/webp'],
    maxFiles: 50,
    maxFileSizeBytes: 20 * 1024 * 1024,
    status: 'available',
    badgeText: 'Client-side',
    seo: {
      title: 'JPG & Images to PDF Converter Free Online | PDF flow',
      description: 'Convert JPG, PNG, and image scans to clean PDF files directly in your web browser. Free, unlimited, private.',
      keywords: ['jpg to pdf', 'images to pdf', 'png to pdf', 'photos to pdf converter'],
      canonical: 'https://pdfflow.app/images-to-pdf',
      faqs: []
    }
  },

  // ROW 3: 6 TOOLS
  {
    id: 'sign-pdf',
    name: 'Sign PDF',
    shortDescription: 'Sign yourself or request electronic signatures from others securely.',
    longDescription: 'Add legally binding cryptographic electronic signatures and initials to your PDF documents.',
    category: 'edit',
    route: '/sign-pdf',
    icon: 'sign-pen',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Sign PDF Online - Free E-Signatures | PDF flow',
      description: 'Sign PDF documents electronically online with certificate security.',
      keywords: ['sign pdf', 'esign pdf', 'electronic signature online'],
      canonical: 'https://pdfflow.app/sign-pdf',
      faqs: []
    }
  },
  {
    id: 'watermark-pdf',
    name: 'Watermark PDF',
    shortDescription: 'Stamp an image or text over your PDF in seconds. Choose typography and position.',
    longDescription: 'Protect intellectual property and confidentiality by stamping custom text or logo watermarks.',
    category: 'edit',
    route: '/watermark-pdf',
    icon: 'watermark-stamp',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Watermark PDF Online | PDF flow',
      description: 'Add text or image watermarks to your PDF documents.',
      keywords: ['watermark pdf', 'add watermark to pdf', 'stamp pdf'],
      canonical: 'https://pdfflow.app/watermark-pdf',
      faqs: []
    }
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    shortDescription: 'Rotate your PDF pages 90, 180, or 270 degrees clockwise or counterclockwise.',
    longDescription: 'Fix orientation for scanned documents and horizontal pages. Rotate individual pages or the entire document permanently.',
    category: 'organize',
    route: '/rotate-pdf',
    icon: 'rotate-cw',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: 'Instant',
    seo: {
      title: 'Rotate PDF Online Free - Permanently Rotate Pages | PDF flow',
      description: 'Rotate PDF pages permanently in your browser. Fast 90-degree clockwise or counter-clockwise rotation with zero data uploads.',
      keywords: ['rotate pdf', 'rotate pdf pages', 'fix pdf orientation', 'turn pdf'],
      canonical: 'https://pdfflow.app/rotate-pdf',
      faqs: []
    }
  },
  {
    id: 'html-to-pdf',
    name: 'HTML to PDF',
    shortDescription: 'Convert web pages in HTML to PDF with full CSS formatting preservation.',
    longDescription: 'Convert public webpages or raw HTML files into high-fidelity printable PDF documents.',
    category: 'convert',
    route: '/html-to-pdf',
    icon: 'html-tag',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.html', '.htm', 'text/html'],
    maxFiles: 1,
    maxFileSizeBytes: 20 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'HTML to PDF Converter | PDF flow',
      description: 'Convert HTML code and web pages to PDF format.',
      keywords: ['html to pdf', 'convert webpage to pdf', 'url to pdf'],
      canonical: 'https://pdfflow.app/html-to-pdf',
      faqs: []
    }
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    shortDescription: 'Remove PDF password security, giving you the freedom to use your PDFs.',
    longDescription: 'Decouple passwords and restrictive permission locks from your authorized PDF documents.',
    category: 'security',
    route: '/unlock-pdf',
    icon: 'unlock-padlock',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Unlock PDF Online - Remove Password | PDF flow',
      description: 'Remove password restrictions from PDF documents online.',
      keywords: ['unlock pdf', 'remove pdf password', 'decrypt pdf'],
      canonical: 'https://pdfflow.app/unlock-pdf',
      faqs: []
    }
  },
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    shortDescription: 'Encrypt your PDF with standard AES password protection to prevent unauthorized viewing.',
    longDescription: 'Secure confidential contracts and sensitive documents with robust password encryption.',
    category: 'security',
    route: '/protect-pdf',
    icon: 'lock',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Protect PDF with Password Online | PDF flow',
      description: 'Encrypt your PDF document with a secure password to restrict access.',
      keywords: ['protect pdf', 'encrypt pdf', 'password protect pdf', 'lock pdf'],
      canonical: 'https://pdfflow.app/protect-pdf',
      faqs: []
    }
  },
  {
    id: 'organize-pdf',
    name: 'Organize PDF',
    shortDescription: 'Sort pages of your PDF file however you like. Delete PDF pages or add PDF pages to your document at will.',
    longDescription: 'Rearrange, rotate, delete, or duplicate pages in any order.',
    category: 'organize',
    route: '/merge-pdf',
    icon: 'grid',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: 'Instant',
    seo: {
      title: 'Organize PDF Pages Online | PDF flow',
      description: 'Sort, delete, and rotate PDF pages in your browser.',
      keywords: ['organize pdf', 'sort pdf pages', 'reorder pdf'],
      canonical: 'https://pdfflow.app/organize-pdf',
      faqs: []
    }
  },
  {
    id: 'pdf-to-pdfa',
    name: 'PDF to PDF/A',
    shortDescription: 'Transform your PDF to PDF/A, the ISO-standardized version of PDF for long-term archiving.',
    longDescription: 'Convert documents to PDF/A-1b, PDF/A-2b, or PDF/A-3b for guaranteed future readability.',
    category: 'convert',
    route: '/pdf-to-word',
    icon: 'archive',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 5,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'ISO Compliant',
    seo: {
      title: 'PDF to PDF/A Converter Online | PDF flow',
      description: 'Convert PDF files to ISO-standard PDF/A format.',
      keywords: ['pdf to pdfa', 'archive pdf', 'iso pdf'],
      canonical: 'https://pdfflow.app/pdf-to-pdfa',
      faqs: []
    }
  },
  {
    id: 'repair-pdf',
    name: 'Repair PDF',
    shortDescription: 'Repair a damaged PDF and recover data from corrupt PDF. Fix PDF files with our Repair tool.',
    longDescription: 'Analyze corrupted cross-reference tables and recover readable text and assets.',
    category: 'optimize',
    route: '/compress-pdf',
    icon: 'tool',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 2,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Repair PDF Online - Fix Corrupt PDF | PDF flow',
      description: 'Fix corrupt and unreadable PDF files.',
      keywords: ['repair pdf', 'fix corrupt pdf', 'recover pdf'],
      canonical: 'https://pdfflow.app/repair-pdf',
      faqs: []
    }
  },
  {
    id: 'page-numbers',
    name: 'Page numbers',
    shortDescription: 'Add page numbers into PDFs with ease. Choose your positions, dimensions, typography.',
    longDescription: 'Custom header and footer pagination with dynamic total page count tags.',
    category: 'edit',
    route: '/edit-pdf',
    icon: 'hash',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Add Page Numbers to PDF | PDF flow',
      description: 'Number PDF pages easily with customized styles.',
      keywords: ['page numbers pdf', 'number pdf', 'paginate pdf'],
      canonical: 'https://pdfflow.app/page-numbers',
      faqs: []
    }
  },
  {
    id: 'scan-to-pdf',
    name: 'Scan to PDF',
    shortDescription: 'Capture document scans from your mobile device or webcam and save them instantly to PDF.',
    longDescription: 'Direct image capture with perspective correction and automatic contrast enhancement.',
    category: 'organize',
    route: '/images-to-pdf',
    icon: 'camera',
    processingMode: 'browser',
    acceptedFileTypes: ['image/*'],
    maxFiles: 10,
    maxFileSizeBytes: 20 * 1024 * 1024,
    status: 'available',
    badgeText: 'Instant',
    seo: {
      title: 'Scan to PDF Online | PDF flow',
      description: 'Scan documents with camera or scanner to PDF.',
      keywords: ['scan to pdf', 'mobile scanner', 'document camera'],
      canonical: 'https://pdfflow.app/scan-to-pdf',
      faqs: []
    }
  },
  {
    id: 'ocr-pdf',
    name: 'OCR PDF',
    shortDescription: 'Easily convert scanned PDF into searchable and selectable text documents with high accuracy.',
    longDescription: 'Multi-language optical character recognition for digitizing paper archives.',
    category: 'optimize',
    route: '/pdf-to-word',
    icon: 'file-text',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 3,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'AI Powered',
    seo: {
      title: 'OCR PDF Online - Searchable Text | PDF flow',
      description: 'Extract text from scanned PDF documents using OCR.',
      keywords: ['ocr pdf', 'searchable pdf', 'extract text pdf'],
      canonical: 'https://pdfflow.app/ocr-pdf',
      faqs: []
    }
  },
  {
    id: 'compare-pdf',
    name: 'Compare PDF',
    shortDescription: 'Show side-by-side differences between two PDF files to easily spot revisions and content changes.',
    longDescription: 'Visual difference highlighting and textual revision comparison.',
    category: 'security',
    route: '/merge-pdf',
    icon: 'columns',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 2,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Compare PDF Documents Online | PDF flow',
      description: 'Spot revisions and differences between PDF files.',
      keywords: ['compare pdf', 'pdf diff', 'pdf revision check'],
      canonical: 'https://pdfflow.app/compare-pdf',
      faqs: []
    }
  },
  {
    id: 'redact-pdf',
    name: 'Redact PDF',
    shortDescription: 'Permanently remove or block out sensitive text, confidential numbers, and images from PDF.',
    longDescription: 'Irreversible sanitization of private data, metadata, and visual layers.',
    category: 'security',
    route: '/protect-pdf',
    icon: 'slash',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'High Security',
    seo: {
      title: 'Redact PDF Online - Remove Sensitive Data | PDF flow',
      description: 'Permanently blackout confidential information from PDF.',
      keywords: ['redact pdf', 'blackout pdf', 'sanitize pdf'],
      canonical: 'https://pdfflow.app/redact-pdf',
      faqs: []
    }
  },
  {
    id: 'crop-pdf',
    name: 'Crop PDF',
    shortDescription: 'Crop margins and define a custom visible area for each page or the whole document.',
    longDescription: 'Adjust trim box and crop box geometry to eliminate empty borders.',
    category: 'edit',
    route: '/edit-pdf',
    icon: 'crop',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'planned',
    badgeText: 'Planned',
    seo: {
      title: 'Crop PDF Online - Trim Margins | PDF flow',
      description: 'Crop margins and customize page viewing bounds in PDF.',
      keywords: ['crop pdf', 'trim pdf margins', 'resize pdf bounds'],
      canonical: 'https://pdfflow.app/crop-pdf',
      faqs: []
    }
  },
  {
    id: 'pdf-forms',
    name: 'PDF Forms',
    shortDescription: 'Fill out interactive PDF forms or create fillable forms with text fields, checkboxes and radio buttons.',
    longDescription: 'AcroForm and XFA form viewer, filler, and export tool.',
    category: 'edit',
    route: '/edit-pdf',
    icon: 'check-square',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: 'NEW',
    isNew: true,
    seo: {
      title: 'PDF Forms Builder & Filler Online | PDF flow',
      description: 'Create and fill interactive PDF forms online.',
      keywords: ['pdf forms', 'fill pdf form', 'create fillable pdf'],
      canonical: 'https://pdfflow.app/pdf-forms',
      faqs: []
    }
  },
  {
    id: 'ai-summarizer',
    name: 'AI Summarizer',
    shortDescription: 'Summarize lengthy reports and extract key points, paragraphs, and statistics using intelligent AI.',
    longDescription: 'Generative AI summarization, executive brief extraction, and bullet-point digest.',
    category: 'intelligence',
    route: '/pdf-to-word',
    icon: 'sparkles',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: 'NEW',
    isNew: true,
    seo: {
      title: 'AI PDF Summarizer - Instant Document Insights | PDF flow',
      description: 'Summarize PDF documents and extract key bullet points using AI.',
      keywords: ['ai pdf summarizer', 'chat with pdf', 'summarize pdf online'],
      canonical: 'https://pdfflow.app/ai-summarizer',
      faqs: []
    }
  },
  {
    id: 'translate-pdf',
    name: 'Translate PDF',
    shortDescription: 'Translate your entire PDF into 50+ languages while preserving layout, fonts, and table styling.',
    longDescription: 'High-fidelity AI document translation with format retention.',
    category: 'intelligence',
    route: '/pdf-to-word',
    icon: 'globe',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: 'NEW',
    isNew: true,
    seo: {
      title: 'Translate PDF Online - 50+ Languages | PDF flow',
      description: 'Translate PDF files into 50+ languages while keeping formatting.',
      keywords: ['translate pdf', 'multilingual pdf', 'ai pdf translator'],
      canonical: 'https://pdfflow.app/translate-pdf',
      faqs: []
    }
  },
  {
    id: 'pdf-to-markdown',
    name: 'PDF to Markdown',
    shortDescription: 'Convert complex PDF documents into clean, structured Markdown ready for LLMs, GitHub, and docs.',
    longDescription: 'Parse headings, tables, code snippets, and lists into pristine GFM Markdown.',
    category: 'intelligence',
    route: '/pdf-to-word',
    icon: 'code',
    processingMode: 'hybrid',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 1,
    maxFileSizeBytes: 50 * 1024 * 1024,
    status: 'available',
    badgeText: 'NEW',
    isNew: true,
    seo: {
      title: 'PDF to Markdown Converter Online | PDF flow',
      description: 'Convert PDF files into structured Markdown for documentation and AI.',
      keywords: ['pdf to markdown', 'pdf to md', 'convert pdf to text'],
      canonical: 'https://pdfflow.app/pdf-to-markdown',
      faqs: []
    }
  }
];
