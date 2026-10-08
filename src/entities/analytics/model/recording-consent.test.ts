/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RecordingConsentStore,
  isUtEntry,
  needsRecordingPrompt,
  resolveRecordingPermission,
  resolveTrackingEnabled,
  type ConsentRequest,
} from './recording-consent';
import { RecordingGate, chunkUploadOutcome } from './recording-chunks';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

type Call = { path: string; method: string; body?: unknown; token?: string | null };

function fakeServer(responses: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const request: ConsentRequest = async (path, init) => {
    calls.push({ path, ...init });
    const key = `${init.method} ${path}`;
    if (key in responses) {
      const value = responses[key];
      if (value instanceof Error) throw value;
      return typeof value === 'function' ? (value as (body: unknown) => unknown)(init.body) : value;
    }
    if (init.method === 'POST' && path === '/v1/me/recording-consent') {
      const body = init.body as { granted: boolean; source: string };
      return { granted: body.granted, source: body.source, decidedAt: '2026-10-08T00:00:00Z' };
    }
    return null;
  };
  return { calls, request };
}

function makeStore(options: { storage?: ReturnType<typeof memoryStorage>; responses?: Record<string, unknown>; session?: () => string } = {}) {
  const storage = options.storage ?? memoryStorage();
  const server = fakeServer(options.responses);
  const store = new RecordingConsentStore({
    storage,
    request: server.request,
    betaSessionId: options.session ?? (() => 'beta-1'),
    now: () => new Date('2026-10-08T00:00:00Z'),
  });
  return { store, storage, calls: server.calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const sessionPosts = (calls: Call[]) => calls.filter((call) => call.path === '/v1/recording-consents');
const accountPosts = (calls: Call[]) =>
  calls.filter((call) => call.path === '/v1/me/recording-consent' && call.method === 'POST');

test('녹화 허용은 수업 > 계정 > 이 기기 순서로 정한다', () => {
  const local = { granted: true, source: 'PROMPT' as const, decidedAt: 'x' };
  const base = { lessonOverride: null, loggedIn: true, account: { recording: false, tracking: undefined }, local };
  assert.equal(resolveRecordingPermission(base), false, '계정 결정이 이 기기 결정을 이긴다');
  assert.equal(resolveRecordingPermission({ ...base, account: { recording: null, tracking: undefined } }), true);
  assert.equal(resolveRecordingPermission({ ...base, account: { recording: undefined, tracking: undefined } }), true);
  assert.equal(resolveRecordingPermission({ ...base, loggedIn: false }), true, '익명은 이 기기 결정');
  assert.equal(resolveRecordingPermission({ ...base, lessonOverride: true }), true);
  assert.equal(resolveRecordingPermission({ ...base, account: { recording: true, tracking: undefined }, lessonOverride: false }), false);
  assert.equal(resolveRecordingPermission({ ...base, loggedIn: false, local: null }), false, '결정이 없으면 녹화하지 않는다');
});

test('묻기는 이 기기에도 계정에도 결정이 없을 때만, 수업에서는 묻지 않는다', () => {
  const none = { lessonOverride: null, loggedIn: false, account: { recording: undefined, tracking: undefined }, local: null };
  assert.equal(needsRecordingPrompt(none), true);
  assert.equal(needsRecordingPrompt({ ...none, lessonOverride: false }), false);
  assert.equal(needsRecordingPrompt({ ...none, local: { granted: false, source: 'PROMPT', decidedAt: 'x' } }), false);
  assert.equal(needsRecordingPrompt({ ...none, loggedIn: true }), false, '계정을 불러오는 중에는 묻지 않는다');
  assert.equal(needsRecordingPrompt({ ...none, loggedIn: true, account: { recording: null, tracking: undefined } }), true);
  assert.equal(needsRecordingPrompt({ ...none, loggedIn: true, account: { recording: false, tracking: undefined } }), false);
});

test('이용 기록은 기본으로 켜고, 로그인하면 계정 설정을 따른다', () => {
  const account = { recording: undefined, tracking: undefined };
  assert.equal(resolveTrackingEnabled({ loggedIn: false, account, localTracking: true }), true);
  assert.equal(resolveTrackingEnabled({ loggedIn: true, account: { ...account, tracking: false }, localTracking: true }), false);
  assert.equal(resolveTrackingEnabled({ loggedIn: false, account: { ...account, tracking: true }, localTracking: false }), false);
  const { store } = makeStore();
  assert.equal(store.getSnapshot().trackingEnabled, true);
  store.setLocalTracking(false);
  assert.equal(store.getSnapshot().trackingEnabled, false);
});

test('UT 링크(ut=1)로 들어오면 허용으로 저장하고 이 통계 세션에 UT_LINK로 알린다', async () => {
  assert.equal(isUtEntry('https://q.story/stories/HG/play?ut=1'), true);
  assert.equal(isUtEntry('https://q.story/?ut=0'), false);
  const { store, storage, calls } = makeStore();
  store.applyEntryUrl('https://q.story/?ut=1&session_id=x');
  store.applyEntryUrl('https://q.story/?ut=1&session_id=x');
  await store.setAuthToken(null);
  await flush();
  assert.equal(store.getSnapshot().recordingPermitted, true);
  assert.equal(store.getSnapshot().needsPrompt, false);
  assert.deepEqual(sessionPosts(calls).map((call) => call.body), [{ betaSessionId: 'beta-1', granted: true, source: 'UT_LINK' }]);
  assert.equal(JSON.parse(storage.data.get('qstory.recording.consent.v1')!).source, 'UT_LINK');
});

test('로그인 확인 전에는 녹화하지 않고 묻지도 않는다', async () => {
  const { store } = makeStore();
  assert.equal(store.getSnapshot().recordingPermitted, false);
  assert.equal(store.getSnapshot().needsPrompt, false);
  await store.setAuthToken(null);
  assert.equal(store.getSnapshot().needsPrompt, true);
});

test('익명 사용자가 [허용]을 누르면 이 기기에 저장하고 세션에 PROMPT로 한 번 알린다', async () => {
  const { store, calls } = makeStore();
  await store.setAuthToken(null);
  await store.answerPrompt(true);
  assert.equal(store.getSnapshot().recordingPermitted, true);
  assert.equal(store.getSnapshot().needsPrompt, false);
  assert.deepEqual(sessionPosts(calls).map((call) => call.body), [{ betaSessionId: 'beta-1', granted: true, source: 'PROMPT' }]);
  assert.equal(accountPosts(calls).length, 0);
});

test('통계 세션이 바뀌면 이 기기 허용을 새 세션에 다시 알린다', async () => {
  let session = 'beta-1';
  const { store, calls } = makeStore({ session: () => session });
  await store.setAuthToken(null);
  await store.answerPrompt(true);
  session = 'beta-2';
  store.setLocalTracking(true); // 아무 변화든 상태를 다시 계산한다
  await flush();
  assert.deepEqual(sessionPosts(calls).map((call) => (call.body as { betaSessionId: string }).betaSessionId), ['beta-1', 'beta-2']);
});

test('로그인하면 계정 결정이 이 기기 결정을 이긴다', async () => {
  const storage = memoryStorage({
    'qstory.recording.consent.v1': JSON.stringify({ granted: true, source: 'PROMPT', decidedAt: 'x' }),
  });
  const { store, calls } = makeStore({
    storage,
    responses: { 'GET /v1/me/recording-consent': { granted: false, source: 'ACCOUNT', decidedAt: 'y' } },
  });
  await store.setAuthToken('token-a');
  assert.equal(store.getSnapshot().recordingPermitted, false);
  assert.equal(accountPosts(calls).length, 0, '계정에 결정이 있으면 올리지 않는다');
});

test('로그인 직후 계정 설정을 불러오는 동안은 이 기기 허용으로도 녹화하지 않는다', async () => {
  const storage = memoryStorage({
    'qstory.recording.consent.v1': JSON.stringify({ granted: true, source: 'PROMPT', decidedAt: 'x' }),
  });
  let release: (value: unknown) => void = () => {};
  const { store, calls } = makeStore({
    storage,
    responses: { 'GET /v1/me/recording-consent': () => new Promise((resolve) => (release = resolve)) },
  });
  const loading = store.setAuthToken('token-a');
  assert.equal(store.getSnapshot().recordingPermitted, false);
  assert.equal(sessionPosts(calls).length, 0, '불러오는 동안 세션에 알리지 않는다');
  release({ granted: true, source: 'ACCOUNT', decidedAt: 'y' });
  await loading;
  assert.equal(store.getSnapshot().recordingPermitted, true);
});

test('계정에 결정이 없고 이 기기 결정이 있으면 계정으로 한 번만 올린다(PROMPT)', async () => {
  const storage = memoryStorage({
    'qstory.recording.consent.v1': JSON.stringify({ granted: false, source: 'PROMPT', decidedAt: 'x' }),
  });
  const { store, calls } = makeStore({
    storage,
    responses: {
      'GET /v1/me/recording-consent': { granted: null, source: null, decidedAt: null },
      'GET /v1/me/usage-tracking': { enabled: false },
    },
  });
  await store.setAuthToken('token-a');
  assert.deepEqual(accountPosts(calls).map((call) => [call.body, call.token]), [[{ granted: false, source: 'PROMPT' }, 'token-a']]);
  assert.equal(store.getSnapshot().account.recording, false);
  assert.equal(store.getSnapshot().trackingEnabled, false, '계정의 이용 기록 설정을 따른다');
  // 같은 토큰으로 다시 불러와도(로그아웃 없이 새로고침 등) 다시 올리지 않는다.
  await store.setAuthToken(null);
  await store.setAuthToken('token-a');
  assert.equal(accountPosts(calls).length, 1);
});

test('로그인한 사용자의 묻기 응답은 계정(PROMPT)과 이 기기에 함께 남긴다', async () => {
  const { store, storage, calls } = makeStore({
    responses: { 'GET /v1/me/recording-consent': { granted: null, source: null, decidedAt: null } },
  });
  await store.setAuthToken('token-a');
  assert.equal(store.getSnapshot().needsPrompt, true);
  await store.answerPrompt(false);
  assert.deepEqual(accountPosts(calls).map((call) => call.body), [{ granted: false, source: 'PROMPT' }]);
  assert.equal(JSON.parse(storage.data.get('qstory.recording.consent.v1')!).granted, false);
  assert.equal(store.getSnapshot().needsPrompt, false);
  assert.equal(store.getSnapshot().recordingPermitted, false);
});

test('수업 녹화는 그 수업에만 적용되고 기기 결정으로 남지 않는다', async () => {
  const { store, storage, calls } = makeStore();
  await store.setAuthToken('teacher');
  store.setLessonOverride(true);
  assert.equal(store.getSnapshot().recordingPermitted, true);
  assert.equal(store.getSnapshot().needsPrompt, false);
  assert.deepEqual(sessionPosts(calls).map((call) => [call.body, call.token]), [
    [{ betaSessionId: 'beta-1', granted: true, source: 'LESSON' }, 'teacher'],
  ]);
  store.setLessonOverride(null);
  assert.equal(store.getSnapshot().recordingPermitted, false);
  assert.equal(storage.data.has('qstory.recording.consent.v1'), false);
  store.setLessonOverride(false);
  assert.equal(store.getSnapshot().needsPrompt, false, '수업에서는 묻지 않는다');
});

test('익명 기록 설정에서 녹화를 끄면 이 통계 세션의 녹화를 지우라고 알린다', async () => {
  const { store, calls } = makeStore();
  await store.setAuthToken(null);
  await store.setLocalRecording(true);
  await store.setLocalRecording(false);
  assert.deepEqual(sessionPosts(calls).map((call) => (call.body as { granted: boolean }).granted), [true, false]);
  assert.equal(store.getSnapshot().recordingPermitted, false);
});

test('조각 응답 403 RECORDING_NOT_CONSENTED면 녹화를 막고, 다시 허용하면 풀린다', () => {
  assert.equal(chunkUploadOutcome(202), 'ok');
  assert.equal(chunkUploadOutcome(413), 'capped');
  assert.equal(chunkUploadOutcome(403, 'RECORDING_NOT_CONSENTED'), 'not-consented');
  assert.equal(chunkUploadOutcome(403, 'FORBIDDEN'), 'drop');
  assert.equal(chunkUploadOutcome(503), 'retry');

  const gate = new RecordingGate();
  assert.equal(gate.canRecord(), false, '허용 전에는 녹화하지 않는다');
  gate.setPermitted(true);
  assert.equal(gate.canRecord(), true);
  assert.equal(gate.observe(403, 'RECORDING_NOT_CONSENTED'), 'not-consented');
  assert.equal(gate.canRecord(), false, '서버가 거절하면 멈춘다');
  gate.setPermitted(true);
  assert.equal(gate.canRecord(), false, '같은 허용으로는 다시 시작하지 않는다');
  gate.setPermitted(false);
  gate.setPermitted(true);
  assert.equal(gate.canRecord(), true, '새로 허용하면 다시 녹화한다');
});
