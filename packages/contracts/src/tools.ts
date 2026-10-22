export type ProcessingMode = 'browser' | 'server' | 'hybrid';
export type ToolCategory = 'organize' | 'convert' | 'optimize' | 'edit' | 'security';
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
  seo: ToolSeo;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  // ORGANIZE CATEGORY
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    shortDescription: 'Combine multiple PDF files into a single, cohesive document in seconds.',
    longDescription: 'Merge and combine multiple PDF documents into one cleanly formatted PDF. Reorder pages and files visually before processing. Operates 100% locally in your browser for absolute privacy.',
    category: 'organize',
    route: '/merge-pdf',
    icon: 'layers',
    processingMode: 'browser',
    acceptedFileTypes: ['.pdf', 'application/pdf'],
    maxFiles: 30,
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB per file
    status: 'available',
    badgeText: '100% In-Browser Private',
    seo: {
      title: 'Merge PDF Online Free - Combine PDF Files Privately | PaperFlow',
      description: 'Merge multiple PDF files into one document free online. Fast, secure, and 100% private in-browser processing with zero file uploads required.',
      keywords: ['merge pdf', 'combine pdf', 'join pdf files', 'free online pdf merger', 'secure pdf merge'],
      canonical: 'https://paperflow.app/merge-pdf',
      faqs: [
        {
          question: 'Are my PDF files uploaded to any server when I merge them?',
          answer: 'No. PaperFlow merges your files directly inside your browser memory using WebAssembly and client-side processing. Your documents never leave your device.'
        },
        {
          question: 'Can I reorder my PDFs before merging?',
          answer: 'Yes! You can drag and drop or use the order controls to arrange your documents in the exact sequence you want them merged.'
        },
        {
          question: 'Is there a limit on file size or number of files?',
          answer: 'You can combine up to 30 PDF documents at once, with individual file sizes up to 50MB, completely free.'
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
      title: 'Split PDF Online Free - Separate PDF Pages | PaperFlow',
      description: 'Split PDF pages into individual documents or extract custom page ranges quickly and securely in your browser.',
      keywords: ['split pdf', 'separate pdf pages', 'extract pdf pages', 'free pdf splitter'],
      canonical: 'https://paperflow.app/split-pdf',
      faqs: [
        {
          question: 'How do I specify which pages to split?',
          answer: 'You can provide comma-separated page ranges (e.g., 1-3, 5, 8-10) or choose to split every page into an independent file.'
        }
      ]
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
      title: 'Rotate PDF Online Free - Permanently Rotate Pages | PaperFlow',
      description: 'Rotate PDF pages permanently in your browser. Fast 90-degree clockwise or counter-clockwise rotation with zero data uploads.',
      keywords: ['rotate pdf', 'rotate pdf pages', 'fix pdf orientation', 'turn pdf'],
      canonical: 'https://paperflow.app/rotate-pdf',
      faqs: [
        {
          question: 'Does rotating reduce the PDF quality?',
          answer: 'No. The rotation updates the PDF matrix metadata losslessly without recompressing text or images.'
        }
      ]
    }
  },
  {
    id: 'images-to-pdf',
    name: 'JPG to PDF',
    shortDescription: 'Convert JPG, PNG, and WebP images into a high-quality PDF document.',
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
      title: 'JPG & Images to PDF Converter Free Online | PaperFlow',
      description: 'Convert JPG, PNG, and image scans to clean PDF files directly in your web browser. Free, unlimited, private.',
      keywords: ['jpg to pdf', 'images to pdf', 'png to pdf', 'photos to pdf converter'],
      canonical: 'https://paperflow.app/images-to-pdf',
      faqs: [
        {
          question: 'What image formats are supported?',
          answer: 'We support JPG, JPEG, PNG, and WebP formats with automatic dimension scaling.'
        }
      ]
    }
  },
  // OPTIMIZE & SECURITY (Planned / Phase 2)
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    shortDescription: 'Reduce the file size of your PDF while maintaining optimal document visual quality.',
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
      title: 'Compress PDF Online - Reduce File Size | PaperFlow',
      description: 'Compress PDF files online without losing readability. Free optimization tool.',
      keywords: ['compress pdf', 'reduce pdf size', 'shrink pdf', 'pdf compressor'],
      canonical: 'https://paperflow.app/compress-pdf',
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
      title: 'Protect PDF with Password Online | PaperFlow',
      description: 'Encrypt your PDF document with a secure password to restrict access.',
      keywords: ['protect pdf', 'encrypt pdf', 'password protect pdf', 'lock pdf'],
      canonical: 'https://paperflow.app/protect-pdf',
      faqs: []
    }
  }
];
