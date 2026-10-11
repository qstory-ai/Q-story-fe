/// <reference types="node" />
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 그레텔 답 스트리밍(companion-chat/messages, NDJSON)은 프록시가 본문을 다 받을 때까지 붙잡지 않고 바로 흘려보내야
 * 첫 줄(답 문장)이 먼저 도착한다 - 일반 JSON 응답처럼 clone().json()을 기다리면 스트리밍 이점이 사라진다.
 */
const corePath = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'api', '_qstory-proxy-core.mjs');

type Proxy = (request: Request) => Promise<Response>;

test('NDJSON 답은 마지막 줄을 기다리지 않고 첫 줄부터 흘려보낸다', { timeout: 5_000 }, async () => {
  const { createQStoryProxy } = (await import(pathToFileURL(corePath).href)) as {
    createQStoryProxy: (options: object) => Proxy;
  };
  let finish: () => void = () => {};
  const upstreamBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"type":"text","responseText":"안녕!"}\n'));
      finish = () => {
        controller.enqueue(new TextEncoder().encode('{"type":"result","ok":true}\n'));
        controller.close();
      };
    },
  });
  const proxy = createQStoryProxy({
    upstreamUrl: 'https://backend.example',
    logger: { info: () => {} },
    fetchImpl: async () =>
      new Response(upstreamBody, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } }),
  });

  // 업스트림이 아직 끝나지 않았는데도 응답이 돌아와야 한다.
  const response = await proxy(
    new Request('https://app.example/api/qstory-proxy?path=v1/companion-chat/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
  );
  assert.equal(response.headers.get('content-type'), 'application/x-ndjson; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store, no-transform');
  const reader = response.body!.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /"type":"text"/);
  finish();
  let rest = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    rest += new TextDecoder().decode(value);
  }
  assert.match(rest, /"type":"result"/);
});
