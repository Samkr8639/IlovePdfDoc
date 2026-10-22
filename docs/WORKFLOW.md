# PaperFlow Multi-Environment Development & Git Workflow

## 1. Environments Overview

PaperFlow is configured with three distinct environments: **Development**, **Staging**, and **Production**.

| Environment | Branch | Web Config (`apps/web`) | API Config (`apps/api`) | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | `dev` | `src/environments/environment.ts` | `.env.development` | Local development, unit testing, feature builds |
| **Staging** | `staging` | `src/environments/environment.staging.ts` | `.env.staging` | Pre-production testing, QA validation, staging builds |
| **Production** | `main` | `src/environments/environment.prod.ts` | `.env.production` | Live production release, optimized bundles, public traffic |

---

## 2. Environment Variables & Endpoints

### Frontend (`apps/web`)
- **Development**: `http://localhost:4000/api/v1` (Debug mode ON, Analytics OFF)
- **Staging**: `https://staging-api.paperflow.app/api/v1` (Staging build, Analytics ON)
- **Production**: `https://api.paperflow.app/api/v1` (Production build, full optimizations)

### Backend API (`apps/api`)
- **Development**: Port `4000`, `NODE_ENV=development`, CORS: `http://localhost:4200`
- **Staging**: Port `4000`, `NODE_ENV=staging`, CORS: `https://staging.paperflow.app`
- **Production**: Port `4000`, `NODE_ENV=production`, CORS: `https://paperflow.app`

---

## 3. NPM Environment Commands

Run and build targeting specific environments:

### Development:
```bash
# Start backend in development mode
npm run dev:api

# Start frontend in development mode
npm run dev:web

# Build frontend with development configuration
npm run build:web:dev
```

### Staging:
```bash
# Start backend in staging mode
npm run dev:api:staging

# Start frontend in staging mode
npm run dev:web:staging

# Build entire project for staging
npm run build:staging
```

### Production:
```bash
# Start backend in production mode
npm run dev:api:prod

# Build entire project for production
npm run build:prod
```

---

## 4. Git Branching Model

1. **Daily Development**:
   - Check out `dev`: `git checkout dev`
   - Implement features and test locally.
2. **Promoting to Staging**:
   - Merge `dev` into `staging`:
     ```bash
     git checkout staging
     git merge dev
     git push origin staging
     ```
   - Validate automated test suites and staging deployment.
3. **Releasing to Production**:
   - Merge `staging` into `main`:
     ```bash
     git checkout main
     git merge staging
     git push origin main
     ```
