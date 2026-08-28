// @ts-nocheck -- Node 테스트 assertion들이 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelManifest } from '@/entities/story/hansel-gretel/manifest';

import { fetchLineNarration, fetchLineNarrationStream, getLineNarration } from './line-narration';

test('line narration sends an empty anchorId so the backend falls back to cast-only validation', async () => {
  let requestBody: Record<string, unknown> | null = null;
  const result = await fetchLineNarration(
    {
      storyId: hanselGretelManifest.storyId,
      speakerId: 'HG-SPK-WITCH',
      text: '하윤, 이리 오렴.',
    },
    async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          ok: true,
          audio: { mimeType: 'audio/wav', dataBase64: 'UklGRg==' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    'https://api.example',
  );

  assert.deepEqual(requestBody, {
    storyId: 'HG',
    anchorId: '',
    speakerId: 'HG-SPK-WITCH',
    text: '하윤, 이리 오렴.',
  });
  assert.equal(result?.mimeType, 'audio/wav');
});

test('line narration safely falls back when the server is unavailable', async () => {
  const result = await fetchLineNarration(
    {
      storyId: hanselGretelManifest.storyId,
      speakerId: 'HG-SPK-HANSEL',
      text: '친구, 이리 와봐.',
    },
    async () => {
      throw new Error('offline');
    },
    'https://api.example',
  );

  assert.equal(result, null);
});

test('line narration stops waiting when the server does not respond', async () => {
  let aborted = false;
  const result = await fetchLineNarration(
    {
      storyId: hanselGretelManifest.storyId,
      speakerId: 'HG-SPK-HANSEL',
      text: '응답이 늦어도 낭독은 안전하게 넘어가야 해.',
    },
    async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      }),
    'https://api.example',
    5,
  );

  assert.equal(aborted, true);
  assert.equal(result, null);
});

test('line narration stream wrapper falls back to buffered fetch when streaming playback is unsupported (no window in this test runner)', async () => {
  let calledUrl: string | null = null;
  const result = await fetchLineNarrationStream(
    {
      storyId: hanselGretelManifest.storyId,
      speakerId: 'HG-SPK-GRETEL',
      text: '숲 속에서 발자국 소리가 들렸어요.',
    },
    async (input) => {
      calledUrl = String(input);
      return new Response(
        JSON.stringify({
          ok: true,
          audio: { mimeType: 'audio/wav', dataBase64: 'UklGRg==' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    'https://api.example',
  );

  // supportsStreamingPcm()은 이 Node 테스트 환경에 window가 없어 항상 false이므로,
  // 버퍼링 엔드포인트로 그대로 넘어가야 한다 - 실제 브라우저에서의 스트리밍 성공 경로는
  // response-narration.ts와 마찬가지로 이 스위트에서 별도로 검증하지 않는다.
  assert.equal(calledUrl, 'https://api.example/v1/narrations');
  assert.equal(result?.kind, undefined);
  assert.equal((result as { mimeType?: string } | null)?.mimeType, 'audio/wav');
});

test('getLineNarration dedupes an in-flight request but does not keep serving a resolved result afterward', async () => {
  let fetchCount = 0;
  const key = { storyId: hanselGretelManifest.storyId, speakerId: 'HG-SPK-GRETEL', text: '캐시 재사용 테스트 문장이에요.' };
  const fetchImpl = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify({
        ok: true,
        audio: { mimeType: 'audio/wav', dataBase64: 'UklGRg==' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const [first, concurrent] = await Promise.all([
    getLineNarration(key, fetchImpl, 'https://api.example'),
    getLineNarration(key, fetchImpl, 'https://api.example'),
  ]);
  assert.equal(fetchCount, 1, '동시에 들어온 같은 요청은 하나로 묶여야 한다');
  assert.equal(first, concurrent, '동시 호출은 같은 프라미스를 공유해야 한다');

  const second = await getLineNarration(key, fetchImpl, 'https://api.example');
  assert.equal(
    fetchCount,
    2,
    '첫 요청이 끝난 뒤 같은 대사를 다시 요청하면 캐시된 값을 재사용하지 않고 새로 가져와야 한다(pcm-stream은 재생 후 재사용 불가하기 때문)',
  );
  assert.notEqual(first, second);
});
