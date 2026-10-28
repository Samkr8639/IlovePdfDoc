import { Component, ElementRef, HostListener, inject, signal, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ToolRegistryService } from '../../../core/services/tool-registry.service';
import { ToolDefinition } from '@paperflow/contracts';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  private readonly elementRef = inject(ElementRef);
  private readonly router = inject(Router);
  readonly toolRegistry = inject(ToolRegistryService);

  activeMenu = signal<'convert' | 'all' | null>(null);
  mobileMenuOpen = signal<boolean>(false);
  mobileConvertOpen = signal<boolean>(false);
  mobileAllOpen = signal<boolean>(false);
  private closeTimer: any = null;

  // Spotlight Command Palette Modal State
  searchModalOpen = signal<boolean>(false);
  searchModalQuery = signal<string>('');
  activeCategory = signal<string>('all');
  selectedIndex = signal<number>(0);

  openSearchModal(): void {
    this.searchModalQuery.set('');
    this.activeCategory.set('all');
    this.selectedIndex.set(0);
    this.searchModalOpen.set(true);
    setTimeout(() => {
      const input = document.querySelector('.palette-search-input') as HTMLInputElement | null;
      input?.focus();
    }, 40);
  }

  closeSearchModal(): void {
    this.searchModalOpen.set(false);
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchModalQuery.set(val);
    this.selectedIndex.set(0);
  }

  clearSearchQuery(): void {
    this.searchModalQuery.set('');
    this.selectedIndex.set(0);
    const input = document.querySelector('.palette-search-input') as HTMLInputElement | null;
    input?.focus();
  }

  setCategory(cat: string): void {
    this.activeCategory.set(cat);
    this.selectedIndex.set(0);
  }

  readonly filteredModalTools = computed(() => {
    const q = this.searchModalQuery().toLowerCase().trim();
    const cat = this.activeCategory();
    const all = this.toolRegistry.allTools();

    return all.filter(tool => {
      const matchCat = cat === 'all' || tool.category === cat;
      const matchQuery = !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.shortDescription.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  onPaletteKeydown(event: KeyboardEvent): void {
    const list = this.filteredModalTools();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (list.length > 0) {
        this.selectedIndex.set((this.selectedIndex() + 1) % list.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length > 0) {
        this.selectedIndex.set((this.selectedIndex() - 1 + list.length) % list.length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (list.length > 0 && list[this.selectedIndex()]) {
        this.selectTool(list[this.selectedIndex()]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearchModal();
    }
  }

  selectTool(tool: ToolDefinition): void {
    if (tool && tool.route) {
      this.closeSearchModal();
      this.closeMenu();
      this.closeMobileMenu();
      this.router.navigateByUrl(tool.route);
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if (
      (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
      (event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName))
    ) {
      event.preventDefault();
      if (this.searchModalOpen()) {
        this.closeSearchModal();
      } else {
        this.openSearchModal();
      }
    } else if (event.key === 'Escape') {
      this.closeMenu();
      this.closeMobileMenu();
      this.closeSearchModal();
    }
  }

  openMenu(menu: 'convert' | 'all'): void {
    this.cancelCloseMenu();
    this.activeMenu.set(menu);
  }

  toggleMenu(menu: 'convert' | 'all'): void {
    if (this.activeMenu() === menu) {
      this.closeMenu();
    } else {
      this.openMenu(menu);
    }
  }

  scheduleCloseMenu(): void {
    this.closeTimer = setTimeout(() => {
      this.activeMenu.set(null);
    }, 220);
  }

  cancelCloseMenu(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  closeMenu(): void {
    this.cancelCloseMenu();
    this.activeMenu.set(null);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    this.mobileConvertOpen.set(false);
    this.mobileAllOpen.set(false);
  }

  toggleMobileSection(section: 'convert' | 'all'): void {
    if (section === 'convert') {
      this.mobileConvertOpen.set(!this.mobileConvertOpen());
    } else {
      this.mobileAllOpen.set(!this.mobileAllOpen());
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }
}
