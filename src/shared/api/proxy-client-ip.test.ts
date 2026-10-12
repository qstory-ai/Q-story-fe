/// <reference types="node" />
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 보안 점검 M1/M2 - 프록시가 원래 클라이언트 주소를 서명해 백엔드에 넘긴다(백엔드 요청 상한이 주소별로 센다).
 * 서명 형식은 be ratelimit/ClientIpResolver.sign과 같아야 한다 - 같은 입력의 기대값을 양쪽 테스트가 함께 확인한다.
 */
const corePath = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'api', '_qstory-proxy-core.mjs');

type Proxy = (request: Request) => Promise<Response>;
type Core = {
  createQStoryProxy: (options: object) => Proxy;
  signClientIp: (secret: string, ip: string, ts: number) => Promise<string>;
  clientIpOf: (request: Request) => string | null;
};

const loadCore = async () => (await import(pathToFileURL(corePath).href)) as Core;

function capture() {
  const seen: { headers: Headers | null } = { headers: null };
  const fetchImpl = async (_url: URL, init: RequestInit) => {
    seen.headers = new Headers(init.headers);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { seen, fetchImpl };
}

function incoming(headers: Record<string, string>) {
  return new Request('https://app.example/api/qstory-proxy?path=v1/companion-chat/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: '{}',
  });
}

test('서명은 HMAC-SHA256(secret, ip + "\\n" + ts)의 hex - 백엔드와 같은 값', async () => {
  const { signClientIp } = await loadCore();
  assert.equal(
    await signClientIp('secret', '203.0.113.7', 1_760_000_000),
    '1d66427ccf6f146914958555b7d4930b78f9c85e18b9545ce886c53c4505cd39',
  );
});

test('비밀이 있으면 Vercel이 준 주소와 시각·서명을 붙인다', async () => {
  const { createQStoryProxy, signClientIp } = await loadCore();
  const { seen, fetchImpl } = capture();
  const proxy = createQStoryProxy({
    upstreamUrl: 'https://backend.example',
    proxySecret: 's3cret',
    fetchImpl,
    logger: { info: () => {} },
    now: () => 1_760_000_000_500,
  });
  await proxy(incoming({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }));
  assert.equal(seen.headers?.get('x-qstory-client-ip'), '203.0.113.7');
  assert.equal(seen.headers?.get('x-qstory-proxy-ts'), '1760000000');
  assert.equal(seen.headers?.get('x-qstory-proxy-sig'), await signClientIp('s3cret', '203.0.113.7', 1_760_000_000));
});

test('비밀이 없으면 주소 헤더를 붙이지 않는다(백엔드는 연결 주소로 센다)', async () => {
  const { createQStoryProxy } = await loadCore();
  const { seen, fetchImpl } = capture();
  const proxy = createQStoryProxy({ upstreamUrl: 'https://backend.example', proxySecret: '', fetchImpl, logger: { info: () => {} } });
  await proxy(incoming({ 'x-real-ip': '203.0.113.7' }));
  assert.equal(seen.headers?.get('x-qstory-client-ip'), null);
  assert.equal(seen.headers?.get('x-qstory-proxy-sig'), null);
});

test('브라우저가 보낸 x-qstory-client-ip·서명 헤더는 백엔드로 넘기지 않는다', async () => {
  const { createQStoryProxy } = await loadCore();
  const { seen, fetchImpl } = capture();
  const proxy = createQStoryProxy({ upstreamUrl: 'https://backend.example', proxySecret: '', fetchImpl, logger: { info: () => {} } });
  await proxy(incoming({ 'x-qstory-client-ip': '1.2.3.4', 'x-qstory-proxy-sig': 'forged', 'x-qstory-proxy-ts': '1' }));
  assert.equal(seen.headers?.get('x-qstory-client-ip'), null);
  assert.equal(seen.headers?.get('x-qstory-proxy-sig'), null);
});

test('주소 모양이 아니면 쓰지 않는다 - x-forwarded-for는 첫 값만', async () => {
  const { clientIpOf } = await loadCore();
  assert.equal(clientIpOf(incoming({ 'x-forwarded-for': '2001:db8::1, 10.0.0.1' })), '2001:db8::1');
  assert.equal(clientIpOf(incoming({ 'x-real-ip': 'evil value' })), null);
  assert.equal(clientIpOf(incoming({})), null);
});

test('429의 Retry-After를 그대로 돌려준다', async () => {
  const { createQStoryProxy } = await loadCore();
  const proxy = createQStoryProxy({
    upstreamUrl: 'https://backend.example',
    proxySecret: '',
    logger: { info: () => {} },
    fetchImpl: async () =>
      new Response(JSON.stringify({ ok: false, failure: { code: 'RATE_LIMITED', safeDetail: '잠시 후' } }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '120' },
      }),
  });
  const response = await proxy(incoming({}));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '120');
});
