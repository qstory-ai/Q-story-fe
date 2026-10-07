import { readEnv } from '@/shared/config';

import { UUID_PATTERN, createUuid, isHttpUrl } from './endpoint-utils';

export const VOICE_RESEARCH_CONSENT_VERSION =
  'voice-research-v2-shadow-family';
const VOICE_RESEARCH_CONSENTS_STORAGE_KEY =
  'qstory.voice-research.consents.v2';

/**
 * VOICE_RESEARCH_CONSENT_VERSION에 해당하는 보호자 동의 문구 - 이 버전을 처음 받던 이야기 화면
 * 체크박스의 문구 그대로다. 마이페이지에서 다시 동의할 때 이 문구를 보여 주고 이 버전으로 보낸다.
 * 문구를 바꾸면 버전(여기와 BE VoiceResearchService.CONSENT_VERSION)도 함께 올려야 한다.
 */
export const VOICE_RESEARCH_CONSENT_TERMS =
  '아이의 질문 음성 원본을 음성 인식 개선을 위해 1년간 비공개로 보관해요. 동의하지 않아도 질문은 문장으로 바뀌어 그대로 이용할 수 있고, 음성 원본은 저장되지 않아요.';

const DEFAULT_ENDPOINT = readEnv('VITE_QSTORY_VOICE_RESEARCH_URL');

export type VoiceResearchConsent = {
  consentId: string;
  deletionToken: string;
  consentedAt: string;
  version: typeof VOICE_RESEARCH_CONSENT_VERSION;
  /** 이 세션을 시작한 보호자 계정 - 공용 기기에서 한 계정의 철회가 다른 계정의 녹음까지 지우지 않게. 비로그인이면 없음. */
  ownerId?: string;
};

export type VoiceResearchRecording = {
  uri: string;
  durationMillis: number;
  mimeType: string;
  uploadBlob?: Blob;
};

export type VoiceResearchSampleInput = {
  consent: VoiceResearchConsent | null;
  recording: VoiceResearchRecording;
  storyId: string;
  sceneId: string;
  anchorId: string;
  questionRound: number;
  sttDraft: string;
  confirmedTranscript: string;
  routeOutcome?: {
    coverageStatus: 'exact' | 'partial' | 'uncovered';
    familyId: string | null;
    intentSummary: string;
  };
};

type RequestOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type UploadOptions = RequestOptions & {
  /** 로그인한 보호자의 토큰 - 서버가 계정 동의를 확인하고 이 녹음을 계정에 연결한다(마이페이지 철회 대상). */
  token?: string | null;
};

function readStoredConsents(): VoiceResearchConsent[] {
  try {
    const value = globalThis.localStorage?.getItem(
      VOICE_RESEARCH_CONSENTS_STORAGE_KEY,
    );
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is VoiceResearchConsent =>
        Boolean(item) &&
        typeof item === 'object' &&
        UUID_PATTERN.test(String((item as VoiceResearchConsent).consentId)) &&
        UUID_PATTERN.test(String((item as VoiceResearchConsent).deletionToken)) &&
        (item as VoiceResearchConsent).version ===
          VOICE_RESEARCH_CONSENT_VERSION &&
        Number.isFinite(Date.parse(String((item as VoiceResearchConsent).consentedAt))),
    );
  } catch {
    return [];
  }
}

function writeStoredConsents(consents: VoiceResearchConsent[]) {
  try {
    globalThis.localStorage?.setItem(
      VOICE_RESEARCH_CONSENTS_STORAGE_KEY,
      JSON.stringify(consents.slice(-12)),
    );
  } catch {
    // 비공개 브라우징(private browsing) 모드에서는 저장소 접근이 불가능할 수 있다. 음성 업로드는 여전히 동작한다.
  }
}

export function createVoiceResearchConsent(ownerId?: string | null): VoiceResearchConsent {
  const consent: VoiceResearchConsent = {
    consentId: createUuid(),
    deletionToken: createUuid(),
    consentedAt: new Date().toISOString(),
    version: VOICE_RESEARCH_CONSENT_VERSION,
    ...(ownerId ? { ownerId } : {}),
  };
  writeStoredConsents([...readStoredConsents(), consent]);
  return consent;
}

