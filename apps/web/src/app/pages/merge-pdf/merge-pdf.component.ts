import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrowserPdfService, ValidatedPdfFile, MergeResult } from '../../core/services/browser-pdf.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { DropzoneComponent } from '../../shared/components/dropzone/dropzone.component';
import { FileListComponent } from '../../shared/components/file-list/file-list.component';
import { ProcessingStateComponent } from '../../shared/components/processing-state/processing-state.component';
import { ResultViewComponent } from '../../shared/components/result-view/result-view.component';

type WorkspaceState = 'upload' | 'organize' | 'processing' | 'completed';

@Component({
  selector: 'app-merge-pdf',
  imports: [
    RouterLink,
    DropzoneComponent,
    FileListComponent,
    ProcessingStateComponent,
    ResultViewComponent
  ],
  template: `
    <div class="tool-page">
      <!-- HEADER & BREADCRUMBS -->
      <section class="tool-header-section">
        <div class="tool-ambient-glow"></div>
        <div class="container tool-header-container">
          <nav class="breadcrumbs" aria-label="Breadcrumb">
            <a routerLink="/" class="crumb-link">Home</a>
            <span class="crumb-sep">/</span>
            <span class="crumb-cat">Organize</span>
            <span class="crumb-sep">/</span>
            <span class="crumb-current">Merge PDF</span>
          </nav>

          <div class="badge-privacy mode-badge">
            <span>In-Browser Processing • 100% Private</span>
          </div>

          <h1 class="tool-h1">Merge PDF Files Online</h1>
          <p class="tool-lead">
            Combine multiple PDF files into a single document in seconds.
            Files are processed entirely inside your browser with zero network uploads.
          </p>
        </div>
      </section>

      <!-- INTERACTIVE WORKSPACE -->
      <section class="workspace-section">
        <div class="container workspace-container">
          @if (errorMessage()) {
            <div class="error-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{{ errorMessage() }}</span>
              <button class="error-close" (click)="errorMessage.set(null)">✕</button>
            </div>
          }

          <!-- STATE 1: UPLOAD DROPZONE -->
          @if (currentState() === 'upload') {
            <div class="workspace-dropzone-wrapper">
              <app-dropzone
                title="Select PDF files to merge"
                subtitle="or drag and drop multiple PDF documents here"
                acceptedTypes=".pdf,application/pdf"
                [multiple]="true"
                limitInfo="Select 2 or more PDFs • Maximum 50MB per file"
                (filesSelected)="onFilesAdded($event)"
              ></app-dropzone>
            </div>
          }

          <!-- STATE 2: ORGANIZE & REORDER -->
          @if (currentState() === 'organize') {
            <div class="organize-workspace">
              <div class="workspace-controls-bar">
                <div class="controls-left">
                  <span class="files-summary">
                    <strong>{{ selectedFiles().length }}</strong> files ready to combine
                  </span>
                  <button type="button" class="btn-secondary add-more-btn" (click)="fileInput.click()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Add More Files</span>
                  </button>
                  <input
                    #fileInput
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,application/pdf"
                    (change)="onFileInputChange($event)"
                  />
                </div>

                <div class="controls-right">
                  <button type="button" class="btn-secondary clear-btn" (click)="resetWorkspace()">
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              <!-- FILE LIST -->
              <app-file-list
                [files]="selectedFiles()"
                (moveUp)="onMoveUp($event)"
                (moveDown)="onMoveDown($event)"
                (removeFile)="onRemoveFile($event)"
              ></app-file-list>

              <!-- FLOATING ACTION DOCK -->
              <div class="action-dock">
                <div class="dock-info">
                  <span class="dock-pill">Sequence Preserved</span>
                  <span class="dock-note">Pages will merge in the exact sequence shown above.</span>
                </div>

                <button
                  type="button"
                  class="btn-primary merge-submit-btn"
                  [disabled]="selectedFiles().length < 2 || isProcessing()"
                  (click)="executeMerge()"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                  <span>Merge {{ selectedFiles().length }} PDFs (In-Browser)</span>
                </button>
              </div>
            </div>
          }

          <!-- STATE 3: PROCESSING -->
          @if (currentState() === 'processing') {
            <app-processing-state
              title="Merging Documents..."
              [message]="processingMessage()"
              [percent]="processingProgress()"
            ></app-processing-state>
          }

          <!-- STATE 4: COMPLETED RESULT -->
          @if (currentState() === 'completed' && mergeResult()) {
            <app-result-view
              [result]="mergeResult()!"
              (reset)="resetWorkspace()"
            ></app-result-view>
          }
        </div>
      </section>

      <!-- SEO & GUIDE SECTION -->
      <section class="seo-guide-section">
        <div class="container">
          <div class="guide-header">
            <span class="badge-tag">Fast & Simple</span>
            <h2 class="guide-title">How to Merge PDF Files Online</h2>
            <p class="guide-lead">Three simple steps to combine documents securely in your web browser.</p>
          </div>

          <div class="steps-grid">
            <div class="step-card card-clean">
              <div class="step-num">01</div>
              <h3 class="step-title">Select Documents</h3>
              <p class="step-desc">
                Drag and drop your PDF documents into the upload box above, or click "Choose Files" to select from your file manager.
              </p>
            </div>

            <div class="step-card card-clean">
              <div class="step-num">02</div>
              <h3 class="step-title">Arrange the Order</h3>
              <p class="step-desc">
                Use the Move Up and Move Down arrow controls to order your files exactly how you want them to appear in the combined document.
              </p>
            </div>

            <div class="step-card card-clean">
              <div class="step-num">03</div>
              <h3 class="step-title">Merge & Download</h3>
              <p class="step-desc">
                Click "Merge PDFs". The browser combines your pages instantly using client-side JavaScript. Click Download to save.
              </p>
            </div>
          </div>

          <!-- FAQ SECTION FOR MERGE PDF -->
          <div class="tool-faqs">
            <h3 class="tool-faqs-title">Frequently Asked Questions About Merging PDFs</h3>
            <div class="tool-faqs-list">
              <div class="faq-card card-clean">
                <h4 class="faq-q">Are my documents uploaded to a remote server?</h4>
                <p class="faq-a">
                  No. Unlike traditional converters, PaperFlow executes the entire PDF combination directly inside your browser memory.
                  Your files are never transmitted to our backend.
                </p>
              </div>

              <div class="faq-card card-clean">
                <h4 class="faq-q">Can I merge documents of different page orientations?</h4>
                <p class="faq-a">
                  Yes! PaperFlow automatically preserves portrait and landscape orientations, margins, and embedded fonts across all joined files.
                </p>
              </div>

              <div class="faq-card card-clean">
                <h4 class="faq-q">Is there any fee or daily limit?</h4>
                <p class="faq-a">
                  PaperFlow is completely free with no daily limits or subscription gates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .tool-header-section {
      position: relative;
      padding: 56px 0 36px;
      text-align: center;
      background: #ffffff;
      border-bottom: 1px solid var(--surface-border);
      overflow: hidden;
    }
    .tool-ambient-glow {
      position: absolute;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 300px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    .tool-header-container {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 800px;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 18px;
    }
    .crumb-link:hover {
      color: var(--primary-600);
    }
    .crumb-sep {
      color: var(--text-light);
    }
    .crumb-current {
      color: var(--text-main);
      font-weight: 600;
    }
    .mode-badge {
      margin-bottom: 20px;
    }
    .tool-h1 {
      font-size: clamp(30px, 4.4vw, 46px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--text-main);
    }
    .tool-lead {
      font-size: 16px;
      color: var(--text-muted);
      margin-top: 14px;
      line-height: 1.6;
      font-weight: 500;
    }

    /* WORKSPACE */
    .workspace-section {
      padding: 52px 0 64px;
    }
    .workspace-container {
      max-width: 880px;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: var(--radius-md);
      background-color: var(--rose-50);
      color: var(--rose-600);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 24px;
      border: 1px solid #fecdd3;
    }
    .error-close {
      margin-left: auto;
      font-weight: 700;
      color: var(--rose-600);
      padding: 4px;
    }
    .workspace-controls-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .controls-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .files-summary {
      font-size: 14px;
      color: var(--text-main);
    }
    .add-more-btn {
      padding: 8px 16px;
      font-size: 13px;
    }
    .clear-btn {
      padding: 8px 16px;
      font-size: 13px;
    }
    
    /* FLOATING ACTION DOCK */
    .action-dock {
      position: sticky;
      bottom: 24px;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: var(--radius-xl);
      padding: 18px 26px;
      margin-top: 28px;
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(37, 99, 235, 0.08);
    }
    .dock-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dock-pill {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--primary-700);
    }
    .dock-note {
      font-size: 13px;
      color: var(--text-muted);
    }
    .merge-submit-btn {
      padding: 14px 32px;
      font-size: 15px;
    }

    /* GUIDE */
    .seo-guide-section {
      padding: 72px 0 36px;
      background: #ffffff;
      border-top: 1px solid var(--surface-border);
    }
    .guide-header {
      text-align: center;
      max-width: 680px;
      margin: 0 auto 52px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .guide-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }
    .guide-lead {
      font-size: 16px;
      color: var(--text-muted);
    }
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .step-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
      padding: 32px 28px;
    }
    .step-num {
      font-size: 32px;
      font-weight: 800;
      color: var(--primary-200);
      line-height: 1;
      font-family: var(--font-display);
    }
    .step-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
    }
    .step-desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .tool-faqs {
      margin-top: 68px;
      max-width: 840px;
      margin-left: auto;
      margin-right: auto;
    }
    .tool-faqs-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text-main);
      text-align: center;
      margin-bottom: 36px;
      letter-spacing: -0.02em;
    }
    .tool-faqs-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .faq-card {
      padding: 24px 28px;
    }
    .faq-q {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-main);
    }
    .faq-a {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 8px;
      line-height: 1.65;
    }

    @media (max-width: 768px) {
      .steps-grid {
        grid-template-columns: 1fr;
      }
      .action-dock {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      .merge-submit-btn {
        width: 100%;
      }
    }
  `]
})
export class MergePdfComponent implements OnInit {
  private pdfService = inject(BrowserPdfService);
  private toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);

  currentState = signal<WorkspaceState>('upload');
  selectedFiles = signal<ValidatedPdfFile[]>([]);
  isProcessing = signal<boolean>(false);
  processingProgress = signal<number>(0);
  processingMessage = signal<string>('');
  errorMessage = signal<string | null>(null);
  mergeResult = signal<MergeResult | null>(null);

  ngOnInit(): void {
    const tool = this.toolRegistry.getToolById('merge-pdf');
    if (tool) {
      this.seo.setSeoData(tool.seo);
    }
  }

  async onFilesAdded(files: File[]): Promise<void> {
    this.errorMessage.set(null);
    const validatedList: ValidatedPdfFile[] = [];

    for (const file of files) {
      const validated = await this.pdfService.validatePdf(file);
      validatedList.push(validated);
    }

    const current = this.selectedFiles();
    this.selectedFiles.set([...current, ...validatedList]);

    if (this.selectedFiles().length > 0) {
      this.currentState.set('organize');
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.onFilesAdded(files);
      input.value = '';
    }
  }

  onMoveUp(index: number): void {
    if (index <= 0) return;
    const list = [...this.selectedFiles()];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    this.selectedFiles.set(list);
  }

  onMoveDown(index: number): void {
    const list = [...this.selectedFiles()];
    if (index >= list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    this.selectedFiles.set(list);
  }

  onRemoveFile(index: number): void {
    const list = [...this.selectedFiles()];
    list.splice(index, 1);
    this.selectedFiles.set(list);

    if (list.length === 0) {
      this.currentState.set('upload');
    }
  }

  resetWorkspace(): void {
    const currentResult = this.mergeResult();
    if (currentResult?.url) {
      URL.revokeObjectURL(currentResult.url);
    }

    this.selectedFiles.set([]);
    this.mergeResult.set(null);
    this.errorMessage.set(null);
    this.processingProgress.set(0);
    this.currentState.set('upload');
  }

  async executeMerge(): Promise<void> {
    const validFiles = this.selectedFiles().filter((f) => f.isValid);
    if (validFiles.length < 2) {
      this.errorMessage.set('Please select at least 2 valid PDF documents to merge.');
      return;
    }

    this.isProcessing.set(true);
    this.currentState.set('processing');
    this.errorMessage.set(null);

    try {
      const rawFiles = validFiles.map((f) => f.file);
      const result = await this.pdfService.mergePdfs(rawFiles, (percent, msg) => {
        this.processingProgress.set(percent);
        this.processingMessage.set(msg);
      });

      this.mergeResult.set(result);
      this.currentState.set('completed');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while merging your PDF files.';
      this.errorMessage.set(message);
      this.currentState.set('organize');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
