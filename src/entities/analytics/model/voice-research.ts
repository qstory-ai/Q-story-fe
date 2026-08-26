import { readEnv } from '@/shared/config';

export const VOICE_RESEARCH_CONSENT_VERSION =
  'voice-research-v2-shadow-family';
export const VOICE_RESEARCH_RETENTION_DAYS = 90;
export const VOICE_RESEARCH_CONSENTS_STORAGE_KEY =
  'qstory.voice-research.consents.v2';

const DEFAULT_ENDPOINT = readEnv('VITE_QSTORY_VOICE_RESEARCH_URL');
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VoiceResearchConsent = {
  consentId: string;
  deletionToken: string;
  consentedAt: string;
  version: typeof VOICE_RESEARCH_CONSENT_VERSION;
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

function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isHttpUrl(value: string) {
  try {
    // 동일 출처(same-origin) 프록시 경로(예: `/api/qstory/v1/voice-research`)는 그 자체로는 스킴이 없으므로,
    // 스킴을 확인하기 전에 현재 origin을 기준으로 해석(resolve)한다.
    const base = typeof window === 'undefined' ? undefined : window.location.origin;
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

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

export function createVoiceResearchConsent(): VoiceResearchConsent {
  const consent: VoiceResearchConsent = {
    consentId: createUuid(),
    deletionToken: createUuid(),
    consentedAt: new Date().toISOString(),
    version: VOICE_RESEARCH_CONSENT_VERSION,
  };
  writeStoredConsents([...readStoredConsents(), consent]);
  return consent;
}

export function getStoredVoiceResearchConsents() {
  return readStoredConsents();
}

export async function storeVoiceResearchSample(
  input: VoiceResearchSampleInput,
  options: RequestOptions = {},
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
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function withdrawVoiceResearchConsent(
  consent: VoiceResearchConsent,
  options: RequestOptions = {},
) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  if (!isHttpUrl(endpoint)) return false;
  const fetchImpl = (options.fetchImpl ?? fetch).bind(globalThis);
  try {
    const response = await fetchImpl(`${endpoint}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_id: consent.consentId,
        deletion_token: consent.deletionToken,
      }),
    });
    if (!response.ok) return false;
    writeStoredConsents(
      readStoredConsents().filter(
        (stored) => stored.consentId !== consent.consentId,
      ),
    );
    return true;
  } catch {
    return false;
  }
}
