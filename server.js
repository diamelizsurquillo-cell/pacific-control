/**
 * Local Development Server for Pacific Control Dashboard
 * Serves static assets from public/ and dispatches /api routes to serverless handlers.
 * Watches local Excel files and pushes live updates via Server-Sent Events (SSE).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables from .env.local if exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css':  'text/css; charset=UTF-8',
  '.js':   'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// Map API routes to handler files
const API_ROUTES = {
  '/api/dashboard': require('./api/dashboard'),
  '/api/ordenes': require('./api/ordenes'),
  '/api/gastos': require('./api/gastos'),
};

// ─── SSE: Server-Sent Events for live Excel change notifications ───
const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// ─── Excel File Watcher ───
const EXCEL_FILES = [
  '1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx',
  '4. Rendicion de operativos 2026.xlsx',
];

let _fileChangeDebounce = null;
const cache = require('./lib/cache');

function onExcelFileChanged(fileName) {
  // Debounce: wait 1.5s after last change (Excel writes multiple times on save)
  if (_fileChangeDebounce) clearTimeout(_fileChangeDebounce);
  _fileChangeDebounce = setTimeout(() => {
    console.log(`\n  📄 Cambio detectado en: ${fileName}`);
    console.log(`  🔄 Invalidando caché y notificando al dashboard...`);

    // Invalidate all server caches
    cache.invalidate();

    // Notify all connected browsers via SSE
    broadcastSSE('excel-changed', {
      file: fileName,
      timestamp: new Date().toISOString(),
    });

    console.log(`  ✅ ${sseClients.size} navegador(es) notificado(s)\n`);
  }, 1500);
}

function startFileWatcher() {
  const watchers = [];
  for (const fileName of EXCEL_FILES) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  No encontrado: ${fileName} (se ignorará)`);
      continue;
    }
    try {
      const watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          onExcelFileChanged(fileName);
        }
      });
      watcher.on('error', () => {}); // Ignore watch errors
      watchers.push({ fileName, watcher });
      console.log(`  👀 Vigilando: ${fileName}`);
    } catch (e) {
      console.warn(`  ⚠️  No se pudo vigilar: ${fileName}`);
    }
  }
  return watchers;
}

// ─── HTTP Server ───
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Add CORS & Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ─── SSE Endpoint ───
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Handle API routes
  const apiHandler = API_ROUTES[pathname];
  if (apiHandler) {
    // Add express-like helpers to res and req
    req.query = parsedUrl.query || {};
    res.status = function(code) {
      res.statusCode = code;
      return res;
    };
    res.json = function(data) {
      res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      res.end(JSON.stringify(data));
      return res;
    };

    try {
      await apiHandler(req, res);
    } catch (err) {
      console.error('Handler error:', err);
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error', message: err.message }));
      }
    }
    return;
  }

  // Handle Static files from public/
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Fallback to index.html for SPA if not found
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// ─── Google Sheets Live Poller ───
const { clearWorkbookCache } = require('./lib/google-sheets');

function startGoogleSheetsPoller() {
  const sheetId = process.env.SHEET_ID_ORDENES;
  if (!sheetId || sheetId === 'local' || sheetId.includes('your_')) return;

  console.log(`  ☁️  Vigilancia en la nube activa para Google Sheet: ${sheetId}`);
  // Poll every 20 seconds if clients are connected
  setInterval(() => {
    if (sseClients.size > 0) {
      clearWorkbookCache();
      cache.invalidate();
      broadcastSSE('excel-changed', {
        file: 'Google Sheet (Nube)',
        timestamp: new Date().toISOString(),
      });
    }
  }, 20000);
}

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 PACIFIC CONTROL DASHBOARD ACTIVO`);
  console.log(`  🔗 URL Local: http://localhost:${PORT}`);
  console.log(`  📡 API Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`  📡 SSE Events:    http://localhost:${PORT}/api/events`);
  console.log(`======================================================\n`);

  // Start watching Excel files & Google Sheets for changes
  console.log(`  📂 Iniciando vigilancia de fuentes de datos...\n`);
  startFileWatcher();
  startGoogleSheetsPoller();
  console.log(`\n  💡 Los datos en Google Sheets y Excel local se sincronizan automáticamente en vivo.\n`);
});

