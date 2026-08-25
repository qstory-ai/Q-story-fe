// @ts-nocheck -- Node 테스트 러너 타입을 의도적으로 Expo 번들에서 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  questionAnchorId,
  sceneId,
  storyId,
  type LocalRecordingArtifact,
} from '@/entities/story-runtime';

import { hanselGretelStoryPackage as storyPackage } from '@/entities/story/hansel-gretel/manifest';

import { LocalSafeSpeechPipeline } from './local-safe-pipeline';
import { HttpSpeechPipeline } from './http-speech-pipeline';

const recording: LocalRecordingArtifact = {
  uri: 'file://local-question.m4a',
  durationMillis: 2400,
  mimeType: 'audio/mp4',
};

test('local pipeline returns a reviewed fallback without exposing provider keys', async () => {
  const pipeline = new LocalSafeSpeechPipeline(storyPackage);
  const result = await pipeline.transcribe(
    {
      recording,
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F05'),
      anchorId: questionAnchorId('HG-Q-B'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.code, 'SPEECH_PROVIDER_NOT_CONFIGURED');
    assert.equal(result.fallback.familyId, 'B_CHECK_KEYS');
    assert.equal(result.fallback.rejoinAt, 'HG-F05-ENTER-HOUSE');
  }
});

test('HTTP pipeline transcribes first and routes only after confirmation', async () => {
  const calls: { input: string; init?: RequestInit }[] = [];
  const fakeFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ input: String(input), init });
    const requestUrl = String(input);
    if (requestUrl === recording.uri) {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'audio/mp4' },
      });
    }
    if (requestUrl.endsWith('/v1/transcriptions')) {
      return new Response(
        JSON.stringify({
          ok: true,
          speech: {
            status: 'speech',
            transcript: '숨겨진 문이 있을까?',
            locale: 'ko',
            normalizedMimeType: 'audio/wav',
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        ok: true,
        speech: {
          status: 'speech',
          transcript: '숨겨진 문이 있을까?',
          locale: 'ko',
          normalizedMimeType: 'audio/wav',
        },
        plan: {
          kind: 'route',
          route: 'ANSWER_RESUME',
          childRelevantMeaning: '숨겨진 문이 있는지 궁금하다.',
          text: '문 주변을 살펴보자.',
          speakerId: 'HG-SPK-GRETEL',
          actionFamilyId: null,
          rejoinAt: null,
          fallbackFamilyId: null,
          options: [],
          versions: {
            modelId: 'test-llm',
            promptVersion: 'QSTORY_ROUTE_PROMPT_V1',
            storyManifestVersion: 'master-spec-v1.9-routing-v1',
            routePolicyVersion: 'qstory-route-policy-v1',
          },
        },
        audioText: '문 주변을 살펴보자.',
        audio: {
          mimeType: 'audio/wav',
          dataBase64: 'AQID',
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
  const pipeline = new HttpSpeechPipeline(
    'https://api.q-story.test/',
    storyPackage,
    fakeFetch as typeof fetch,
  );
  const transcription = await pipeline.transcribe(
    {
      recording,
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F05'),
      anchorId: questionAnchorId('HG-Q-B'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(transcription.ok, true);
  if (!transcription.ok) {
    return;
  }
  assert.equal(transcription.speech.transcript, '숨겨진 문이 있을까?');
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1].input,
    'https://api.q-story.test/v1/transcriptions',
  );
  const headers = calls[1].init?.headers as Record<string, string>;
  assert.equal(headers['x-qstory-anchor-id'], 'HG-Q-B');

  const result = await pipeline.route(
    {
      transcript: transcription.speech.transcript,
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F05'),
      anchorId: questionAnchorId('HG-Q-B'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.audio?.dataBase64, 'AQID');
  }
  assert.equal(
    calls[2].input,
    'https://api.q-story.test/v1/questions/route',
  );
});

test('HTTP transport failure uses the active anchor fallback', async () => {
  const pipeline = new HttpSpeechPipeline(
    'https://api.q-story.test',
    storyPackage,
    (async () => {
      throw new Error('offline');
    }) as typeof fetch,
  );
  const result = await pipeline.transcribe(
    {
      recording,
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F07'),
      anchorId: questionAnchorId('HG-Q-C'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.fallback.familyId, 'C_ASK_DEMONSTRATION');
    assert.equal(result.fallback.rejoinAt, 'HG-F07-DEMONSTRATION');
  }
});

test('HTTP pipeline identifies a device recording read failure before server upload', async () => {
  const pipeline = new HttpSpeechPipeline(
    'https://api.q-story.test',
    storyPackage,
    (async () => {
      throw new TypeError('Failed to fetch local blob URL');
    }) as typeof fetch,
  );
  const result = await pipeline.transcribe(
    {
      recording,
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F04'),
      anchorId: questionAnchorId('HG-Q-A'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.code, 'RECORDING_READ_FAILED');
    assert.equal(
      result.failure.safeDetail,
      '기기에서 녹음 파일을 읽지 못했어요.',
    );
  }
});

test('HTTP pipeline uploads captured web audio without re-reading its blob URL', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const pipeline = new HttpSpeechPipeline(
    '/api/qstory',
    storyPackage,
    (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          ok: true,
          speech: {
            status: 'speech',
            transcript: '하얀 새가 어디로 가요?',
            locale: 'ko',
            normalizedMimeType: 'audio/mp4',
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch,
  );
  const result = await pipeline.transcribe(
    {
      recording,
      recordingData: new Blob([new Uint8Array([1, 2, 3])], {
        type: 'audio/mp4',
      }),
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F04'),
      anchorId: questionAnchorId('HG-Q-A'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    '/api/qstory/v1/transcriptions/base64',
  );
  assert.equal(
    (calls[0].init?.headers as Record<string, string>)['content-type'],
    'application/json',
  );
  const upload = JSON.parse(String(calls[0].init?.body));
  assert.equal(upload.mimeType, 'audio/mp4');
  assert.equal(upload.audioBase64, 'AQID');
  // 리소스 컨텍스트는 헤더가 아니라 body로 보낸다 (POST /v1/questions/route와 동일한 관례) -
  // 이 JSON 업로드 경로가 same-origin 프록시를 타므로, 헤더로 보내면 커스텀 컨텍스트 헤더를
  // 프록시가 전달해 주지 않는 한 백엔드에 닿지 않는다.
  assert.equal(upload.storyId, 'HG');
  assert.equal(upload.sceneId, 'HG-F04');
  assert.equal(upload.anchorId, 'HG-Q-A');
  assert.equal(upload.questionRound, 1);
  const uploadHeaders = calls[0].init?.headers as Record<string, string>;
  assert.equal(uploadHeaders['x-qstory-story-id'], undefined);
  assert.equal(uploadHeaders['x-qstory-anchor-id'], undefined);
});

test('HTTP pipeline rejects oversized web audio before base64 expansion', async () => {
  let called = false;
  const pipeline = new HttpSpeechPipeline(
    '/api/qstory',
    storyPackage,
    (async () => {
      called = true;
      return new Response();
    }) as typeof fetch,
  );
  const result = await pipeline.transcribe(
    {
      recording,
      recordingData: new Blob([new Uint8Array(2.5 * 1024 * 1024 + 1)], {
        type: 'audio/webm',
      }),
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F04'),
      anchorId: questionAnchorId('HG-Q-A'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, false);
  assert.equal(called, false);
  if (!result.ok) {
    assert.equal(result.failure.code, 'RECORDING_TOO_LARGE');
  }
});

test('HTTP pipeline binds receiver-sensitive browser fetch before calling it', async () => {
  let observedReceiver: unknown = null;
  const receiverSensitiveFetch = (function (
    this: unknown,
    _input: string | URL | Request,
  ) {
    observedReceiver = this;
    if (this !== globalThis) {
      throw new TypeError(
        "Failed to execute 'fetch' on 'Window': Illegal invocation",
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          ok: true,
          speech: {
            status: 'speech',
            transcript: '하얀 새는 어디로 가요?',
            locale: 'ko',
            normalizedMimeType: 'audio/webm',
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
  }) as typeof fetch;
  const pipeline = new HttpSpeechPipeline(
    'https://api.q-story.test',
    storyPackage,
    receiverSensitiveFetch,
  );

  const result = await pipeline.transcribe(
    {
      recording,
      recordingData: new Blob([new Uint8Array([1, 2, 3])], {
        type: 'audio/webm',
      }),
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F04'),
      anchorId: questionAnchorId('HG-Q-A'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, true);
  assert.equal(observedReceiver, globalThis);
});

test('HTTP text question bypasses recording upload and keeps the transcript', async () => {
  const calls: { input: string; init?: RequestInit }[] = [];
  const pipeline = new HttpSpeechPipeline(
    'https://api.q-story.test',
    storyPackage,
    (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(
        JSON.stringify({
          ok: true,
          speech: {
            status: 'speech',
            transcript: '새는 어디로 가는 거야?',
            locale: 'ko',
            normalizedMimeType: 'text/plain',
          },
          plan: {
            kind: 'route',
            route: 'ANSWER_RESUME',
            childRelevantMeaning: '새가 어디로 가는지 궁금하다.',
            text: '달콤한 냄새가 나는 쪽을 보고 있어.',
            speakerId: 'HG-SPK-GRETEL',
            actionFamilyId: null,
            rejoinAt: null,
            fallbackFamilyId: null,
            options: [],
            versions: {
              modelId: 'test-llm',
              promptVersion: 'QSTORY_ROUTE_PROMPT_V1',
              storyManifestVersion: 'master-spec-v1.9-routing-v1',
              routePolicyVersion: 'qstory-route-policy-v1',
            },
          },
          audioText: '달콤한 냄새가 나는 쪽을 보고 있어.',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch,
  );
  const result = await pipeline.route(
    {
      transcript: '새는 어디로 가는 거야?',
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F04'),
      anchorId: questionAnchorId('HG-Q-A'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].input,
    'https://api.q-story.test/v1/questions/route',
  );
  assert.equal(
    JSON.parse(String(calls[0].init?.body)).transcript,
    '새는 어디로 가는 거야?',
  );
});

test('HTTP pipeline retries once when a hosting layer replaces JSON with HTML', async () => {
  let attempts = 0;
  const pipeline = new HttpSpeechPipeline(
    'https://api.q-story.test',
    storyPackage,
    (async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response('<html>temporary unavailable</html>', {
          status: 503,
          headers: { 'content-type': 'text/html' },
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          speech: {
            status: 'speech',
            transcript: '새는 어디로 가는 거야?',
            locale: 'ko',
            normalizedMimeType: 'text/plain',
          },
          plan: {
            kind: 'route',
            route: 'ANSWER_RESUME',
            childRelevantMeaning: '새가 어디로 가는지 궁금하다.',
            text: '달콤한 냄새가 나는 쪽을 보고 있어.',
            speakerId: 'HG-SPK-GRETEL',
            actionFamilyId: null,
            rejoinAt: null,
            fallbackFamilyId: null,
            options: [],
            versions: {
              modelId: 'test-llm',
              promptVersion: 'QSTORY_ROUTE_PROMPT_V4',
              storyManifestVersion: 'master-spec-v2.1-open-invites-parent-report',
              routePolicyVersion: 'qstory-route-policy-v1',
            },
          },
          audioText: '달콤한 냄새가 나는 쪽을 보고 있어.',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch,
  );

  const result = await pipeline.route(
    {
      transcript: '새는 어디로 가는 거야?',
      storyId: storyId('HG'),
      sceneId: sceneId('HG-F04'),
      anchorId: questionAnchorId('HG-Q-A'),
      questionRound: 1,
    },
    new AbortController().signal,
  );

  assert.equal(result.ok, true);
  assert.equal(attempts, 2);
});
