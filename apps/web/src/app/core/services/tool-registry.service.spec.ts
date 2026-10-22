import { TestBed } from '@angular/core/testing';
import { ToolRegistryService } from './tool-registry.service';

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToolRegistryService);
  });

  it('should initialize with all registry tools', () => {
    const tools = service.getAllTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some(t => t.id === 'merge-pdf')).toBe(true);
  });

  it('should filter tools by category', () => {
    service.setCategory('organize');
    const filtered = service.filteredTools();
    expect(filtered.every(t => t.category === 'organize')).toBe(true);
  });

  it('should filter tools by search query', () => {
    service.setCategory('all');
    service.setSearchQuery('merge');
    const filtered = service.filteredTools();
    expect(filtered.some(t => t.name.toLowerCase().includes('merge'))).toBe(true);
  });

  it('should retrieve tool by route', () => {
    const tool = service.getToolByRoute('/merge-pdf');
    expect(tool).toBeDefined();
    expect(tool?.id).toBe('merge-pdf');
  });
});
