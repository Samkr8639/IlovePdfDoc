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

  // In-place Header Search State
  isSearchOpen = signal<boolean>(false);
  searchQuery = signal<string>('');
  selectedIndex = signal<number>(0);

  readonly filteredTools = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.toolRegistry.allTools();
    if (!q) {
      // When opened without typing, show popular/live tools first
      return all.slice(0, 8);
    }
    return all.filter(tool =>
      tool.name.toLowerCase().includes(q) ||
      tool.shortDescription.toLowerCase().includes(q) ||
      tool.category.toLowerCase().includes(q)
    );
  });

  onSearchFocus(): void {
    this.isSearchOpen.set(true);
    this.closeMenu();
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
    this.selectedIndex.set(0);
    this.isSearchOpen.set(true);
  }

  clearSearch(event?: Event): void {
    event?.stopPropagation();
    this.searchQuery.set('');
    this.selectedIndex.set(0);
    const input = this.elementRef.nativeElement.querySelector('.header-search-input') as HTMLInputElement | null;
    input?.focus();
  }

  closeSearch(): void {
    this.isSearchOpen.set(false);
    this.selectedIndex.set(0);
  }

  openSearch(): void {
    this.isSearchOpen.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isSearchOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.openSearch();
        return;
      }
    }

    const list = this.filteredTools();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (list.length > 0) {
        this.selectedIndex.set((this.selectedIndex() + 1) % list.length);
        this.scrollToSelectedItem();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length > 0) {
        this.selectedIndex.set((this.selectedIndex() - 1 + list.length) % list.length);
        this.scrollToSelectedItem();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (list.length > 0 && list[this.selectedIndex()]) {
        this.selectTool(list[this.selectedIndex()]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch();
      const input = this.elementRef.nativeElement.querySelector('.header-search-input') as HTMLInputElement | null;
      input?.blur();
    }
  }

  private scrollToSelectedItem(): void {
    setTimeout(() => {
      const selectedEl = this.elementRef.nativeElement.querySelector('.dropdown-item.selected') as HTMLElement | null;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  selectTool(tool: ToolDefinition): void {
    if (tool && tool.route) {
      this.closeSearch();
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
      this.openSearch();
      const input = this.elementRef.nativeElement.querySelector('.header-search-input') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    } else if (event.key === 'Escape') {
      this.closeMenu();
      this.closeMobileMenu();
      this.closeSearch();
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
    const target = event.target as HTMLElement;
    const searchWrap = this.elementRef.nativeElement.querySelector('.header-search-wrap');
    if (searchWrap && !searchWrap.contains(target)) {
      this.closeSearch();
    }
    if (!this.elementRef.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }
}
