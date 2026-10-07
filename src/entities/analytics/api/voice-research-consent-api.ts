import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';

import { VOICE_RESEARCH_CONSENT_VERSION } from '../model/voice-research';

/**
 * BE의 /v1/me/voice-research-consent 세 엔드포인트(보호자 계정 단위 음성 연구 동의)를 감싼다.
 * 마이페이지 "설정"에서 보고 끄고 다시 켜며, 이야기 화면은 세션을 시작할 때 이 상태로
 * 녹음 저장 여부를 정한다. 보호자(PARENT) 계정만 쓸 수 있다.
 */
export type VoiceResearchAccountConsent = {
  /** 지금 이 계정으로 올린 질문 원음이 연구용으로 저장되는지. */
  enabled: boolean;
  /** 보호자가 마이페이지에서 직접 켜거나 끈 기록이 있는지 - false면 서비스 기본값을 따르는 중. */
  explicit: boolean;
  consentVersion: string | null;
  /** 마지막으로 동의한 시각(ISO). 없으면 null. */
  consentedAt: string | null;
  /** 마지막으로 철회한 시각(ISO). 다시 동의했거나 철회한 적 없으면 null. */
  withdrawnAt: string | null;
  retentionDays: number;
};

export class VoiceResearchConsentApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(VoiceResearchConsentApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function getVoiceResearchAccountConsent(
  token: string,
  options?: RequestOptions,
): Promise<VoiceResearchAccountConsent> {
  return request('/v1/me/voice-research-consent', { method: 'GET' }, token, options);
}

/** 화면에 보여 준 약관(VOICE_RESEARCH_CONSENT_TERMS)의 버전으로 동의한다 - 서버 버전과 다르면 409. */
export function grantVoiceResearchAccountConsent(
  token: string,
  source?: 'ONBOARDING' | 'MYPAGE',
  options?: RequestOptions,
): Promise<VoiceResearchAccountConsent> {
  return request(
    '/v1/me/voice-research-consent',
    { method: 'POST', body: JSON.stringify({ consentVersion: VOICE_RESEARCH_CONSENT_VERSION, ...(source ? { source } : {}) }) },
    token,
    options,
  );
}

/** 철회 - 이 계정에 연결된 녹음을 서버에서 모두 지우고, 이후 이 계정의 녹음은 저장하지 않는다. */
export function withdrawVoiceResearchAccountConsent(
  token: string,
  options?: RequestOptions,
): Promise<VoiceResearchAccountConsent> {
  return request('/v1/me/voice-research-consent/withdraw', { method: 'POST' }, token, options);
}
