import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { MergePdfComponent } from './pages/merge-pdf/merge-pdf.component';
import { PdfToWordComponent } from './pages/pdf-to-word/pdf-to-word.component';
import { ToolPlaceholderComponent } from './pages/tool-placeholder/tool-placeholder.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'PDFTailor - Online PDF Converter & Document Tools'
  },
  {
    path: 'merge-pdf',
    component: MergePdfComponent,
    title: 'Merge PDF Online Free - Combine PDF Files Privately | PDFTailor'
  },
  {
    path: 'split-pdf',
    component: ToolPlaceholderComponent,
    title: 'Split PDF Online - Separate PDF Pages | PDFTailor'
  },
  {
    path: 'compress-pdf',
    component: ToolPlaceholderComponent,
    title: 'Compress PDF Online | PDFTailor'
  },
  {
    path: 'pdf-to-word',
    component: PdfToWordComponent,
    title: 'PDF to Word Converter Online | PDFTailor'
  },
  {
    path: 'pdf-to-powerpoint',
    loadComponent: () => import('./pages/pdf-to-powerpoint/pdf-to-powerpoint.component').then(m => m.PdfToPowerPointComponent),
    title: 'PDF to PowerPoint Converter Online | PDFTailor'
  },
  {
    path: 'pdf-to-excel',
    component: ToolPlaceholderComponent,
    title: 'PDF to Excel Converter | PDFTailor'
  },
  {
    path: 'word-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'Word to PDF Converter Online | PDFTailor'
  },
  {
    path: 'powerpoint-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'PowerPoint to PDF Converter | PDFTailor'
  },
  {
    path: 'excel-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'Excel to PDF Converter | PDFTailor'
  },
  {
    path: 'edit-pdf',
    component: ToolPlaceholderComponent,
    title: 'Edit PDF Online Free | PDFTailor'
  },
  {
    path: 'pdf-to-jpg',
    component: ToolPlaceholderComponent,
    title: 'PDF to JPG Converter Online | PDFTailor'
  },
  {
    path: 'images-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'JPG to PDF Converter Free Online | PDFTailor'
  },
  {
    path: 'sign-pdf',
    component: ToolPlaceholderComponent,
    title: 'Sign PDF Online - Free E-Signatures | PDFTailor'
  },
  {
    path: 'watermark-pdf',
    component: ToolPlaceholderComponent,
    title: 'Watermark PDF Online | PDFTailor'
  },
  {
    path: 'rotate-pdf',
    component: ToolPlaceholderComponent,
    title: 'Rotate PDF Online - Permanently Rotate Pages | PDFTailor'
  },
  {
    path: 'html-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'HTML to PDF Converter | PDFTailor'
  },
  {
    path: 'unlock-pdf',
    component: ToolPlaceholderComponent,
    title: 'Unlock PDF Online - Remove Password | PDFTailor'
  },
  {
    path: 'protect-pdf',
    component: ToolPlaceholderComponent,
    title: 'Protect PDF with Password Online | PDFTailor'
  },
  {
    path: 'about-us',
    loadComponent: () => import('./pages/about-us/about-us.component').then(m => m.AboutUsComponent),
    title: 'About Us - The Story & Mission Behind PDFTailor | Free & Secure PDF Tools'
  },
  {
    path: 'about',
    redirectTo: 'about-us'
  },
  {
    path: 'contact-us',
    loadComponent: () => import('./pages/contact-us/contact-us.component').then(m => m.ContactUsComponent),
    title: 'Contact - Get in Touch with PDFTailor Support & Sales'
  },
  {
    path: 'contact',
    redirectTo: 'contact-us'
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent),
    title: 'Privacy Policy — PDFTailor Document Processing & Data Protection'
  },
  {
    path: 'privacy',
    redirectTo: 'privacy-policy'
  },
  {
    path: 'terms-and-conditions',
    loadComponent: () => import('./pages/terms-and-conditions/terms-and-conditions.component').then(m => m.TermsAndConditionsComponent),
    title: 'Terms & Conditions — PDFTailor Document Processing & Service Terms'
  },
  {
    path: 'terms',
    redirectTo: 'terms-and-conditions'
  },
  {
    path: 'tos',
    redirectTo: 'terms-and-conditions'
  },
  {
    path: 'gdpr-compliance',
    loadComponent: () => import('./pages/gdpr-compliance/gdpr-compliance.component').then(m => m.GdprComplianceComponent),
    title: 'GDPR Compliance & Data Protection — PDFTailor'
  },
  {
    path: 'gdpr',
    redirectTo: 'gdpr-compliance'
  },
  {
    path: 'security-whitepaper',
    loadComponent: () => import('./pages/security-whitepaper/security-whitepaper.component').then(m => m.SecurityWhitepaperComponent),
    title: 'Security Architecture & Document Processing Whitepaper — PDFTailor'
  },
  {
    path: 'security',
    redirectTo: 'security-whitepaper'
  },
  {
    path: 'whitepaper',
    redirectTo: 'security-whitepaper'
  },
  {
    path: 'cookie-settings',
    loadComponent: () => import('./pages/cookie-settings/cookie-settings.component').then(m => m.CookieSettingsComponent),
    title: 'Cookie Settings & Privacy Preferences — PDFTailor'
  },
  {
    path: 'cookies',
    redirectTo: 'cookie-settings'
  },
  {
    path: 'cookie-preferences',
    redirectTo: 'cookie-settings'
  },
  {
    path: 'press-media-kit',
    loadComponent: () => import('./pages/press-media-kit/press-media-kit.component').then(m => m.PressMediaKitComponent),
    title: 'Press & Media Kit — Official Brand Assets & Resources | PDFTailor'
  },
  {
    path: 'press',
    redirectTo: 'press-media-kit'
  },
  {
    path: 'media-kit',
    redirectTo: 'press-media-kit'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
