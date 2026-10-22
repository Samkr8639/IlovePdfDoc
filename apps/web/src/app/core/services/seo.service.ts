import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { ToolSeo } from '@paperflow/contracts';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private titleService = inject(Title);
  private metaService = inject(Meta);

  setSeoData(seo: ToolSeo): void {
    this.titleService.setTitle(seo.title);

    this.metaService.updateTag({ name: 'description', content: seo.description });
    this.metaService.updateTag({ name: 'keywords', content: seo.keywords.join(', ') });

    // OpenGraph
    this.metaService.updateTag({ property: 'og:title', content: seo.title });
    this.metaService.updateTag({ property: 'og:description', content: seo.description });
    this.metaService.updateTag({ property: 'og:type', content: 'website' });
    this.metaService.updateTag({ property: 'og:url', content: seo.canonical });

    // Twitter Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: seo.title });
    this.metaService.updateTag({ name: 'twitter:description', content: seo.description });

    this.setCanonicalUrl(seo.canonical);
  }

  setCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = document.querySelector("link[rel='canonical']");
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  setDefaultSeo(): void {
    this.setSeoData({
      title: 'PaperFlow - Free & Private Online PDF Toolkit',
      description: 'Merge, split, rotate, and manage PDF documents right in your browser. 100% private, free, and secure with zero file uploads required.',
      keywords: ['pdf tools', 'free online pdf', 'private pdf merger', 'secure pdf editor', 'client-side pdf'],
      canonical: 'https://paperflow.app/',
      faqs: []
    });
  }
}
