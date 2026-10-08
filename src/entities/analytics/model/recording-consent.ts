import { authorizationHeader } from '@/shared/api';
import { apiBaseUrl } from '@/shared/config';

import { getBetaSessionId } from './beta-events';

/**
 * 화면 녹화(rrweb)·화면 이용 기록(누른 곳·스크롤) 동의 상태.
 *
 * - 화면 이용 기록: 기본으로 켠다. 끌 수 있다(익명은 이 기기, 로그인하면 계정).
 * - 화면 녹화: 허용한 경우에만 한다. 허용하지 않아도 서비스는 똑같이 쓴다.
 *
 * 녹화 허용은 이 순서로 정한다.
 * 1) 반 수업 화면(lesson) - 선생님이 고른 값이 그 수업에만 적용된다(기기 결정으로 남기지 않는다).
 * 2) 로그인했으면 계정 결정(서버). 계정에 결정이 없고 이 기기 결정이 있으면 계정으로 한 번 올린다.
 * 3) 이 기기 결정(localStorage). UT 링크(`?ut=1`)로 들어오면 허용으로 저장한다 - 참가자는 종이 동의서를 썼다.
 *
 * 이 파일은 화면(DOM)·react-native를 쓰지 않는다 - Node 테스트에서 그대로 돈다.
 */

export type RecordingConsentSource = 'PROMPT' | 'UT_LINK' | 'LESSON' | 'ACCOUNT' | 'SIGNUP';
export type SessionConsentSource = 'PROMPT' | 'UT_LINK' | 'LESSON';

export type RecordingDecision = { granted: boolean; source: RecordingConsentSource; decidedAt: string };

/** GET/POST /v1/me/recording-consent 응답. granted=null이면 아직 정하지 않았다. */
export type AccountRecordingConsent = { granted: boolean | null; source: string | null; decidedAt: string | null };

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ConsentRequest = (
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; token?: string | null },
) => Promise<unknown>;

export type RecordingConsentDeps = {
  storage: StorageLike | null;
  request: ConsentRequest;
  betaSessionId: () => string;
  now?: () => Date;
};

const DECISION_KEY = 'qstory.recording.consent.v1';
const TRACKING_KEY = 'qstory.usage-tracking.v1';
/** 녹화 허용을 서버에 알린 마지막 통계 세션 - 세션이 바뀌면(주소의 session_id 등) 다시 알린다. */
const SESSION_GRANT_KEY = 'qstory.recording.session-grant.v1';

/** 계정 쪽 값 - undefined는 아직 불러오는 중이거나 불러오지 못했다(그동안은 이 기기 결정을 따른다). */
export type AccountView = { recording: boolean | null | undefined; tracking: boolean | null | undefined };

export function resolveRecordingPermission({
  lessonOverride,
  loggedIn,
  account,
  local,
}: {
  lessonOverride: boolean | null;
  loggedIn: boolean;
  account: AccountView;
  local: RecordingDecision | null;
}): boolean {
  if (lessonOverride !== null) return lessonOverride;
  if (loggedIn && typeof account.recording === 'boolean') return account.recording;
  return local?.granted ?? false;
}

/** 이야기 시작 화면에서 물어볼지 - 이 기기에도 계정에도 결정이 없을 때만. 계정을 불러오는 중이면 묻지 않는다. */
export function needsRecordingPrompt({
  lessonOverride,
  loggedIn,
  account,
  local,
}: {
  lessonOverride: boolean | null;
  loggedIn: boolean;
  account: AccountView;
  local: RecordingDecision | null;
}): boolean {
  if (lessonOverride !== null || local) return false;
  if (!loggedIn) return true;
  return account.recording === null;
}

export function resolveTrackingEnabled({
  loggedIn,
  account,
  localTracking,
}: {
  loggedIn: boolean;
  account: AccountView;
  localTracking: boolean;
}): boolean {
  if (loggedIn && typeof account.tracking === 'boolean') return account.tracking;
  return localTracking;
}

/** 주소에 `ut=1`이 있으면 UT 참가자다. */
export function isUtEntry(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    return new URL(href).searchParams.get('ut') === '1';
  } catch {
    return false;
  }
}

