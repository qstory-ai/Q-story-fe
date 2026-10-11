// @ts-nocheck -- Node 테스트 러너 타입을 의도적으로 Expo 번들에서 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { startLiveTranscription } from './live-transcription';

const OPEN = 1;
const CLOSED = 3;

class FakeSocket {
  readyState = 0;
  binaryType = 'blob';
  sent: unknown[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  onclose?: () => void;
  constructor(public url: string) {}
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSED;
    this.onclose?.();
  }
  open() {
    this.readyState = OPEN;
    this.onopen?.();
  }
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function ticketFetch(body: object, ok = true) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok, json: async () => body } as Response;
  };
  return { fetchImpl, calls };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(fetchImpl: typeof fetch, timeouts = { finalTimeoutMs: 200, connectTimeoutMs: 100 }) {
  const sockets: FakeSocket[] = [];
  const partials: string[] = [];
  const live = startLiveTranscription(
    { storyId: 'HG', sceneId: 'HG-F04', sessionId: 's-1', onPartial: (text) => partials.push(text) },
    {
      fetch: fetchImpl,
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      ticketUrl: '/api/qstory/v1/stt/stream-tickets',
      streamUrl: 'wss://api.example/v1/stt/stream',
      ...timeouts,
    },
  );
  return { live, sockets, partials };
}

test('frames recorded before the socket opens are sent in order once it opens, then end yields the final transcript', async () => {
  const { fetchImpl, calls } = ticketFetch({ ok: true, ticket: 'tk/1' });
  const { live, sockets, partials } = harness(fetchImpl);
  const first = new Int16Array([1]);
  const second = new Int16Array([2]);
  live.push(first);
  live.push(second);
  await tick();

  assert.equal(JSON.parse(calls[0].init.body as string).sessionId, 's-1');
  const socket = sockets[0];
  assert.equal(socket.url, 'wss://api.example/v1/stt/stream?ticket=tk%2F1');
  socket.open();
  assert.deepEqual(socket.sent, [first, second]);

  socket.receive({ type: 'partial', text: '마녀는' });
  assert.deepEqual(partials, ['마녀는']);

  const finishing = live.finish();
  assert.deepEqual(socket.sent.at(-1), JSON.stringify({ type: 'end' }));
  socket.receive({ type: 'final', ok: true, transcript: ' 마녀는 왜 과자로 집을 만들었어 ' });
  assert.equal(await finishing, '마녀는 왜 과자로 집을 만들었어');
  assert.equal(socket.readyState, CLOSED);
});

test('ending before the socket opens sends end right after the buffered audio', async () => {
  const { fetchImpl } = ticketFetch({ ok: true, ticket: 't' });
  const { live, sockets } = harness(fetchImpl);
  live.push(new Int16Array([7]));
  const finishing = live.finish();
  await tick();
  sockets[0].open();

  assert.equal(sockets[0].sent.length, 2);
  assert.deepEqual(sockets[0].sent[1], JSON.stringify({ type: 'end' }));
  sockets[0].receive({ type: 'final', ok: true, transcript: '엄마는 어디 있어' });
  assert.equal(await finishing, '엄마는 어디 있어');
});

test('a refused ticket (stream disabled or busy) fails fast so the caller uses batch', async () => {
  const { fetchImpl } = ticketFetch({ ok: false, failure: { code: 'STT_STREAM_UNAVAILABLE' } }, false);
  const { live, sockets } = harness(fetchImpl);
  await tick();
  await tick();

  assert.equal(live.failed, true);
  assert.equal(sockets.length, 0);
  assert.equal(await live.finish(), null);
});

test('server error, early close and empty final all resolve to null (batch fallback)', async () => {
  for (const ending of ['error', 'close', 'empty'] as const) {
    const { fetchImpl } = ticketFetch({ ok: true, ticket: 't' });
    const { live, sockets } = harness(fetchImpl);
    await tick();
    const socket = sockets[0];
    socket.open();
    if (ending === 'error') socket.receive({ type: 'error', code: 'STT_STREAM_CONNECT_FAILED' });
    if (ending === 'close') socket.close();
    const finishing = live.finish();
    if (ending === 'empty') socket.receive({ type: 'final', ok: false, code: 'NO_SPEECH_DETECTED' });
    assert.equal(await finishing, null, ending);
  }
});

test('no final within the timeout resolves to null', async () => {
  const { fetchImpl } = ticketFetch({ ok: true, ticket: 't' });
  const { live, sockets } = harness(fetchImpl, { finalTimeoutMs: 20, connectTimeoutMs: 20 });
  await tick();
  sockets[0].open();
  assert.equal(await live.finish(), null);
});

test('abort stops sending and closes the socket', async () => {
  const { fetchImpl } = ticketFetch({ ok: true, ticket: 't' });
  const { live, sockets } = harness(fetchImpl);
  await tick();
  sockets[0].open();
  live.abort();
  live.push(new Int16Array([1]));

  assert.equal(sockets[0].sent.length, 0);
  assert.equal(sockets[0].readyState, CLOSED);
  assert.equal(await live.finish(), null);
});
