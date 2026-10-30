import { TestBed } from '@angular/core/testing';
import { WebMcpService } from './webmcp.service';
import { ToolRegistryService } from './tool-registry.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('WebMcpService', () => {
  let service: WebMcpService;
  let toolRegistry: ToolRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WebMcpService,
        ToolRegistryService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    toolRegistry = TestBed.inject(ToolRegistryService);
    service = TestBed.inject(WebMcpService);
  });

  it('should be created and initialize tools', () => {
    expect(service).toBeTruthy();
    const registered = service.getRegisteredTools();
    expect(registered.length).toBeGreaterThan(0);
  });

  it('should register available tools with valid Draft-7 JSON schemas', () => {
    const registered = service.getRegisteredTools();
    for (const tool of registered) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toContain('files');
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.inputSchema.properties).toBeDefined();
      expect(tool.inputSchema.properties['files']).toBeDefined();
    }
  });

  it('should expose registered tools on window.__WEBMCP_TOOLS__', () => {
    const win = window as unknown as { __WEBMCP_TOOLS__: unknown[] };
    expect(win.__WEBMCP_TOOLS__).toBeDefined();
    expect(Array.isArray(win.__WEBMCP_TOOLS__)).toBe(true);
    expect(win.__WEBMCP_TOOLS__.length).toBeGreaterThan(0);
  });

  it('should inject application/webmcp+json script element in document.head', () => {
    const script = document.getElementById('webmcp-tools-manifest') as HTMLScriptElement;
    expect(script).toBeTruthy();
    expect(script.type).toBe('application/webmcp+json');

    const parsed = JSON.parse(script.textContent || '{}');
    expect(parsed.version).toBe('1.0');
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(parsed.tools.length).toBeGreaterThan(0);
  });
});
