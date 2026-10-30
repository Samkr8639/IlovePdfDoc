const fs = require('fs');
const path = require('path');

// Ensure contracts are built
const { TOOL_REGISTRY, LIVE_TOOL_IDS } = require('../packages/contracts/dist/tools.js');

const BASE_URL = 'https://pdftailor.com';
const liveSet = new Set(LIVE_TOOL_IDS || []);

// Filter only currently live / available tools
const availableTools = TOOL_REGISTRY.filter(tool => liveSet.has(tool.id) || tool.status === 'available');

console.log(`[AI Manifests] Found ${availableTools.length} available tools to index:`, availableTools.map(t => t.id).join(', '));

// Output directories
const webPublicDir = path.resolve(__dirname, '../apps/web/public');
const wellKnownDir = path.join(webPublicDir, '.well-known');

if (!fs.existsSync(webPublicDir)) {
  fs.mkdirSync(webPublicDir, { recursive: true });
}
if (!fs.existsSync(wellKnownDir)) {
  fs.mkdirSync(wellKnownDir, { recursive: true });
}

// 1. Generate llms.txt (Standard format: H1, blockquote, markdown links, privacy details)
const llmsContent = `# PDFTailor - Online PDF Converter & Document Tools

> Fast, private, and secure online PDF toolkit. PDFTailor runs core operations directly inside the user's browser using WebAssembly and processes conversions in volatile ephemeral memory with zero server file retention.

## Available Tools

${availableTools.map(tool => `- [${tool.name}](${BASE_URL}${tool.route}): ${tool.shortDescription}`).join('\n')}

## Privacy & Security Architecture

- **Client-Side Execution**: Browser-native tools (Merge, Split, Compress) execute 100% locally on the client machine via WebAssembly. User files are never uploaded to any remote server.
- **Ephemeral Server-Assisted Conversions**: Server-assisted tools (Word to PDF, PDF to Office formats) stream documents over TLS into volatile isolated containers and permanently purge all temporary artifacts immediately upon conversion completion.
- **Zero Document Retention**: PDFTailor retains zero user documents, logs no sensitive document text, and enforces strict zero-retention policies.

## Machine-Readable Resources

- [AI Resource Catalog (ARD Manifest)](${BASE_URL}/.well-known/ai-catalog.json): Structured JSON listing for autonomous AI agents.
- [Full LLM Documentation](${BASE_URL}/llms-full.txt): Comprehensive parameter schemas and format constraints.
`;

fs.writeFileSync(path.join(webPublicDir, 'llms.txt'), llmsContent.trim() + '\n', 'utf8');
console.log('✓ Generated apps/web/public/llms.txt');

// 2. Generate llms-full.txt (Detailed with input constraints and accepted file types)
const llmsFullContent = `# PDFTailor - Comprehensive Tool Documentation for LLMs

> Complete technical specifications, accepted file types, and execution modes for PDFTailor tools.

## Available Tools Specification

${availableTools.map(tool => `### ${tool.name}
- **URL**: ${BASE_URL}${tool.route}
- **Identifier**: urn:air:pdftailor:tools:${tool.id}
- **Category**: ${tool.category}
- **Processing Mode**: ${tool.processingMode === 'browser' ? '100% Client-Side (Browser WebAssembly)' : 'Ephemeral Secure Server Conversion'}
- **Accepted File Types**: ${tool.acceptedFileTypes.join(', ')}
- **Max Files Allowed**: ${tool.maxFiles}
- **Max File Size**: ${(tool.maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB
- **Description**: ${tool.longDescription || tool.shortDescription}
`).join('\n')}

## Security & Verification
All PDFTailor tools support programmatic browser automation and WebMCP form interaction. Documents processed client-side remain in sandbox RAM. Server conversions are subject to strict per-request execution limits and instantaneous memory purges.
`;

fs.writeFileSync(path.join(webPublicDir, 'llms-full.txt'), llmsFullContent.trim() + '\n', 'utf8');
console.log('✓ Generated apps/web/public/llms-full.txt');

// 3. Generate ai-catalog.json strictly conforming to ARD (Agent Resource Discovery) 1.0 Specification
const queriesMap = {
  'merge-pdf': ['merge pdf files', 'combine multiple pdf documents into one', 'join pdf pages together', 'reorder and combine pdf'],
  'split-pdf': ['split pdf into pages', 'extract pages from pdf', 'separate pdf pages', 'cut pdf document'],
  'compress-pdf': ['compress pdf file', 'reduce pdf size online', 'shrink pdf document without losing quality', 'make pdf file smaller'],
  'pdf-to-word': ['convert pdf to word', 'pdf to docx editable', 'turn pdf document into editable word document', 'export pdf as word'],
  'pdf-to-powerpoint': ['convert pdf to powerpoint', 'pdf to pptx presentation', 'turn pdf slides into powerpoint deck', 'export pdf as ppt'],
  'pdf-to-excel': ['convert pdf to excel', 'extract tables from pdf into xlsx', 'pdf spreadsheet data to excel', 'turn pdf into excel sheet'],
  'word-to-pdf': ['convert word to pdf', 'convert docx to pdf online', 'convert doc document to pdf', 'word document into pdf']
};

const defaultQueries = (tool) => [
  `${tool.name.toLowerCase()} online`,
  `how to ${tool.name.toLowerCase()}`,
  `free ${tool.name.toLowerCase()} tool`
];

const catalog = {
  specVersion: '1.0',
  host: {
    displayName: 'PDFTailor',
    identifier: 'did:web:pdftailor.com'
  },
  entries: availableTools.map(tool => ({
    identifier: `urn:air:pdftailor:tools:${tool.id}`,
    displayName: tool.name,
    type: 'application/mcp-server-card+json',
    description: tool.shortDescription,
    url: `${BASE_URL}${tool.route}`,
    representativeQueries: queriesMap[tool.id] || defaultQueries(tool),
    tags: ['pdf', tool.category, ...tool.id.split('-')]
  }))
};

const catalogJson = JSON.stringify(catalog, null, 2) + '\n';
fs.writeFileSync(path.join(wellKnownDir, 'ai-catalog.json'), catalogJson, 'utf8');
fs.writeFileSync(path.join(webPublicDir, 'ai-catalog.json'), catalogJson, 'utf8');
console.log('✓ Generated apps/web/public/.well-known/ai-catalog.json and public/ai-catalog.json');
