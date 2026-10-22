# Module and Agent Ownership Map

This document establishes strict ownership boundaries for each specialized agent role to prevent merge collisions, duplicate code, and broken contracts.

---

## 1. Agent Roles & File Ownership Matrix

| Agent | Role Scope | Owned Directories & Files | Modifiable Shared Files (Read/Coordinate) |
| :--- | :--- | :--- | :--- |
| **Agent 1: Lead Orchestrator** | Architecture, Contracts, Integration | `docs/*`, root `package.json`, root `tsconfig.json` | All files during final integration review |
| **Agent 2: Design System & UI/UX** | Design tokens, Typography, CSS System | `apps/web/src/styles/*`, `apps/web/src/assets/*` | `apps/web/src/index.html` |
| **Agent 3: Angular Frontend & SEO** | App Shell, Pages, Tool Workspaces, SEO | `apps/web/src/app/pages/*`, `apps/web/src/app/shared/*`, `apps/web/src/app/core/*` | `packages/contracts/src/*` (Read-only) |
| **Agent 4: Browser PDF Engine** | `pdf-lib` / `pdfjs-dist` browser operations | `apps/web/src/app/core/pdf/browser/*` | `packages/contracts/src/tools.ts` |
| **Agent 5: Node.js API Lead** | Express API, Middleware, Validation | `apps/api/src/*`, `apps/api/tests/*` | `packages/contracts/src/api.ts` |
| **Agent 6: Server PDF Processing**| Server-side conversion worker/services | `apps/api/src/services/pdf-server/*` | `apps/api/src/routes/*` |
| **Agent 7: Security & Privacy** | Validation rules, CORS, Privacy policies | `docs/SECURITY.md`, `docs/PRIVACY.md`, security middleware | `apps/api/src/middleware/security.ts` |
| **Agent 8: SEO & Performance** | Metadata, Sitemap, Canonical, Robots | `apps/web/src/sitemap.xml`, `apps/web/src/robots.txt`, `docs/SEO.md` | `apps/web/src/app/core/services/seo.service.ts` |
| **Agent 9: QA & Automated Testing**| Test suites, fixtures, test runner configs| `tests/*`, `apps/*/src/**/*.spec.ts` | Test configuration files |
| **Agent 10: Docs & Deployment** | Setup guides, deployment configs | `README.md`, `.env.example`, `docs/DEPLOYMENT.md` | Root configs |

---

## 2. Invariant Rules of Engagement

1. **Shared Contracts First**: All interface models (Tool IDs, API response schemas, error codes) reside in `packages/contracts/`. Neither frontend nor backend may invent ad-hoc JSON structures.
2. **Strict TypeScript Mode**: Both `apps/web` and `apps/api` must compile with `"strict": true`. No `any` escapes for core interfaces.
3. **No Overwrites Without Review**: An agent cannot alter another agent's owned directory without coordinating through Agent 1.
4. **Execution Proof**: Every completed module must output a standardized completion report detailing files changed, commands run, and automated test results.