export type RecordingConsentSnapshot = {
  /** 로그인 상태를 아직 모르면 false - 확인 전에는 녹화를 시작하지 않는다. */
  authResolved: boolean;
  loggedIn: boolean;
  recordingPermitted: boolean;
  trackingEnabled: boolean;
  needsPrompt: boolean;
  lessonOverride: boolean | null;
  local: RecordingDecision | null;
  localTracking: boolean;
  account: AccountView;
};

function readJson<T>(storage: StorageLike | null, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown) {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 서비스를 막지 않는다 - 이 화면 동안만 기억한다.
  }
}

function parseDecision(value: unknown): RecordingDecision | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<RecordingDecision>;
  if (typeof record.granted !== 'boolean') return null;
  return {
    granted: record.granted,
    source: (record.source as RecordingConsentSource) ?? 'PROMPT',
    decidedAt: typeof record.decidedAt === 'string' ? record.decidedAt : new Date(0).toISOString(),
  };
}

function accountGranted(value: unknown): boolean | null {
  const granted = (value as { granted?: unknown } | null)?.granted;
  return typeof granted === 'boolean' ? granted : null;
}

export class RecordingConsentStore {
  private local: RecordingDecision | null;
  private localTracking: boolean;
  private token: string | null = null;
  private authResolved = false;
  private account: AccountView = { recording: undefined, tracking: undefined };
  private lessonOverride: boolean | null = null;
  private entryApplied: string | null = null;
  /** 로그인 직후 계정 설정을 불러오는 중 - 그동안은 녹화를 시작하지 않는다(계정이 "허용 안 함"일 수 있다). */
  private accountLoading = false;
  /** 이 기기 결정을 계정으로 올린 토큰 - 한 번만 올린다. */
  private pushedFor = new Set<string>();
  private listeners = new Set<() => void>();
  private snapshot: RecordingConsentSnapshot;
  private readonly now: () => Date;

