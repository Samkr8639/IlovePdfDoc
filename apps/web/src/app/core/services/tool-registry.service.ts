import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TOOL_REGISTRY, ToolDefinition, ToolCategory, ApiResponse, LIVE_TOOL_IDS as CONTRACT_LIVE_TOOL_IDS } from '@paperflow/contracts';
import { environment } from '../../../environments/environment';

export const LIVE_TOOL_IDS = new Set<string>(CONTRACT_LIVE_TOOL_IDS || [
  'merge-pdf',
  'split-pdf',
  'compress-pdf',
  'pdf-to-word',
  'pdf-to-powerpoint',
  'pdf-to-excel',
  'word-to-pdf',
  'excel-to-pdf',
  'powerpoint-to-pdf',
  'edit-pdf',
  'pdf-to-jpg',
  'jpg-to-pdf',
  'sign-pdf'
]);

@Injectable({
  providedIn: 'root'
})
export class ToolRegistryService {
  private readonly http = inject(HttpClient, { optional: true });

  private readonly tools = signal<ToolDefinition[]>(TOOL_REGISTRY);
  readonly allTools = this.tools.asReadonly();
  readonly selectedCategory = signal<ToolCategory | 'all'>('all');
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.fetchToolsFromApi();
  }

  readonly filteredTools = computed(() => {
    const category = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();

    return this.tools().filter(tool => {
      const matchesCategory = category === 'all' || tool.category === category;
      const matchesQuery = !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.shortDescription.toLowerCase().includes(query) ||
        tool.category.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  });

  fetchToolsFromApi(): void {
    if (!this.http) {
      return;
    }

    // Do not attempt insecure HTTP requests from HTTPS contexts (prevents mixed content errors)
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && environment.apiBaseUrl.startsWith('http://')) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<ApiResponse<ToolDefinition[]>>(`${environment.apiBaseUrl}/tools`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data)) {
          if (JSON.stringify(res.data) !== JSON.stringify(this.tools())) {
            this.tools.set(res.data);
          }
        }
        this.isLoading.set(false);
      },
      error: () => {
        // Fallback silently to bundled TOOL_REGISTRY without noisy console errors
        this.isLoading.set(false);
      }
    });
  }

  getAllTools(): ToolDefinition[] {
    return this.tools();
  }

  getToolByRoute(route: string): ToolDefinition | undefined {
    const cleanRoute = route.startsWith('/') ? route : `/${route}`;
    return this.tools().find(t => t.route === cleanRoute);
  }

  getToolById(id: string): ToolDefinition | undefined {
    return this.tools().find(t => t.id === id);
  }

  isLive(id: string): boolean {
    return LIVE_TOOL_IDS.has(id);
  }

  setCategory(category: ToolCategory | 'all'): void {
    this.selectedCategory.set(category);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }
}