export async function storeVoiceResearchSample(
  input: VoiceResearchSampleInput,
  options: UploadOptions = {},
) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  if (!input.consent || !isHttpUrl(endpoint)) return false;

  const fetchImpl = (options.fetchImpl ?? fetch).bind(globalThis);
  let audio = input.recording.uploadBlob;
  if (!audio) {
    try {
      const response = await fetchImpl(input.recording.uri);
      if (!response.ok) return false;
      audio = await response.blob();
    } catch {
      return false;
    }
  }
  if (audio.size < 1 || audio.size > 3 * 1024 * 1024) return false;

  const mimeType = input.recording.mimeType || audio.type;
  const extension = mimeType.includes('mp4') || mimeType.includes('m4a')
    ? 'm4a'
    : 'webm';
  const form = new FormData();
  form.set('consent_id', input.consent.consentId);
  form.set('deletion_token', input.consent.deletionToken);
  form.set('consented_at', input.consent.consentedAt);
  form.set('sample_id', createUuid());
  form.set('story_id', input.storyId);
  form.set('scene_id', input.sceneId);
  form.set('anchor_id', input.anchorId);
  form.set('question_round', String(input.questionRound));
  form.set('duration_millis', String(Math.round(input.recording.durationMillis)));
  form.set('stt_draft', input.sttDraft.trim().slice(0, 240));
  form.set(
    'confirmed_transcript',
    input.confirmedTranscript.trim().slice(0, 240),
  );
  if (input.routeOutcome) {
    form.set('coverage_status', input.routeOutcome.coverageStatus);
    if (input.routeOutcome.familyId) {
      form.set('family_id', input.routeOutcome.familyId.slice(0, 64));
    }
    form.set(
      'intent_summary',
      input.routeOutcome.intentSummary.trim().slice(0, 240),
    );
  }
  form.set(
    'audio',
    audio.type === mimeType ? audio : new Blob([audio], { type: mimeType }),
    `question.${extension}`,
  );

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      body: form,
      ...(options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : {}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** 토큰 기반 철회 요청 하나 - 네트워크 오류면 null. */
async function postWithdraw(
  consent: VoiceResearchConsent,
  endpoint: string,
  fetchImpl: typeof fetch,
): Promise<Response | null> {
  try {
    return await fetchImpl(`${endpoint}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_id: consent.consentId,
        deletion_token: consent.deletionToken,
      }),
    });
  } catch {
    return null;
  }
}

export async function withdrawVoiceResearchConsent(
  consent: VoiceResearchConsent,
  options: RequestOptions = {},
) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  if (!isHttpUrl(endpoint)) return false;
  const fetchImpl = (options.fetchImpl ?? fetch).bind(globalThis);
  const response = await postWithdraw(consent, endpoint, fetchImpl);
  if (!response?.ok) return false;
  writeStoredConsents(
    readStoredConsents().filter(
      (stored) => stored.consentId !== consent.consentId,
    ),
  );
  return true;
}

/**
 * 이 기기에 남아 있는 세션 동의 중 이 계정의 것과 계정 표시가 없는 것(비로그인 세션)을 토큰으로 철회한다 -
 * 마이페이지 철회가 계정에 연결되지 않은 녹음(로그인 전에 올렸거나 계정 연결이 생기기 전에 올린 것)까지 함께
 * 지우도록. 같은 기기를 쓰는 다른 계정의 세션은 건드리지 않는다.
 * 서버가 이미 모르는 동의(403 - 녹음 없이 끝난 세션이거나 계정 철회로 먼저 지워진 것)도 지울 것이
 * 없으므로 정리된 것으로 본다. 네트워크 오류 등으로 남은 개수를 돌려준다.
 */
export async function withdrawStoredVoiceResearchConsents(
  ownerId: string,
  options: RequestOptions = {},
): Promise<number> {
  const stored = readStoredConsents().filter((consent) => !consent.ownerId || consent.ownerId === ownerId);
  if (stored.length === 0) return 0;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  if (!isHttpUrl(endpoint)) return stored.length;
  const fetchImpl = (options.fetchImpl ?? fetch).bind(globalThis);
  const settled = new Set<string>();
  for (const consent of stored) {
    const response = await postWithdraw(consent, endpoint, fetchImpl);
    if (response && (response.ok || response.status === 403)) {
      settled.add(consent.consentId);
    }
  }
  const kept = readStoredConsents().filter((consent) => !settled.has(consent.consentId));
  writeStoredConsents(kept);
  return stored.filter((consent) => !settled.has(consent.consentId)).length;
}
