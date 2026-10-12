import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CompanionChatError, isRateLimitedError, readCompanionReply } from './companion-chat-client';

function ndjson(lines: string[], chunkSize = 9) {
  const bytes = new TextEncoder().encode(lines.map((line) => `${line}\n`).join(''));
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        // 줄 경계와 무관하게 잘라 보낸다 - 한 줄이 여러 조각으로 나뉘어 와도 읽어야 한다.
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          controller.enqueue(bytes.subarray(offset, offset + chunkSize));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } },
  );
}

const result = {
  type: 'result',
  ok: true,
  responseText: '응, 조금 무서웠어. 너는 어때?',
  safety: { mode: 'ANSWER' },
  dialogue: { replyKind: 'ANSWER', childWantsToEnd: false, childMeaning: '무서웠는지', asksForHelp: false, proposedActionFamilyId: null },
  audioDeferred: true,
};

test('스트리밍 답은 답 문장 줄을 먼저 넘기고 마지막 줄을 평소 답으로 읽는다', async () => {
  const texts: string[] = [];
  const reply = await readCompanionReply(
    ndjson([JSON.stringify({ type: 'text', responseText: result.responseText }), JSON.stringify(result)]),
    (text) => texts.push(text),
  );
  assert.deepEqual(texts, ['응, 조금 무서웠어. 너는 어때?']);
  assert.equal(reply.responseText, result.responseText);
  assert.equal(reply.audioDeferred, true);
  assert.equal(reply.dialogue.childMeaning, '무서웠는지');
});

test('스트리밍 답의 마지막 줄이 실패면 그 안내로 실패한다', async () => {
  const failure = { type: 'result', ok: false, failure: { code: 'OPENROUTER_RESPONSE_INVALID', retryable: true, safeDetail: '답을 확인하지 못했어요.' } };
  const texts: string[] = [];
  await assert.rejects(
    readCompanionReply(ndjson([JSON.stringify({ type: 'text', responseText: '안녕!' }), JSON.stringify(failure)]), (text) => texts.push(text)),
    (error) => error instanceof CompanionChatError && error.code === 'OPENROUTER_RESPONSE_INVALID',
  );
  // 실패 전에 받은 답 문장은 넘어간다 - 호출부가 이미 보인 말풍선을 지우지 않고 마무리한다.
  assert.deepEqual(texts, ['안녕!']);
});

test('서버가 스트리밍을 꺼 두었으면 평소 JSON 하나를 읽는다', async () => {
  const texts: string[] = [];
  const { type: _type, ...plain } = result;
  const reply = await readCompanionReply(
    new Response(JSON.stringify(plain), { status: 200, headers: { 'content-type': 'application/json' } }),
    (text) => texts.push(text),
  );
  assert.deepEqual(texts, []);
  assert.equal(reply.responseText, result.responseText);
});

test('요청 상한(429)은 상한 오류로 알아본다 - 그레텔이 잠시 쉬자는 말로 바꿔 보여 준다', async () => {
  const response = new Response(
    JSON.stringify({ ok: false, failure: { code: 'RATE_LIMITED', retryable: false, safeDetail: '그레텔이 잠깐 쉬고 있어.' } }),
    { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '60' } },
  );
  const error = await readCompanionReply(response).catch((failure: unknown) => failure);
  assert.ok(error instanceof CompanionChatError);
  assert.equal(isRateLimitedError(error), true);
  assert.equal(isRateLimitedError(new CompanionChatError('x', 'COMPANION_CHAT_RATE_LIMITED')), true);
  assert.equal(isRateLimitedError(new CompanionChatError('x', 'LLM_FAILED')), false);
});
