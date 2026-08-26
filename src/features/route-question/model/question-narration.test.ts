// @ts-nocheck -- Node 테스트 assertion들이 테스트 전용 전역 변수를 의도적으로 사용한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelManifest } from '@/entities/story/hansel-gretel/manifest';

import {
  fetchQuestionNarration,
  preloadQuestionNarration,
} from './question-narration';

test('question narration sends the manifest prompt speaker without provider keys', async () => {
  const anchor = hanselGretelManifest.questionAnchors[0];
  let requestBody: Record<string, unknown> | null = null;
  const result = await fetchQuestionNarration(
    {
      storyId: hanselGretelManifest.storyId,
      anchor,
      text: '하윤, 하얀 새를 보니 뭐가 궁금해?',
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
    anchorId: 'HG-Q-A',
    speakerId: 'HG-SPK-GRETEL',
    text: '하윤, 하얀 새를 보니 뭐가 궁금해?',
  });
  assert.equal(JSON.stringify(requestBody).includes('apiKey'), false);
  assert.equal(result?.mimeType, 'audio/wav');
});

test('question narration safely falls back when the server is unavailable', async () => {
  const result = await fetchQuestionNarration(
    {
      storyId: hanselGretelManifest.storyId,
      anchor: hanselGretelManifest.questionAnchors[0],
      text: '친구, 뭐가 궁금해?',
    },
    async () => {
      throw new Error('offline');
    },
    'https://api.example',
  );

  assert.equal(result, null);
});

test('question narration stops waiting when the server does not respond', async () => {
  let aborted = false;
  const result = await fetchQuestionNarration(
    {
      storyId: hanselGretelManifest.storyId,
      anchor: hanselGretelManifest.questionAnchors[0],
      text: '응답이 늦어도 질문 입력은 열어 줘.',
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

test('question narration preload retries transient failures before the question scene', async () => {
  const audio = { mimeType: 'audio/wav', dataBase64: 'UklGRg==' };
  let attempts = 0;
  const result = await preloadQuestionNarration(
    {
      storyId: hanselGretelManifest.storyId,
      anchor: hanselGretelManifest.questionAnchors[0],
      text: '이야기가 시작될 때 미리 준비해 줘.',
    },
    {
      attempts: 3,
      retryDelayMs: 0,
      load: async () => {
        attempts += 1;
        return attempts === 3 ? audio : null;
      },
    },
  );

  assert.equal(attempts, 3);
  assert.deepEqual(result, audio);
});
