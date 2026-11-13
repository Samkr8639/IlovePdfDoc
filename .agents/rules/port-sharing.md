# Port Sharing & Tunneling Rules

Whenever the user asks to share a port, create a public tunnel (e.g. via Cloudflare, ngrok, localtunnel), or share the application with anyone:

1. **Full-Stack Sharing (Never Tunnel Frontend Alone)**:
   - NEVER expose only the frontend without the backend API. All PDF conversion, compression, signing, and OCR operations require the backend API on port 4000.
   - ALWAYS ensure the Express backend API on port 4000 is running and healthy (`GET http://127.0.0.1:4000/api/v1/health` returns 200).
   - ALWAYS ensure the server on port 4200 (`scripts/serve-prod.mjs` or Angular dev server with `proxy.conf.json`) actively reverse-proxies `/api/*` to `http://127.0.0.1:4000` with proper host rewriting (`Host: 127.0.0.1:4000`, `X-Forwarded-Host: <tunnel-host>`).
   - When launching the tunnel, point it to `http://localhost:4200` (which multiplexes both frontend and backend API via `/api/`).
   - If using `cloudflared`, pass `--url http://localhost:4200 --http-host-header localhost:4200`.

2. **Mandatory Post-Tunnel Verification Checklist**:
   After establishing or restarting any tunnel, ALWAYS verify:
   - Frontend homepage: `GET <tunnel-url>/` returns HTTP 200 with HTML content.
   - API health through the tunnel: `GET <tunnel-url>/api/v1/health` returns HTTP 200 with `libreOfficeAvailable: true`.
   - Tool endpoint check: `POST <tunnel-url>/api/v1/word-to-pdf/convert` (empty payload) returns HTTP 400 with backend JSON error (proving the route reaches the Express backend and does not return 404 or time out).

3. **Relative URL Enforcement**:
   - Never hardcode `http://localhost:4000` or external staging/mock domains in client-side code or environment configs.
   - All client-side API requests must use the relative path `apiBaseUrl: '/api/v1'`.
