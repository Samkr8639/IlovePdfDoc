import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DropzoneComponent } from '../../../../shared/components/dropzone/dropzone.component';
import { ExploreMoreToolsComponent } from '../../../../shared/components/explore-more-tools/explore-more-tools.component';

@Component({
  selector: 'app-edit-pdf-hero',
  standalone: true,
  imports: [CommonModule, DropzoneComponent, ExploreMoreToolsComponent],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 600px;
    }
  `],
  template: `
    <section class="unified-hero-section">
      <div class="container hero-content">
        <h1 class="tool-h1">Edit PDF</h1>
        <p class="tool-lead">
          Add text, shapes, comments, and highlights to your PDF document. 100% free and in-browser.
        </p>

        <!-- UPLOADER COMPONENT -->
        <div class="hero-dropzone-wrap">
          <app-dropzone
            title="Select PDF file"
            subtitle="or drop PDF here"
            acceptedTypes=".pdf,application/pdf"
            [multiple]="false"
            limitInfo=""
            (filesSelected)="filesSelected.emit($event)" />
        </div>
      </div>
    </section>

    <!-- TOP ADSENSE ADVERTISEMENT SLOT (Temporarily commented until AdSense approval)
    <section class="adsense-section">
      <div class="container">
        <div class="adsense-wrapper" aria-label="Advertisement">
          <span class="adsense-label">Advertisement</span>
          <div class="adsense-slot adsense-leaderboard">
            <div class="adsense-placeholder-content">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                opacity="0.5">
                <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span>Google AdSense Slot • Auto-Responsive Leaderboard (728 × 90 / 320 × 100)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    -->

    <!-- FEATURES & VALUE PROPOSITION -->
    <section class="features-section">
      <div class="container">
        <div class="section-heading">
          <h2 class="section-title">The easiest & safest way to edit PDF documents</h2>
          <p class="section-subtitle">Engineered for privacy, speed, and precision.</p>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon-badge">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#0F766E" />
                <path d="M24 11l11 4v7c0 8-5 13-11 16-6-3-11-8-11-16v-7l11-4z" fill="white" />
                <circle cx="24" cy="23" r="2.5" fill="#0F766E" />
              </svg>
            </div>
            <h3 class="feature-title">100% In-Browser Privacy</h3>
            <p class="feature-desc">
              Your PDF documents stay on your device. Client-side editing runs directly inside your browser memory using
              WebAssembly.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-badge">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#0F766E" />
                <path d="M16 24l6 6 12-12" stroke="white" stroke-width="3.5" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
            <h3 class="feature-title">In-Place Text Editing</h3>
            <p class="feature-desc">
              Edit existing text directly in your PDF. Change words, fonts, sizes, colors, and formatting without losing
              alignment.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-badge">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#0F766E" />
                <path d="M18 16l6-6 6 6M24 10v28M30 32l-6 6-6-6" stroke="white" stroke-width="2.5" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
            <h3 class="feature-title">Draw, Sign & Annotate</h3>
            <p class="feature-desc">
              Add handwritten signatures, highlights, custom shapes, drawings, and images to any page effortlessly.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-badge">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="10" fill="#0F766E" />
                <path
                  d="M16 24c0-3.3 2.7-6 6-6 2.3 0 4.2 1.3 5.2 3.1.9-1.8 2.8-3.1 5.1-3.1 3.3 0 6 2.7 6 6s-2.7 6-6 6c-2.3 0-4.2-1.3-5.1-3.1-.9 1.8-2.9 3.1-5.2 3.1-3.3 0-6-2.7-6-6z"
                  stroke="white" stroke-width="2.5" fill="none" />
              </svg>
            </div>
            <h3 class="feature-title">Free & Unlimited</h3>
            <p class="feature-desc">
              Edit as many documents as you need with no subscriptions, watermark additions, or hidden paywalls.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 3-STEP GUIDE SECTION -->
    <section class="seo-guide-section">
      <div class="container">
        <div class="guide-header">
          <h2 class="guide-title">How to edit PDF files online</h2>
          <p class="guide-lead">Three effortless steps to edit your documents with precision.</p>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-num">01</div>
            <h3 class="step-title">Select document</h3>
            <p class="step-desc">
              Click "Select PDF file", drag and drop your file into the dropzone, or import from Google Drive or Dropbox.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num">02</div>
            <h3 class="step-title">Edit & annotate</h3>
            <p class="step-desc">
              Use Annotate to add signatures, shapes, and highlights, or toggle to Edit Text to update existing document
              text in-place.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num">03</div>
            <h3 class="step-title">Save & download</h3>
            <p class="step-desc">
              Click "Save & Download" to instantly export your edited PDF document with all modifications preserved
              losslessly.
            </p>
          </div>
        </div>

        <!-- FAQ SECTION FOR EDIT PDF -->
        <div class="tool-faqs">
          <h3 class="tool-faqs-title">Frequently Asked Questions</h3>
          <div class="tool-faqs-list">
            <div class="faq-card">
              <h4 class="faq-q">Are my files uploaded to your servers when editing?</h4>
              <p class="faq-a">
                No. PDF editing runs completely client-side in your browser memory using WebAssembly. Your files are never
                uploaded to any remote server during editing.
              </p>
            </div>
            <div class="faq-card">
              <h4 class="faq-q">Can I edit existing text in a PDF document?</h4>
              <p class="faq-a">
                Yes! Simply click the "Edit Text" toggle in the top bar. The editor recognizes text blocks on your page
                and lets you update words, fix typos, and change styling in-place.
              </p>
            </div>
            <div class="faq-card">
              <h4 class="faq-q">Can I sign and fill PDF forms?</h4>
              <p class="faq-a">
                Yes. You can create cursive or drawn signatures, place dates and text boxes, and insert whiteout or shapes
                anywhere on the document.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- EXPLORE MORE PDF TOOLS -->
    <app-explore-more-tools currentTool="edit-pdf" />
  `
})
export class EditPdfHeroComponent {
  readonly filesSelected = output<File[]>();
}

