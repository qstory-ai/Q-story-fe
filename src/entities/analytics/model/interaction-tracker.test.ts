/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flushInteractions, setInteractionTrackingEnabled, trackScreenChange } from './interaction-tracker';

test('화면 이용 기록을 끄면 모아 둔 것도 버리고 아무것도 보내지 않는다', async () => {
  const sent: string[] = [];
  const globals = globalThis as Record<string, unknown>;
  const original = { window: globals.window, fetch: globals.fetch };
  globals.window = { innerWidth: 390, innerHeight: 800, location: { href: 'https://q.story/' } };
  globals.fetch = async (_url: string, init: { body: string }) => {
    sent.push(init.body);
    return { ok: true, status: 202 };
  };
  try {
    trackScreenChange('/stories/HG/play');
    setInteractionTrackingEnabled(false);
    await flushInteractions();
    assert.equal(sent.length, 0, '끄기 전에 모은 것도 보내지 않는다');

    trackScreenChange('/library');
    await flushInteractions();
    assert.equal(sent.length, 0, '꺼 둔 동안에는 모으지 않는다');

    setInteractionTrackingEnabled(true);
    await flushInteractions();
    assert.equal(sent.length, 1, '다시 켜면 지금 화면부터 모은다');
    const body = JSON.parse(sent[0]) as { events: { kind: string; screen: string }[] };
    assert.deepEqual(body.events.map((event) => event.kind), ['SCREEN_VIEW']);
  } finally {
    globals.window = original.window;
    globals.fetch = original.fetch;
  }
});