  constructor(private readonly deps: RecordingConsentDeps) {
    this.now = deps.now ?? (() => new Date());
    this.local = parseDecision(readJson(deps.storage, DECISION_KEY));
    this.localTracking = readJson<{ enabled?: unknown }>(deps.storage, TRACKING_KEY)?.enabled !== false;
    this.snapshot = this.computeSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private computeSnapshot(): RecordingConsentSnapshot {
    const loggedIn = this.token !== null;
    const input = { lessonOverride: this.lessonOverride, loggedIn, account: this.account, local: this.local };
    return {
      authResolved: this.authResolved,
      loggedIn,
      recordingPermitted:
        this.authResolved && (!this.accountLoading || this.lessonOverride !== null) && resolveRecordingPermission(input),
      trackingEnabled: resolveTrackingEnabled({ loggedIn, account: this.account, localTracking: this.localTracking }),
      needsPrompt: this.authResolved && needsRecordingPrompt(input),
      lessonOverride: this.lessonOverride,
      local: this.local,
      localTracking: this.localTracking,
      account: this.account,
    };
  }

  private changed() {
    this.snapshot = this.computeSnapshot();
    this.ensureSessionGrant();
    for (const listener of this.listeners) listener();
  }

  private decide(granted: boolean, source: RecordingConsentSource): RecordingDecision {
    const decision = { granted, source, decidedAt: this.now().toISOString() };
    this.local = decision;
    writeJson(this.deps.storage, DECISION_KEY, decision);
    return decision;
  }

  /**
   * POST /v1/recording-consents - 이 통계 세션의 녹화를 서버가 받게(또는 지우게) 한다. 로그인했으면 토큰도 싣는다.
   * 실패해도 throw하지 않는다(녹화가 안 될 뿐 서비스는 그대로).
   */
  private async postSession(granted: boolean, source: SessionConsentSource): Promise<boolean> {
    const betaSessionId = this.deps.betaSessionId();
    if (granted) writeJson(this.deps.storage, SESSION_GRANT_KEY, { betaSessionId });
    else writeJson(this.deps.storage, SESSION_GRANT_KEY, null);
    try {
      await this.deps.request('/v1/recording-consents', {
        method: 'POST',
        body: { betaSessionId, granted, source },
        token: this.token,
      });
      return true;
    } catch {
      // 다음에 다시 알릴 수 있게 기록을 지운다.
      if (granted) writeJson(this.deps.storage, SESSION_GRANT_KEY, null);
      return false;
    }
  }

  /**
   * 이 기기 결정(PROMPT·UT_LINK)으로 녹화하는데 지금 통계 세션에 아직 알리지 않았으면 알린다 -
   * 세션이 바뀌어도(주소의 session_id 등) 서버가 조각을 받게. 계정 결정이나 수업 화면은 따로 알린다.
   */
  private ensureSessionGrant() {
    if (!this.snapshot.recordingPermitted || this.lessonOverride !== null) return;
    if (this.token !== null && typeof this.account.recording === 'boolean') return;
    if (!this.local?.granted) return;
    const posted = readJson<{ betaSessionId?: string }>(this.deps.storage, SESSION_GRANT_KEY)?.betaSessionId;
    if (posted === this.deps.betaSessionId()) return;
    void this.postSession(true, this.local.source === 'UT_LINK' ? 'UT_LINK' : 'PROMPT');
  }

  /** 앱을 연 주소 - `ut=1`이면 녹화를 허용으로 저장하고 이 통계 세션에 알린다. */
  applyEntryUrl(href: string | null | undefined) {
    // 같은 주소로 두 번 불러도(StrictMode 등) 한 번만 알린다.
    if (!isUtEntry(href) || this.entryApplied === href) return;
    this.entryApplied = href ?? null;
    this.decide(true, 'UT_LINK');
    void this.postSession(true, 'UT_LINK');
    this.changed();
  }

  /** 로그인 상태가 정해지거나 바뀔 때(UsageTracking). 로그인했으면 계정의 녹화·사용 기록 설정을 불러온다. */
  async setAuthToken(token: string | null): Promise<void> {
    if (this.authResolved && token === this.token) return;
    this.authResolved = true;
    this.token = token;
    this.account = { recording: undefined, tracking: undefined };
    this.accountLoading = token !== null;
    this.changed();
    if (token) await this.loadAccount(token);
  }

  /** 계정 설정을 다시 불러온다(마이페이지에서 불러오지 못했을 때 "다시 시도"). */
  async refreshAccount(): Promise<void> {
    if (this.token) await this.loadAccount(this.token);
  }

  private async loadAccount(token: string): Promise<void> {
    const [recording, tracking] = await Promise.allSettled([
      this.deps.request('/v1/me/recording-consent', { method: 'GET', token }),
      this.deps.request('/v1/me/usage-tracking', { method: 'GET', token }),
    ]);
    if (this.token !== token) return;
    this.accountLoading = false;
    const trackingValue =
      tracking.status === 'fulfilled' ? (tracking.value as { enabled?: unknown } | null)?.enabled : undefined;
    this.account = {
      recording: recording.status === 'fulfilled' ? accountGranted(recording.value) : undefined,
      tracking: typeof trackingValue === 'boolean' ? trackingValue : undefined,
    };
    this.changed();

    // 계정에 결정이 없고 이 기기 결정이 있으면 계정으로 한 번 올린다 - 로그인한 뒤 다시 묻지 않게.
    if (this.account.recording === null && this.local && !this.pushedFor.has(token)) {
      this.pushedFor.add(token);
      try {
        const saved = await this.deps.request('/v1/me/recording-consent', {
          method: 'POST',
          body: { granted: this.local.granted, source: 'PROMPT' },
          token,
        });
        if (this.token !== token) return;
        this.account = { ...this.account, recording: accountGranted(saved) ?? this.local.granted };
        this.changed();
      } catch {
        // 올리지 못하면 이 기기 결정을 그대로 따른다.
      }
    }
  }

  /** 이야기 시작 화면의 [허용]/[괜찮아요]. 이 기기에 저장하고, 로그인했으면 계정에도 남긴다. */
  async answerPrompt(granted: boolean): Promise<void> {
    this.decide(granted, 'PROMPT');
    const token = this.token;
    if (token) this.account = { ...this.account, recording: granted };
    // 세션 알림을 먼저 시작한다 - changed()의 ensureSessionGrant가 같은 요청을 한 번 더 보내지 않게.
    const tasks: Promise<unknown>[] = [this.postSession(granted, 'PROMPT')];
    this.changed();
    if (token) {
      tasks.push(
        this.deps
          .request('/v1/me/recording-consent', { method: 'POST', body: { granted, source: 'PROMPT' }, token })
          .catch(() => {}),
      );
    }
    await Promise.all(tasks);
  }

  /**
   * 반 수업 화면(선생님이 "기관에서 보호자 동의를 받았어요"를 켰는지). null이면 수업이 끝났다.
   * 켰으면 이 통계 세션에 LESSON으로 알린다. 기기 결정으로는 남기지 않는다.
   */
  setLessonOverride(granted: boolean | null) {
    if (granted === this.lessonOverride) return;
    this.lessonOverride = granted;
    if (granted === true) void this.postSession(true, 'LESSON');
    this.changed();
  }

  /** 익명 "기록 설정"의 화면 녹화 스위치 - 끄면 이 통계 세션의 녹화를 서버에서 지운다. */
  async setLocalRecording(granted: boolean): Promise<void> {
    this.decide(granted, 'PROMPT');
    // 켜면 changed()의 ensureSessionGrant가 이 통계 세션에 알린다.
    const withdrawal = granted ? null : this.postSession(false, 'PROMPT');
    this.changed();
    await withdrawal;
  }

  setLocalTracking(enabled: boolean) {
    this.localTracking = enabled;
    writeJson(this.deps.storage, TRACKING_KEY, { enabled });
    this.changed();
  }

  /** 마이페이지 "화면 녹화 허용" - 끄면 서버가 이 계정의 녹화를 지운다. 실패하면 throw(화면이 되돌린다). */
  async setAccountRecording(token: string, granted: boolean): Promise<AccountRecordingConsent> {
    const saved = (await this.deps.request('/v1/me/recording-consent', {
      method: 'POST',
      body: { granted, source: 'ACCOUNT' },
      token,
    })) as AccountRecordingConsent;
    if (this.token === token) {
      this.account = { ...this.account, recording: accountGranted(saved) ?? granted };
      this.changed();
    }
    return saved;
  }

  async setAccountTracking(token: string, enabled: boolean): Promise<boolean> {
    const saved = (await this.deps.request('/v1/me/usage-tracking', {
      method: 'POST',
      body: { enabled },
      token,
    })) as { enabled?: unknown } | null;
    const value = typeof saved?.enabled === 'boolean' ? saved.enabled : enabled;
    if (this.token === token) {
      this.account = { ...this.account, tracking: value };
      this.changed();
    }
    return value;
  }

  /** 가입 직후 - 가입 화면의 "화면 녹화 허용 (선택)" 체크 여부를 계정 결정으로 남긴다(안 골랐어도 다시 묻지 않게). */
  async recordSignupDecision(token: string, granted: boolean): Promise<void> {
    try {
      await this.deps.request('/v1/me/recording-consent', { method: 'POST', body: { granted, source: 'SIGNUP' }, token });
    } catch {
      // 남기지 못하면 다음 이야기 시작 화면에서 물어본다.
    }
  }
}

export class RecordingConsentApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/** 브라우저 기본 요청 - 실패 응답은 RecordingConsentApiError로 던진다. */
export const defaultConsentRequest: ConsentRequest = async (path, { method, body, token }) => {
  if (!apiBaseUrl) throw new RecordingConsentApiError('VITE_QSTORY_API_URL is not configured.');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : authorizationHeader()),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let code: string | undefined;
    let safeDetail: string | undefined;
    try {
      const failure = ((await response.json()) as { failure?: { code?: string; safeDetail?: string } }).failure;
      code = failure?.code;
      safeDetail = failure?.safeDetail;
    } catch {
      // 본문이 없으면 상태 코드만.
    }
    throw new RecordingConsentApiError(safeDetail ?? '', code, response.status);
  }
  if (response.status === 202 || response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let shared: RecordingConsentStore | null = null;

/** 앱 전체가 함께 쓰는 동의 상태. */
export function recordingConsentStore(): RecordingConsentStore {
  shared ??= new RecordingConsentStore({
    storage: safeLocalStorage(),
    request: defaultConsentRequest,
    betaSessionId: getBetaSessionId,
  });
  return shared;
}
