/* global self, caches, fetch, Request, URL */
// 큐스토리 서비스 워커. 홈 화면 설치 조건을 채우고, 네트워크가 끊겼을 때 앱 틀(index.html + 화면 조각)을 다시 띄운다.
// 빌드 도구를 거치지 않는 파일이라 public/에 그대로 둔다. 캐시 규칙을 바꾸면 CACHE_VERSION을 올린다.
//
// 규칙
// - /api/ 와 다른 출처(Supabase 삽화·음성, 로그인 SDK)는 건드리지 않는다. 브라우저가 평소대로 처리한다.
// - 화면 이동(navigate)은 네트워크 먼저. 성공하면 index.html을 캐시에 덮어쓰고, 실패하면 캐시된 index.html을 준다.
//   배포 직후에도 항상 새 index.html을 받으므로 예전 화면 조각을 가리키는 일이 없다(stale-chunk-reload와 겹치지 않는다).
// - /assets/ 는 파일 이름에 해시가 있어 내용이 바뀌지 않는다. 캐시 먼저.
// - 그 밖의 같은 출처 GET(브랜드 이미지, manifest)은 네트워크 먼저, 실패하면 캐시.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `qstory-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `qstory-assets-${CACHE_VERSION}`;
const SHELL_URL = '/index.html';
const ASSET_CACHE_LIMIT = 200;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('qstory-') && name !== SHELL_CACHE && name !== ASSET_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Vercel은 없는 경로에도 index.html을 200으로 준다. 사라진 화면 조각 자리에 HTML이 캐시되지 않게 거른다.
function isCacheable(response, { allowHtml }) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  if (allowHtml) return true;
  return !(response.headers.get('content-type') ?? '').includes('text/html');
}

async function trimAssetCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - ASSET_CACHE_LIMIT;
  // 먼저 넣은 것부터 지운다. 배포가 쌓이면 예전 해시 파일이 여기서 빠진다.
  for (let index = 0; index < overflow; index += 1) await cache.delete(keys[index]);
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response, { allowHtml: true })) await cache.put(SHELL_URL, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    throw error;
  }
}

async function handleHashedAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response, { allowHtml: false })) {
    await cache.put(request, response.clone());
    await trimAssetCache(cache);
  }
  return response;
}

async function handleStaticFile(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response, { allowHtml: false })) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleHashedAsset(request));
    return;
  }
  event.respondWith(handleStaticFile(request));
});
