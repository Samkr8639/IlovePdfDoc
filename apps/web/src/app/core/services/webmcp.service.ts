import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToolRegistryService } from './tool-registry.service';
import { ToolDefinition } from '@paperflow/contracts';

export interface WebMcpToolSchema {
  $schema: string;
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: boolean;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: WebMcpToolSchema;
  actionUrl: string;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebMcpService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toolRegistry = inject(ToolRegistryService);

  private readonly registeredTools = new Map<string, WebMcpTool>();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initWebMcp();
    }
  }

  /**
   * Initializes WebMCP tool registry from ToolRegistryService
   */
  initWebMcp(): void {
    // 1. Register global search tool (available across header & home)
    this.registeredTools.set('search_pdf_tools', {
      name: 'search_pdf_tools',
      description: 'Search and filter through all available PDF Tailor tools and utilities',
      inputSchema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keyword to filter PDF tools (e.g., merge, split, compress, word)'
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      actionUrl: '/',
      category: 'search'
    });

    // 2. Register all live tools
    const tools = this.toolRegistry.getAllTools();
    const liveTools = tools.filter(t => t.status === 'available');

    for (const tool of liveTools) {
      this.registerToolFromDefinition(tool);
    }

    this.syncToBrowserContext();
    this.injectWebMcpScriptTag();
  }

  /**
   * Generates a strictly valid Draft-7 JSON schema for a tool definition
   */
  createToolSchema(tool: ToolDefinition): WebMcpToolSchema {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: `Input files for ${tool.name}. Accepted extensions: ${tool.acceptedFileTypes.join(', ')}`,
          items: {
            type: 'string',
            description: 'Binary file data or reference for processing'
          },
          minItems: 1,
          maxItems: tool.maxFiles
        }
      },
      required: ['files'],
      additionalProperties: false
    };
  }

  /**
   * Registers a single tool into WebMCP
   */
  registerToolFromDefinition(tool: ToolDefinition): void {
    const toolName = tool.id.replace(/-/g, '_');
    const mcpTool: WebMcpTool = {
      name: toolName,
      description: tool.shortDescription,
      inputSchema: this.createToolSchema(tool),
      actionUrl: tool.route,
      category: tool.category
    };

    this.registeredTools.set(toolName, mcpTool);
  }

  /**
   * Exposes registered tools to navigator.modelContext and window.__WEBMCP_TOOLS__
   */
  private syncToBrowserContext(): void {
    if (typeof window === 'undefined') return;

    const toolList = Array.from(this.registeredTools.values());

    // Expose on global window for crawlers and auditor inspection
    (window as unknown as { __WEBMCP_TOOLS__: WebMcpTool[] }).__WEBMCP_TOOLS__ = toolList;

    // Support navigator.modelContext / window.modelContext standard
    const win = window as unknown as {
      modelContext?: {
        registerTool: (tool: { name: string; description: string; inputSchema: unknown }) => void;
        getRegisteredTools?: () => WebMcpTool[];
      };
    };

    const nav = (typeof navigator !== 'undefined' ? navigator : {}) as unknown as {
      modelContext?: {
        registerTool: (tool: { name: string; description: string; inputSchema: unknown }) => void;
        getRegisteredTools?: () => WebMcpTool[];
      };
    };

    const targetContext = win.modelContext || nav.modelContext;

    if (targetContext && typeof targetContext.registerTool === 'function') {
      try {
        for (const tool of toolList) {
          targetContext.registerTool({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          });
        }
      } catch (err) {
        console.warn('[WebMCP] Failed to register tools on native modelContext:', err);
      }
    } else {
      // Provide standard mock/polyfill interface for browser extensions
      const polyfillContext = {
        registerTool: (tool: { name: string; description: string; inputSchema: unknown }) => {
          this.registeredTools.set(tool.name, tool as WebMcpTool);
        },
        getRegisteredTools: () => Array.from(this.registeredTools.values())
      };

      if (!win.modelContext) {
        win.modelContext = polyfillContext;
      }
    }
  }

  /**
   * Injects declarative JSON-LD/WebMCP script tag in document.head
   */
  private injectWebMcpScriptTag(): void {
    if (typeof document === 'undefined') return;

    const existingTag = document.getElementById('webmcp-tools-manifest');
    if (existingTag) {
      existingTag.remove();
    }

    const scriptTag = document.createElement('script');
    scriptTag.id = 'webmcp-tools-manifest';
    scriptTag.type = 'application/webmcp+json';
    scriptTag.textContent = JSON.stringify({
      version: '1.0',
      tools: Array.from(this.registeredTools.values())
    }, null, 2);

    document.head.appendChild(scriptTag);
  }

  getRegisteredTools(): WebMcpTool[] {
    return Array.from(this.registeredTools.values());
  }
}
