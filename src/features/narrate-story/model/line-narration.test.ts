// @ts-nocheck -- Node 테스트 assertion들이 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelManifest } from '@/entities/story/hansel-gretel/manifest';

import { fetchLineNarration } from './line-narration';

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
