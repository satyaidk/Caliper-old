import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Serves dist/ the way Vercel will: same headers, same rewrites for the app at
 * /app/, read straight out of vercel.json so the test cannot drift from the
 * real config.
 *
 *   node prodserver.mjs <repoRoot> <port>
 */

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 5300);
const dist = path.join(root, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
};

/** Vercel's `source` patterns are path-to-regexp; these are plain regex-ish. */
const matches = (source, url) => new RegExp(`^${source}$`).test(url);

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(dist, url);

  // Filesystem first, then the rewrites — the order Vercel uses.
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const rewrite = config.rewrites?.find((r) => matches(r.source, url));
    file = path.join(dist, rewrite ? rewrite.destination : 'index.html');
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }

  for (const rule of config.headers ?? []) {
    if (!matches(rule.source, url)) continue;
    for (const { key, value } of rule.headers) res.setHeader(key, value);
  }

  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  res.writeHead(200).end(fs.readFileSync(file));
});

server.listen(port, '127.0.0.1', () => console.log(`production-alike server on http://localhost:${port}`));
