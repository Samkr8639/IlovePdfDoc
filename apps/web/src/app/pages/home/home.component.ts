import { Component, inject, OnInit, AfterViewInit, OnDestroy, signal, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { AnimationService } from '../../core/services/animation.service';
import { ToolCategory } from '@paperflow/contracts';
import { PtSectionHeaderComponent } from '../../shared/components/pt-section-header/pt-section-header.component';
import { PtAdSlotComponent } from '../../shared/components/pt-ad-slot/pt-ad-slot.component';

type ExtendedFilterCategory = ToolCategory | 'all' | 'workflows' | 'intelligence';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, PtSectionHeaderComponent, PtAdSlotComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  toolRegistry = inject(ToolRegistryService);
  private seo = inject(SeoService);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);
  private animCtx: any = null;

  selectedTab = signal<ExtendedFilterCategory>('all');
  isWorkflowModalOpen = signal<boolean>(false);

  private readonly liveToolIds = new Set([
    'merge-pdf',
    'split-pdf',
    'compress-pdf',
    'pdf-to-word',
    'pdf-to-powerpoint'
  ]);

  ngOnInit(): void {
    this.seo.setSeoData({
      title: 'PDFTailor - Online PDF Converter & Document Tools Free',
      description: 'The easiest & fastest free online PDF tools. Merge, split, compress, convert, edit, and tailor PDFs with 100% in-browser privacy.',
      keywords: ['pdf tools', 'merge pdf', 'split pdf', 'compress pdf', 'pdf converter', 'free pdf tools', 'pdftailor'],
      canonical: 'https://pdftailor.in',
      faqs: []
    });
  }

  ngAfterViewInit(): void {
    const el = this.elementRef.nativeElement;
    this.animCtx = this.animationService.animateHero(el);
  }

  ngOnDestroy(): void {
    if (this.animCtx && typeof this.animCtx.revert === 'function') {
      this.animCtx.revert();
    }
  }

  isLive(toolId: string): boolean {
    return this.liveToolIds.has(toolId);
  }

  onSelectCategory(tab: ExtendedFilterCategory): void {
    this.selectedTab.set(tab);

    if (tab === 'workflows') {
      // Dedicated workflows view
    } else {
      this.toolRegistry.setCategory(tab);
    }
  }

  openWorkflowModal(): void {
    this.isWorkflowModalOpen.set(true);
  }

  closeWorkflowModal(): void {
    this.isWorkflowModalOpen.set(false);
  }

  displayedTools() {
    const tab = this.selectedTab();
    if (tab === 'workflows') {
      return [];
    }
    return this.toolRegistry.filteredTools();
  }

  onHeroMouseMove(event: MouseEvent): void {
    const heroEl = this.elementRef.nativeElement.querySelector('.hero-section') as HTMLElement | null;
    if (!heroEl) return;

    const rect = heroEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normX = (event.clientX - centerX) / (rect.width / 2);
    const normY = (event.clientY - centerY) / (rect.height / 2);

    this.animationService.updateHeroMouseParallax(heroEl, normX, normY);
  }

  onHeroMouseLeave(): void {
    const heroEl = this.elementRef.nativeElement.querySelector('.hero-section') as HTMLElement | null;
    if (!heroEl) return;

    this.animationService.resetHeroMouseParallax(heroEl);
  }
}
