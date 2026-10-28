import { Component, ElementRef, HostListener, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { ToolRegistryService } from '../../../core/services/tool-registry.service';
import { ToolDefinition } from '@paperflow/contracts';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, MatAutocompleteModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly router = inject(Router);
  readonly toolRegistry = inject(ToolRegistryService);

  activeMenu = signal<'convert' | 'all' | null>(null);
  mobileMenuOpen = signal<boolean>(false);
  mobileConvertOpen = signal<boolean>(false);
  mobileAllOpen = signal<boolean>(false);
  private closeTimer: any = null;

  readonly searchControl = new FormControl('');
  readonly searchQuery = signal<string>('');
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.searchSub = this.searchControl.valueChanges.subscribe(val => {
      this.searchQuery.set(val || '');
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  readonly filteredTools = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.toolRegistry.allTools();
    if (!q) {
      return all.slice(0, 8); // show popular tools on focus
    }
    return all.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.shortDescription.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });

  onToolSelected(event: MatAutocompleteSelectedEvent): void {
    const tool = event.option.value as ToolDefinition;
    if (tool && tool.route) {
      this.searchControl.setValue('', { emitEvent: false });
      this.searchQuery.set('');
      this.router.navigateByUrl(tool.route);
      this.closeMenu();
      this.closeMobileMenu();
    }
  }

  clearSearch(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.searchControl.setValue('');
    this.searchQuery.set('');
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (
      (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
      (event.key === '/' && (event.target as HTMLElement).tagName !== 'INPUT')
    ) {
      event.preventDefault();
      const input = this.elementRef.nativeElement.querySelector('.header-search-input') as HTMLInputElement | null;
      input?.focus();
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
    this.closeMobileMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }
}
