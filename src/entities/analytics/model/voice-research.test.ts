import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createVoiceResearchConsent,
  storeVoiceResearchSample,
  withdrawVoiceResearchConsent,
} from './voice-research';

test('보호자 동의가 없으면 원음 저장 요청을 보내지 않는다', async () => {
  let requestCount = 0;
  const stored = await storeVoiceResearchSample(
    {
      consent: null,
      recording: {
        uri: 'blob:test',
        durationMillis: 1_200,
        mimeType: 'audio/webm',
        uploadBlob: new Blob(['voice'], { type: 'audio/webm' }),
      },
      storyId: 'hansel-gretel',
      sceneId: 'HG-F01',
      anchorId: 'HG-Q-A',
      questionRound: 1,
      sttDraft: '새는 왜 저기로 가?',
      confirmedTranscript: '새는 왜 저기로 가?',
    },
    {
      endpoint: 'https://example.com/voice-research',
      fetchImpl: (async () => {
        requestCount += 1;
        return new Response(null, { status: 202 });
      }) as typeof fetch,
    },
  );

  assert.equal(stored, false);
  assert.equal(requestCount, 0);
});

test('보호자 동의가 있으면 원음과 확인 문장을 multipart로 전송한다', async () => {
  const consent = createVoiceResearchConsent();
  let request: RequestInit | undefined;
  const stored = await storeVoiceResearchSample(
    {
      consent,
      recording: {
        uri: 'blob:test',
        durationMillis: 1_200,
        mimeType: 'audio/webm',
        uploadBlob: new Blob(['voice'], { type: 'audio/webm' }),
      },
      storyId: 'hansel-gretel',
      sceneId: 'HG-F01',
      anchorId: 'HG-Q-A',
      questionRound: 1,
      sttDraft: '새 저기 가',
      confirmedTranscript: '새는 왜 저기로 가?',
      routeOutcome: {
        coverageStatus: 'uncovered',
        familyId: 'A_OBSERVE_BIRD',
        intentSummary: '새가 남매의 집까지 데려다줄지 궁금해한다.',
      },
    },
    {
      endpoint: 'https://example.com/voice-research',
      fetchImpl: (async (_url, init) => {
        request = init;
        return new Response(null, { status: 202 });
      }) as typeof fetch,
    },
  );

  assert.equal(stored, true);
  assert.equal(request?.method, 'POST');
  assert.ok(request?.body instanceof FormData);
  assert.equal(request.body.get('consent_id'), consent.consentId);
  assert.equal(request.body.get('stt_draft'), '새 저기 가');
  assert.equal(
    request.body.get('confirmed_transcript'),
    '새는 왜 저기로 가?',
  );
  assert.equal(request.body.get('coverage_status'), 'uncovered');
  assert.equal(request.body.get('family_id'), 'A_OBSERVE_BIRD');
  assert.equal(
    request.body.get('intent_summary'),
    '새가 남매의 집까지 데려다줄지 궁금해한다.',
  );
  assert.ok(request.body.get('audio') instanceof Blob);
});

test('동의 철회는 삭제 토큰을 포함한 요청을 보낸다', async () => {
  const consent = createVoiceResearchConsent();
  let body = '';
  const withdrawn = await withdrawVoiceResearchConsent(consent, {
    endpoint: 'https://example.com/voice-research',
    fetchImpl: (async (_url, init) => {
      body = String(init?.body ?? '');
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(withdrawn, true);
  assert.deepEqual(JSON.parse(body), {
    action: 'withdraw',
    consent_id: consent.consentId,
    deletion_token: consent.deletionToken,
  });
});
