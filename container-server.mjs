import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';

import { createQStoryProxy } from './api/_qstory-proxy-core.mjs';

// Standalone Docker entry point: serves the Vite static build and the same /api/qstory/* proxy
// logic Vercel runs (api/_qstory-proxy-core.mjs, unmodified) - so behavior stays identical
// between the two hosting targets instead of drifting into a second implementation.

const PORT = Number(process.env.PORT ?? 8080);
const DIST_DIR = join(import.meta.dirname, 'dist');
const proxyQStoryRequest = createQStoryProxy();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Mirrors vercel.json's rewrite ("/api/qstory/:path*" -> "/api/qstory-proxy?path=:path*") so the
 * shared proxy core sees the exact same request shape on both hosting targets. */
function toQStoryProxyWebRequest(req) {
  const rest = req.url.slice('/api/qstory/'.length);
  const url = `http://${req.headers.host ?? 'localhost'}/api/qstory-proxy?path=${rest}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

async function sendWebResponse(res, webResponse) {
  const headers = {};
  webResponse.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(webResponse.status, headers);
  if (!webResponse.body) {
    res.end();
    return;
  }
  Readable.fromWeb(webResponse.body).pipe(res);
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.includes('..')) {
    res.writeHead(400).end('Bad request');
    return;
  }
  let filePath = normalize(join(DIST_DIR, pathname));
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(400).end('Bad request');
    return;
  }
  try {
    if ((await stat(filePath)).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
  } catch {
    filePath = join(DIST_DIR, 'index.html'); // single-page app: unknown paths render the app shell
  }
  try {
    const body = await readFile(filePath);
    const isIndex = filePath === join(DIST_DIR, 'index.html');
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': isIndex ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

async function handleRequest(req, res) {
  if (req.url?.startsWith('/api/qstory/')) {
    const webResponse = await proxyQStoryRequest(toQStoryProxyWebRequest(req));
    await sendWebResponse(res, webResponse);
    return;
  }
  await serveStatic(req, res);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('[container-server] request failed', error);
    if (!res.headersSent) {
      res.writeHead(500).end('Internal server error');
    }
  });
});

server.listen(PORT, () => {
  console.log(`q-story-web listening on :${PORT}`);
});
