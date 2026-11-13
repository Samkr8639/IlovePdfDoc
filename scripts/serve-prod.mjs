import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '4200', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve(__dirname, '../apps/web/dist/web/browser');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  // Proxy /api requests to backend API server at port 4000
  if (req.url && req.url.startsWith('/api')) {
    const headers = { ...req.headers };
    headers['x-forwarded-host'] = req.headers['host'] || 'localhost';
    headers['host'] = '127.0.0.1:4000';

    const proxyReq = http.request(
      {
        host: '127.0.0.1',
        port: 4000,
        path: req.url,
        method: req.method,
        headers
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      console.error('API proxy error:', err.message);
      res.statusCode = 502;
      res.end(JSON.stringify({ success: false, error: 'API backend unreachable at localhost:4000' }));
    });
    req.pipe(proxyReq);
    return;
  }

  // Only handle GET and HEAD for static assets
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, decodeURIComponent(urlPath));

  // Security check: ensure filePath is inside DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Check if requested path is a file
  let isFile = false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      isFile = true;
    } else if (stat.isDirectory()) {
      const indexInDir = path.join(filePath, 'index.html');
      if (fs.existsSync(indexInDir)) {
        filePath = indexInDir;
        isFile = true;
      }
    }
  } catch {
    // Not found
  }

  // SPA fallback: return index.html for navigation routes
  if (!isFile) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const isHashedAsset = /[.-][a-zA-Z0-9_-]{8,}\.(js|css|woff2|png|svg|webp)$/.test(filePath);
  const cacheControl = ext === '.html'
    ? 'no-cache'
    : (isHashedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');

  const acceptEncoding = req.headers['accept-encoding'] || '';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'index, follow');

  // Compress text assets
  const shouldCompress = /text|javascript|json|xml|svg/i.test(contentType);

  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const readStream = fs.createReadStream(filePath);

  readStream.on('error', (err) => {
    res.statusCode = 500;
    res.end('Internal Server Error');
  });

  if (shouldCompress && acceptEncoding.includes('br')) {
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Vary', 'Accept-Encoding');
    res.statusCode = 200;
    const brotli = zlib.createBrotliCompress();
    readStream.pipe(brotli).pipe(res);
  } else if (shouldCompress && acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.statusCode = 200;
    const gzip = zlib.createGzip();
    readStream.pipe(gzip).pipe(res);
  } else {
    res.statusCode = 200;
    readStream.pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Production server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Serving static bundle from: ${DIST_DIR}`);
});

