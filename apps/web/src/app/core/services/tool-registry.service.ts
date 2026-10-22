import { Injectable, signal, computed } from '@angular/core';
// Loaded from @paperflow/contracts (18 tools suite)
import { TOOL_REGISTRY, ToolDefinition, ToolCategory } from '@paperflow/contracts';

@Injectable({
  providedIn: 'root'
})
export class ToolRegistryService {
  private readonly tools = signal<ToolDefinition[]>(TOOL_REGISTRY);
  readonly allTools = this.tools.asReadonly();
  readonly selectedCategory = signal<ToolCategory | 'all'>('all');
  readonly searchQuery = signal<string>('');

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

  setCategory(category: ToolCategory | 'all'): void {
    this.selectedCategory.set(category);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }
}
