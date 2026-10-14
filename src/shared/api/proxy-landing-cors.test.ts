/// <reference types="node" />
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 랜딩(qstory.ai.kr)의 자체 통계가 이 프록시의 beta-events로 들어올 수 있게 그 경로에만 CORS를 연다. */
const corePath = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'api', '_qstory-proxy-core.mjs');

type Proxy = (request: Request) => Promise<Response>;
const loadProxy = async (fetchImpl: (url: URL, init: RequestInit) => Promise<Response>) => {
  const core = (await import(pathToFileURL(corePath).href)) as { createQStoryProxy: (options: object) => Proxy };
  return core.createQStoryProxy({ upstreamUrl: 'https://backend.example', fetchImpl, logger: {} });
};

const ok = async () => new Response('{"ok":true}', { status: 202, headers: { 'content-type': 'application/json' } });

function request(method: string, path: string, origin?: string) {
  return new Request(`https://demo.example/api/qstory-proxy?path=${path}`, {
    method,
    headers: {
      ...(origin ? { origin } : {}),
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    body: method === 'POST' ? '{}' : undefined,
  });
}

test('랜딩 출처의 beta-events 사전 요청(OPTIONS)은 204와 허용 헤더로 답하고 백엔드로 보내지 않는다', async () => {
  let called = false;
  const proxy = await loadProxy(async () => {
    called = true;
    return ok();
  });
  const response = await proxy(request('OPTIONS', 'v1/beta-events', 'https://qstory.ai.kr'));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://qstory.ai.kr');
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /content-type/);
  assert.equal(called, false);
});

test('랜딩 출처의 beta-events POST 응답에 CORS 헤더가 붙고 Origin은 백엔드로 넘기지 않는다', async () => {
  let forwarded: Headers | null = null;
  const proxy = await loadProxy(async (_url, init) => {
    forwarded = new Headers(init.headers);
    return ok();
  });
  const response = await proxy(request('POST', 'v1/beta-events', 'https://qstory.ai.kr'));
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://qstory.ai.kr');
  assert.equal((forwarded as Headers | null)?.get('origin') ?? null, null);
});

test('다른 출처·다른 경로에는 CORS를 열지 않는다', async () => {
  const proxy = await loadProxy(ok);
  const foreign = await proxy(request('OPTIONS', 'v1/beta-events', 'https://evil.example'));
  assert.equal(foreign.status, 404);
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  const otherPath = await proxy(request('OPTIONS', 'v1/companion-chat/messages', 'https://qstory.ai.kr'));
  assert.equal(otherPath.status, 404);
  const otherPost = await proxy(request('POST', 'v1/companion-chat/messages', 'https://qstory.ai.kr'));
  assert.equal(otherPost.headers.get('access-control-allow-origin'), null);
});
