# PaperFlow 📄⚡

> **A modern, privacy-first online PDF toolkit with a hybrid processing architecture.**  
> Merge, split, rotate, and convert PDF documents with 100% in-browser processing, zero server uploads for core tools, and ₹0 initial cost.

---

## 🌟 Highlights & Key Features

- **🔒 100% In-Browser Privacy**: Core tools (Merge, Split, Rotate, JPG to PDF) process documents directly inside your browser memory using WebAssembly & `pdf-lib`. Your files never leave your device.
- **⚡ Zero Network Lag**: Instant execution with no upload or download buffering for client-side operations.
- **💎 High-Credibility SaaS UX**: Polished, responsive design system built with Angular 22, modern signals, custom dropzones, visual file reordering, and micro-interactions.
- **🔍 SEO & Discoverability**: Dedicated, search-optimized landing pages with structured data, FAQ schemas, canonical links, and OpenGraph metadata.
- **🛡️ Robust Security Standards**: Strict TypeScript across all packages, input validation via Zod, Helmet security headers, CORS protection, and safe temporary file lifecycle handling.
- **💰 100% Free Tier (₹0)**: Zero paid dependencies, zero API keys required, and deployable on Cloudflare Pages + Render free tiers.

---

## 🏗️ Architecture & Monorepo Structure

```text
d:\PDF-Tool/
├── apps/
│   ├── web/                    # Angular 22 Frontend Application
│   │   ├── src/app/core/       # PDF Engine (pdf-lib), Tool Registry, SEO Service
│   │   ├── src/app/shared/     # Dropzone, Reorderable FileList, Progress, Result
│   │   └── src/app/pages/      # Home, Merge PDF, and Tool Landing Pages
│   └── api/                    # Node.js + TypeScript + Express Backend
│       ├── src/routes/         # /api/v1/health and conversion routes
│       ├── src/middleware/     # Error handler, Helmet, CORS, Validation
│       └── tests/              # Jest automated integration tests
├── packages/
│   └── contracts/              # Shared Tool Registry, Models, and API Envelopes
├── docs/
│   ├── ARCHITECTURE.md         # Full system architecture specification
│   ├── AGENT-OWNERSHIP.md      # Multi-agent roles and boundary map
│   ├── API-CONTRACT.md         # API response and tool definition schemas
│   ├── IMPLEMENTATION-PLAN.md  # Phased delivery roadmap and checklist
│   ├── UI-RESEARCH.md          # UI/UX benchmark analysis and design tokens
│   ├── SECURITY.md             # Security audit and threat controls
│   ├── PRIVACY.md              # Privacy guarantees and data retention
│   └── DEPLOYMENT.md           # Free-tier hosting and deployment guide
├── .env.example                # Safe environment variable template
├── package.json                # Monorepo workspaces configuration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ LTS
- [npm](https://www.npmjs.com/) v10+

### Installation & Launch

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <repo-url>
   cd PDF-Tool
   npm install
   ```

2. **Build shared contracts:**
   ```bash
   npm run build:contracts
   ```

3. **Start the API Server (Port 4000):**
   ```bash
   npm run dev:api
   ```
   *Health check verified at:* `http://localhost:4000/api/v1/health`

4. **Start the Angular Web Application (Port 4200):**
   ```bash
   npm run dev:web
   ```
   *Open in browser:* `http://localhost:4200`

---

## 🧪 Automated Testing

Run the automated test suites across the monorepo:

```bash
# Run all tests across workspaces
npm run test

# Run frontend unit & PDF manipulation tests (11 tests)
npm --workspace=apps/web run test -- --watch=false

# Run backend API health & validation tests (2 tests)
npm --workspace=apps/api run test
```

---

## 📜 Tool Catalogue & Implementation Status

| Tool | Route | Engine | Status | Privacy Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **Merge PDF** | `/merge-pdf` | Browser (`pdf-lib`) | ✅ **Active & Verified** | 100% In-Browser RAM |
| **Split PDF** | `/split-pdf` | Browser (`pdf-lib`) | 🗓️ Phase 2 Scheduled | 100% Client-side |
| **Rotate PDF** | `/rotate-pdf` | Browser (`pdf-lib`) | 🗓️ Phase 2 Scheduled | 100% Client-side |
| **JPG to PDF** | `/images-to-pdf` | Browser (`pdf-lib`) | 🗓️ Phase 2 Scheduled | 100% Client-side |
| **Compress PDF** | `/compress-pdf` | Hybrid / Worker | 🗓️ Phase 2 Scheduled | Ephemeral server worker |
| **Protect PDF** | `/protect-pdf` | Browser (`pdf-lib`) | 🗓️ Phase 2 Scheduled | 100% Client-side |

---

## 📄 License
MIT License. Free for personal and commercial open-source use.
