import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { MergePdfComponent } from './pages/merge-pdf/merge-pdf.component';
import { ToolPlaceholderComponent } from './pages/tool-placeholder/tool-placeholder.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'PaperFlow - Fast, Private Online PDF Tools'
  },
  {
    path: 'merge-pdf',
    component: MergePdfComponent,
    title: 'Merge PDF Online Free - Combine PDF Files Privately | PaperFlow'
  },
  {
    path: 'split-pdf',
    component: ToolPlaceholderComponent,
    title: 'Split PDF Online - Separate PDF Pages | PaperFlow'
  },
  {
    path: 'rotate-pdf',
    component: ToolPlaceholderComponent,
    title: 'Rotate PDF Online - Permanently Rotate Pages | PaperFlow'
  },
  {
    path: 'images-to-pdf',
    component: ToolPlaceholderComponent,
    title: 'JPG & Images to PDF Converter | PaperFlow'
  },
  {
    path: 'compress-pdf',
    component: ToolPlaceholderComponent,
    title: 'Compress PDF Online | PaperFlow'
  },
  {
    path: 'protect-pdf',
    component: ToolPlaceholderComponent,
    title: 'Protect PDF with Password | PaperFlow'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
