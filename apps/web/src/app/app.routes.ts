import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { MergePdfComponent } from './pages/merge-pdf/merge-pdf.component';
import { PdfToWordComponent } from './pages/pdf-to-word/pdf-to-word.component';
import { ToolPlaceholderComponent } from './pages/tool-placeholder/tool-placeholder.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'PDF flow - Online PDF Converter & Document Tools'
  },
  {
    path: 'merge-pdf',
    component: MergePdfComponent,
    title: 'Merge PDF Online Free - Combine PDF Files Privately | PDF flow'
  },
  {
    path: 'split-pdf',
    component: ToolPlaceholderComponent,
    title: 'Split PDF Online - Separate PDF Pages | PDF flow'
  },
  {
    path: 'compress-pdf',
    component: ToolPlaceholderComponent,
    title: 'Compress PDF Online | PDF flow'
  },
  {
    path: 'pdf-to-word',
    component: PdfToWordComponent,
    title: 'PDF to Word Converter Online | PDF flow'
  },
  {
    path: 'pdf-to-powerpoint',
    component: ToolPlaceholderComponent,
    title: 'PDF to PowerPoint Converter | PDF flow'
  },
  {
    path: 'pdf-to-excel',
    component: ToolPlaceholderComponent,
    title: 'PDF to Excel Converter | PDF flow'
  },
  {
    path: 'word-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'Word to PDF Converter Online | PDF flow'
  },
  {
    path: 'powerpoint-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'PowerPoint to PDF Converter | PDF flow'
  },
  {
    path: 'excel-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'Excel to PDF Converter | PDF flow'
  },
  {
    path: 'edit-pdf',
    component: ToolPlaceholderComponent,
    title: 'Edit PDF Online Free | PDF flow'
  },
  {
    path: 'pdf-to-jpg',
    component: ToolPlaceholderComponent,
    title: 'PDF to JPG Converter Online | PDF flow'
  },
  {
    path: 'images-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'JPG to PDF Converter Free Online | PDF flow'
  },
  {
    path: 'sign-pdf',
    component: ToolPlaceholderComponent,
    title: 'Sign PDF Online - Free E-Signatures | PDF flow'
  },
  {
    path: 'watermark-pdf',
    component: ToolPlaceholderComponent,
    title: 'Watermark PDF Online | PDF flow'
  },
  {
    path: 'rotate-pdf',
    component: ToolPlaceholderComponent,
    title: 'Rotate PDF Online - Permanently Rotate Pages | PDF flow'
  },
  {
    path: 'html-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'HTML to PDF Converter | PDF flow'
  },
  {
    path: 'unlock-pdf',
    component: ToolPlaceholderComponent,
    title: 'Unlock PDF Online - Remove Password | PDF flow'
  },
  {
    path: 'protect-pdf',
    component: ToolPlaceholderComponent,
    title: 'Protect PDF with Password Online | PDF flow'
  },
  {
    path: 'about-us',
    loadComponent: () => import('./pages/about-us/about-us.component').then(m => m.AboutUsComponent),
    title: 'About Us - The Story & Mission Behind PDF flow | Free & Secure PDF Tools'
  },
  {
    path: 'about',
    redirectTo: 'about-us'
  },
  {
    path: 'contact-us',
    loadComponent: () => import('./pages/contact-us/contact-us.component').then(m => m.ContactUsComponent),
    title: 'Contact - Get in Touch with PDF flow Support & Sales'
  },
  {
    path: 'contact',
    redirectTo: 'contact-us'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
