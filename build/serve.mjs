#!/usr/bin/env node
// Local dev server: static files + POST /api/rebuild, which runs the
// dossier build so the admin's "Rebuild site" button works during data
// entry. Zero dependencies; binds to localhost only. Production (cPanel)
// serves the same tree as plain static files — no rebuild endpoint there;
// rebuilding stays a local/deploy-time step.
//
//   node build/serve.mjs      (or via .claude/launch.json)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { extname, join, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8084;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.md':   'text/plain; charset=utf-8',
};

function rebuild(all) {
  const args = [join(root, 'build', 'build-dossiers.mjs'), ...(all ? ['--all'] : [])];
  return new Promise((resolvePromise) => {
    execFile('node', args, { cwd: root },
      (error, stdout, stderr) => {
        // build prints "N written, M unchanged (T pages)."
        const m = stdout.match(/(\d+) written, (\d+) unchanged \((\d+) pages\)/);
        resolvePromise(error
          ? { ok: false, error: (stderr || error.message).trim() }
          : { ok: true, changed: m ? +m[1] : 0, total: m ? +m[3] : 0, output: stdout.trim() });
      });
  });
}

createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && reqUrl.pathname === '/api/rebuild') {
    const result = await rebuild(reqUrl.searchParams.get('all') === '1');
    res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  let urlPath = decodeURIComponent(reqUrl.pathname);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = resolve(join(root, urlPath));
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      // Dev server: never let the browser cache. Editing admin.js / styles.css
      // and reloading must always show the latest (production on cPanel can
      // cache as normal — this header is local-only).
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${root} on http://localhost:${PORT} (POST /api/rebuild to rebuild)`);
});
