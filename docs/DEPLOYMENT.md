# PaperFlow Deployment & Free-Tier Hosting Architecture

## 1. Zero-Cost (₹0) Production Deployment Strategy

PaperFlow is architected to operate efficiently within generous, reputable free hosting tiers without requiring credit cards or paid software licenses.

| Component | Target Platform | Free Tier Specifications & Limits |
| :--- | :--- | :--- |
| **Frontend SPA (`apps/web`)** | **Cloudflare Pages** or **Vercel** | • Unlimited requests & bandwidth<br>• Automated Git deployments<br>• Free custom domain & SSL<br>• Edge CDN distribution |
| **Backend API (`apps/api`)** | **Render** or **Fly.io** | • 750 free monthly compute hours<br>• Automatic HTTPS<br>• Free outbound bandwidth |
| **Client-Side Engine** | Browser Execution | • 0 server cost; runs entirely on user CPU/RAM |

---

## 2. Local Development Setup

### Prerequisites
- **Node.js**: v20+ LTS (Tested on Node.js v24.16.0)
- **npm**: v10+ (Tested on npm v11.13.0)

### Quick Start
```bash
# 1. Install all monorepo dependencies and link packages
npm install

# 2. Build shared contracts
npm run build:contracts

# 3. Start Backend API (Port 4000)
npm run dev:api

# 4. In a separate terminal, start Angular Frontend (Port 4200)
npm run dev:web
```

- Web UI: `http://localhost:4200`
- API Health Endpoint: `http://localhost:4000/api/v1/health`

---

## 3. Production Build Commands

```bash
# Compile contracts, API, and Angular frontend
npm run build

# Run test suites across the monorepo
npm run test
```

Build outputs:
- Frontend: `apps/web/dist/web` (ready for static deploy)
- Backend: `apps/api/dist/index.js` (ready for Node.js runtime)
