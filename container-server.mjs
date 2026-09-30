import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

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
const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);
// dist/ never changes while the container runs, so each file is read (and compressed) once.
const staticFileCache = new Map();

/** Mirrors vercel.json's rewrite ("/api/qstory/:path*" -> "/api/qstory-proxy?path=:path*") so the
 * shared proxy core sees the exact same request shape on both hosting targets. */
function toQStoryProxyWebRequest(req, signal) {
  // req.url can carry its own query string (e.g. "v1/tutor-lessons?status=SCHEDULED"): split it off
  // so "path" holds only the route and the caller's params stay separate query params.
  const rest = req.url.slice('/api/qstory/'.length);
  const [restPath, restQuery = ''] = rest.split('?');
  const proxyUrl = new URL(`http://${req.headers.host ?? 'localhost'}/api/qstory-proxy`);
  proxyUrl.searchParams.set('path', restPath);
  for (const [key, value] of new URLSearchParams(restQuery)) {
    proxyUrl.searchParams.append(key, value);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(proxyUrl, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
    signal,
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
  await pipeline(Readable.fromWeb(webResponse.body), res);
}

async function loadStaticFile(filePath) {
  let entry = staticFileCache.get(filePath);
  if (!entry) {
    const body = await readFile(filePath);
    const compressible = COMPRESSIBLE_EXTENSIONS.has(extname(filePath));
    entry = {
      body,
      // Quality 11 (the default) takes seconds on a large bundle and blocks the event loop.
      br: compressible
        ? brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 6 } })
        : null,
      gzip: compressible ? gzipSync(body) : null,
    };
    staticFileCache.set(filePath, entry);
  }
  return entry;
}

function pickEncoding(req, entry) {
  const accepted = req.headers['accept-encoding'] ?? '';
  if (entry.br && /\bbr\b/.test(accepted)) return 'br';
  if (entry.gzip && /\bgzip\b/.test(accepted)) return 'gzip';
  return null;
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
    const entry = await loadStaticFile(filePath);
    const isIndex = filePath === join(DIST_DIR, 'index.html');
    // Only Vite's content-hashed output under /assets/ is immutable (same rule as vercel.json);
    // public/ files (brand logo, robots.txt) keep their names across deploys and must revalidate.
    const isHashedAsset = filePath.startsWith(join(DIST_DIR, 'assets') + sep);
    const encoding = pickEncoding(req, entry);
    const headers = {
      'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': isIndex
        ? 'no-store'
        : isHashedAsset
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
    };
    if (entry.gzip) headers.vary = 'accept-encoding';
    if (encoding) headers['content-encoding'] = encoding;
    res.writeHead(200, headers);
    res.end(encoding ? entry[encoding] : entry.body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

async function handleRequest(req, res) {
  if (req.url?.startsWith('/api/qstory/')) {
    // Cancel the upstream call when the browser goes away (Vercel does this via supportsCancellation).
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    const webResponse = await proxyQStoryRequest(toQStoryProxyWebRequest(req, abort.signal));
    await sendWebResponse(res, webResponse);
    return;
  }
  await serveStatic(req, res);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    // The browser went away mid-request/response - nothing to report or answer.
    if (error?.name === 'AbortError' || error?.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
    console.error('[container-server] request failed', error);
    if (!res.headersSent) {
      res.writeHead(500).end('Internal server error');
    }
  });
});

server.listen(PORT, () => {
  console.log(`q-story-web listening on :${PORT}`);
});
