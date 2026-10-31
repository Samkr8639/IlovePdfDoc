import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TOOL_REGISTRY, ToolDefinition, ToolCategory, ApiResponse } from '@paperflow/contracts';
import { environment } from '../../../environments/environment';

export const LIVE_TOOL_IDS = new Set<string>([
  'merge-pdf',
  'split-pdf',
  'compress-pdf',
  'pdf-to-word',
  'pdf-to-powerpoint',
  'pdf-to-excel',
  'word-to-pdf',
  'edit-pdf'
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
      error: (err) => {
        console.warn('Backend API tools fetch failed, using fallback registry:', err);
        this.error.set('Could not fetch tools from API, using cached registry.');
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
