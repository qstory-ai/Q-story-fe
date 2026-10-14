const ALLOWED_ROUTES = new Map([
  ['GET health', true],
  ['POST v1/transcriptions/base64', true],
  ['POST v1/questions/route', true],
  ['POST v1/narrations', true],
  ['POST v1/narrations/stream', true],
  ['POST v1/beta-events', true],
  // 브라우저 에러 보고(entities/analytics/model/client-errors.ts) - 서버가 로그로만 남긴다.
  ['POST v1/client-errors', true],
  // 화면 사용 기록(누른 곳·스크롤·머뭇거림)과 화면 녹화 조각 - 로그인 없이도 betaSessionId로 받는다.
  ['POST v1/interactions', true],
  ['POST v1/session-recordings/chunks', true],
  // 화면 녹화·사용 기록 동의 - 통계 세션 단위(로그인 없이도)와 계정 단위. 본문은 동의 여부 한 줄뿐이다.
  ['POST v1/recording-consents', true],
  ['GET v1/me/recording-consent', true],
  ['POST v1/me/recording-consent', true],
  ['GET v1/me/usage-tracking', true],
  ['POST v1/me/usage-tracking', true],
  // 팀 내부 화면 녹화 다시 보기(STAFF) - 코드는 쿼리(?code=)로 넘어간다.
  ['GET v1/admin/session-recordings', true],
  ['POST v1/voice-research', true],
  ['POST v1/voice-research/withdraw', true],
  // 마이페이지 계정 단위 음성 연구 동의(조회/동의/철회) - 본문은 약관 버전 한 줄뿐이다.
  ['GET v1/me/voice-research-consent', true],
  ['POST v1/me/voice-research-consent', true],
  ['POST v1/me/voice-research-consent/withdraw', true],
  // 개인정보·약관 동의 기록(보호자 계정) - 가입/온보딩에서 한 번에 보낸다.
  ['POST v1/me/consents', true],
  ['POST v1/companion-chat/messages', true],
  ['POST v1/companion-chat/transcriptions/base64', true],
  // 실시간 받아 적기 표(1회용) - 소켓(wss /v1/stt/stream)은 프록시가 들지 못해 브라우저가 백엔드에 직접 붙는다.
  ['POST v1/stt/stream-tickets', true],
  ['POST v1/auth/signup/organization', true],
  ['POST v1/auth/signup/parent', true],
  ['POST v1/auth/signup/tutor', true],
  ['POST v1/auth/login', true],
  ['POST v1/auth/refresh', true],
  ['POST v1/auth/oauth/google', true],
  ['POST v1/auth/oauth/kakao', true],
  ['GET v1/auth/me', true],
  ['POST v1/auth/me/profile', true],
  ['POST v1/auth/me/password', true],
  ['POST v1/auth/me/delete', true],
  ['POST v1/auth/password-reset/request', true],
  ['POST v1/auth/password-reset/confirm', true],
  ['POST v1/organizations', true],
  ['POST v1/classes/join', true],
  ['POST v1/classes/join-existing', true],
  ['POST v1/launch-notifications', true],
  ['POST v1/completion-surveys', true],
  ['GET v1/stories', true],
  ['POST v1/story-completions', true],
  ['GET v1/story-completions', true],
  ['GET v1/story-completions/recent', true],
  ['GET v1/tutor-students', true],
  ['GET v1/tutor-classes', true],
  ['POST v1/tutor-classes', true],
  // 선생님이 예전에 맡았던 반(지난 반).
  ['GET v1/tutor-classes/past', true],
  ['GET v1/parents/me/tutor-reports', true],
  ['POST v1/feedback', true],
  ['GET v1/parents/me/children', true],
  ['POST v1/parents/me/children', true],
  ['GET v1/me/notification-settings', true],
  ['PATCH v1/me/notification-settings', true],
  // 안드로이드 앱의 FCM 토큰 등록·해제(features/push-notifications) - 본문은 토큰 한 줄.
  ['POST v1/me/push-tokens', true],
  ['POST v1/me/push-tokens/remove', true],
  ['GET v1/me/bookmarks', true],
  ['POST v1/me/bookmarks', true],
  ['GET v1/tutor-lessons', true],
  ['POST v1/tutor-lessons', true],
  ['GET v1/tutors/me/organizations', true],
  // 공공데이터 유치원·어린이집 검색(원장 가입 화면은 로그인 전에도 부른다)과 선생님 소속 신청(be 083).
  ['GET v1/public-institutions', true],
  ['POST v1/organization-join-requests', true],
  ['GET v1/tutors/me/organization-join-requests', true],
  ['GET v1/notifications', true],
  ['POST v1/notifications/read-all', true],
  ['POST v1/auth/me/profile-image', true],
  ['GET v1/classes/memberships', true],
  ['POST v1/payments/orders', true],
  ['POST v1/payments/confirm', true],
  ['GET v1/payments/organization-quote', true],
  // 마이페이지 결제 내역·영수증.
  ['GET v1/payments/history', true],
]);

// Routes with a path segment (story/org/class/scene/segment id) that can't be listed as a literal above.
const UUID_SEGMENT = '[0-9a-fA-F-]{36}';
const STORY_ID_SEGMENT = '[A-Za-z0-9_-]{1,64}';
// TutorInvite/ClassInvite raw tokens are Base64.getUrlEncoder().withoutPadding() of 24 random
// bytes (ClassService.randomToken()/TutorStudentService.randomToken()) - URL-safe base64, not a UUID.
const INVITE_TOKEN_SEGMENT = '[A-Za-z0-9_-]{16,64}';
// The short, human-typeable code shown alongside the link (JoinCodeGenerator: 8 chars, no
// ambiguous 0/O/1/I/L) - much shorter than the raw token above, so the "by-code" routes use their
// own segment (same 4-16 char rule as shared/lib/invite-code.ts).
const SHORT_CODE_SEGMENT = '[A-Z0-9]{4,16}';
const DYNAMIC_ROUTES = [
  { method: 'GET', pattern: new RegExp(`^v1/stories/${STORY_ID_SEGMENT}/content$`) },
  // 종합 리포트가 이야기별 전략 표(strategyByFamily)를 읽는 가벼운 경로(entities/story/api/story-api.ts).
  { method: 'GET', pattern: new RegExp(`^v1/stories/${STORY_ID_SEGMENT}/report-copy$`) },
  { method: 'GET', pattern: new RegExp(`^v1/stories/${STORY_ID_SEGMENT}$`) },
  // NEW_CHOICES 실시간 생성 job 폴링(entities/live-branch/api/live-branch-api.ts) - jobId는 UUID.
  { method: 'GET', pattern: new RegExp(`^v1/live-branch/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/story-completions/${UUID_SEGMENT}$`) },
  // Q-39: 교사 메모 저장, 분석 다시 시도, 회차 대화 줄 저장(sessionId = conversationId, UUID).
  { method: 'PUT', pattern: new RegExp(`^v1/story-completions/${UUID_SEGMENT}/teacher-note$`) },
  { method: 'POST', pattern: new RegExp(`^v1/story-completions/${UUID_SEGMENT}/analysis/retry$`) },
  { method: 'POST', pattern: new RegExp(`^v1/play-sessions/${UUID_SEGMENT}/turns$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/entitlement$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/guardian-consent-ack$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/usage$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/reports$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/classes$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/classes$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/by-code/${SHORT_CODE_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/by-code/${SHORT_CODE_SEGMENT}/roster$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/students$`) },
  // 원장 반 상세의 최근 리포트·학생별 리포트·담임 변경 이력.
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/reports$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/students/${UUID_SEGMENT}/reports$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/homeroom-history$`) },
  { method: 'PUT', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/homeroom$`) },
  // 반 수명주기(관리자) - 이름 바꾸기, 지난 반 보관·다시 열기, 학생 옮기기, 학기 마무리, 학생의 반 이력.
  { method: 'PATCH', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}$`) },
  { method: 'POST', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/archive$`) },
  { method: 'POST', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/unarchive$`) },
  { method: 'POST', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/students/move$`) },
  { method: 'POST', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/term-transition$`) },
  // 담임·원장이 반 학생의 잘못된 보호자 연결을 끊는다(be#43).
  { method: 'DELETE', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/students/${UUID_SEGMENT}/parent-link$`) },
  { method: 'GET', pattern: new RegExp(`^v1/tutor-students/${UUID_SEGMENT}/class-history$`) },
  // 담임 초대 - 관리자가 만들기·지금 코드 보기, 선생님이 코드로 미리 보기(로그인 없이)·수락.
  { method: 'POST', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/homeroom-invites$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/homeroom-invites/current$`) },
  { method: 'GET', pattern: new RegExp(`^v1/class-homeroom-invites/by-code/${SHORT_CODE_SEGMENT}$`) },
  { method: 'POST', pattern: new RegExp(`^v1/class-homeroom-invites/by-code/${SHORT_CODE_SEGMENT}/accept$`) },
  { method: 'DELETE', pattern: new RegExp(`^v1/classes/memberships/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/tutor-students/${UUID_SEGMENT}$`) },
  { method: 'PATCH', pattern: new RegExp(`^v1/tutor-students/${UUID_SEGMENT}$`) },
  { method: 'DELETE', pattern: new RegExp(`^v1/tutor-students/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/tutor-students/${UUID_SEGMENT}/completions$`) },
  // ---- tutor lessons(수업 세션)
  { method: 'GET', pattern: new RegExp(`^v1/tutor-lessons/${UUID_SEGMENT}$`) },
  { method: 'PATCH', pattern: new RegExp(`^v1/tutor-lessons/${UUID_SEGMENT}$`) },
  { method: 'DELETE', pattern: new RegExp(`^v1/tutor-lessons/${UUID_SEGMENT}$`) },
  { method: 'POST', pattern: new RegExp(`^v1/tutor-lessons/${UUID_SEGMENT}/start$`) },
  { method: 'POST', pattern: new RegExp(`^v1/tutor-lessons/${UUID_SEGMENT}/complete$`) },
  { method: 'GET', pattern: new RegExp(`^v1/tutor-lessons/${UUID_SEGMENT}/completions$`) },
  // ---- organization ↔ tutor 소속 관리
  // 원장: 우리 기관과 공공 기관 목록 연결, 선생님 소속 신청 수락·거절(be 083).
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/profile$`) },
  { method: 'PUT', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/public-institution$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/join-requests$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/join-requests/${UUID_SEGMENT}/(accept|reject)$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organization-join-requests/${UUID_SEGMENT}/cancel$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/tutors$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/tutor-invites$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/tutor-invites$`) },
  { method: 'DELETE', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/tutors/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/tutors/${UUID_SEGMENT}/students$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/tutors/${UUID_SEGMENT}/lessons$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organization-tutor-invites/${INVITE_TOKEN_SEGMENT}$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organization-tutor-invites/${INVITE_TOKEN_SEGMENT}/accept$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organization-tutor-invites/by-code/${SHORT_CODE_SEGMENT}$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organization-tutor-invites/by-code/${SHORT_CODE_SEGMENT}/accept$`) },
  // ---- 아이 프로필(부모)
  { method: 'PATCH', pattern: new RegExp(`^v1/parents/me/children/${UUID_SEGMENT}$`) },
  { method: 'DELETE', pattern: new RegExp(`^v1/parents/me/children/${UUID_SEGMENT}$`) },
  // ---- 북마크
  { method: 'DELETE', pattern: new RegExp(`^v1/me/bookmarks/${STORY_ID_SEGMENT}$`) },
  // ---- 인앱 알림
  { method: 'POST', pattern: new RegExp(`^v1/notifications/${UUID_SEGMENT}/read$`) },
  { method: 'DELETE', pattern: new RegExp(`^v1/notifications/${UUID_SEGMENT}$`) },
  // Staff CMS (story-admin-api.ts) - storyId/sceneId are content ids, segmentId is a UUID.
  { method: 'GET', pattern: new RegExp(`^v1/admin/session-recordings/${UUID_SEGMENT}/chunks$`) },
  { method: 'GET', pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/scenes$`) },
  { method: 'PATCH', pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/scenes/${STORY_ID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/scenes/${STORY_ID_SEGMENT}/segments$`) },
  { method: 'PATCH', pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/segments/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/revisions$`) },
  { method: 'POST', pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/revisions/revert$`) },
  { method: 'GET', pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/narration/stale$`) },
  {
    method: 'POST',
    pattern: new RegExp(`^v1/admin/stories/${STORY_ID_SEGMENT}/segments/${UUID_SEGMENT}/narration/rerender$`),
  },
];

export function isAllowedRoute(method, upstreamPath) {
  if (ALLOWED_ROUTES.has(`${method} ${upstreamPath}`)) return true;
  return DYNAMIC_ROUTES.some((route) => route.method === method && route.pattern.test(upstreamPath));
}

// 리소스 컨텍스트(storyId/sceneId/anchorId/questionRound)는 모든 라우트가 JSON body로 받으므로
// 전달할 커스텀 헤더가 없다.
const FORWARDED_HEADERS = ['content-type', 'authorization'];
const MAX_RAW_AUDIO_BYTES = Math.floor(2.5 * 1024 * 1024);
// Base64 JSON audio upload inflates the raw bytes by ~4/3.
const MAX_TRANSCRIPTION_BODY_BYTES = Math.ceil(MAX_RAW_AUDIO_BYTES / 3) * 4 + 4_096;
// Matches voice-research/index.ts's MAX_REQUEST_BYTES (raw multipart, not base64-inflated).
const MAX_VOICE_RESEARCH_BODY_BYTES = 4 * 1024 * 1024;
// Matches BetaEventController's own payload cap.
const MAX_BETA_EVENT_BODY_BYTES = 8_192;
// 화면 사용 기록은 한 번에 최대 200건 - InteractionController의 본문 상한(512KB)과 같게.
const MAX_INTERACTIONS_BODY_BYTES = 512 * 1024;
// 녹화 조각(data 1,000,000자까지, 프런트는 900,000자로 자른다) - SessionRecordingController의 본문 상한(2MB)과 같게.
const MAX_RECORDING_CHUNK_BODY_BYTES = 2 * 1024 * 1024;
// Auth/org/class bodies are small JSON structs (email/password/names), never audio-sized.
const MAX_AUTH_BODY_BYTES = 8_192;
// Two optional free-text fields (topPriority/oneLineReview, 500 chars each server-side) plus
// checkbox arrays and a contact field can add up past MAX_AUTH_BODY_BYTES in the worst case.
const MAX_COMPLETION_SURVEY_BODY_BYTES = 16_384;
// Matches application.yml's spring.servlet.multipart.max-file-size/max-request-size (4MB); the
// generic AUTH_PATH_PREFIXES cap below (8KB) would 413 every real photo.
const MAX_PROFILE_IMAGE_BODY_BYTES = 4 * 1024 * 1024;
const AUTH_PATH_PREFIXES = ['v1/auth/', 'v1/organizations', 'v1/organization-join-requests', 'v1/classes', 'v1/tutor-students', 'v1/tutor-classes', 'v1/parents/', 'v1/payments/'];

function maxBodyBytesFor(upstreamPath) {
  if (upstreamPath === 'v1/voice-research') return MAX_VOICE_RESEARCH_BODY_BYTES;
  if (upstreamPath === 'v1/beta-events') return MAX_BETA_EVENT_BODY_BYTES;
  if (upstreamPath === 'v1/interactions') return MAX_INTERACTIONS_BODY_BYTES;
  if (upstreamPath === 'v1/session-recordings/chunks') return MAX_RECORDING_CHUNK_BODY_BYTES;
  if (upstreamPath.startsWith('v1/me/voice-research-consent')) return MAX_AUTH_BODY_BYTES;
  if (upstreamPath === 'v1/recording-consents' || upstreamPath === 'v1/me/recording-consent') return MAX_AUTH_BODY_BYTES;
  if (upstreamPath === 'v1/me/usage-tracking') return MAX_AUTH_BODY_BYTES;
  if (upstreamPath.startsWith('v1/me/push-tokens')) return MAX_AUTH_BODY_BYTES;
  if (upstreamPath === 'v1/launch-notifications') return MAX_AUTH_BODY_BYTES;
  if (upstreamPath === 'v1/stt/stream-tickets') return MAX_AUTH_BODY_BYTES;
  if (upstreamPath === 'v1/completion-surveys') return MAX_COMPLETION_SURVEY_BODY_BYTES;
  if (upstreamPath === 'v1/auth/me/profile-image') return MAX_PROFILE_IMAGE_BODY_BYTES;
  if (AUTH_PATH_PREFIXES.some((prefix) => upstreamPath.startsWith(prefix))) return MAX_AUTH_BODY_BYTES;
  return MAX_TRANSCRIPTION_BODY_BYTES;
}

function failureResponse(status, code, safeDetail) {
  return Response.json(
    {
      ok: false,
      failure: {
        code,
        stage: 'upload',
        retryable: status >= 500,
        safeDetail,
      },
    },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-qstory-proxy': 'vercel',
      },
    },
  );
}

// Hostnames that can only ever resolve to something on the same physical machine as this proxy -
// loopback, plus the docker-compose service name the backend container is reachable at
// (docker-compose.yml at the repo root names it "backend"; container-to-container traffic on that
// bridge network never leaves the host, same trust boundary as literal loopback).
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', 'backend']);

function normalizedUpstreamUrl(value) {
  const normalized = value?.trim().replace(/\/+$/, '');
  if (!normalized) {
    return null;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol === 'https:') {
      return url;
    }
    // http is only ever safe to forward child voice data to on the local machine itself (e.g. a
    // Docker container or `./gradlew bootRun` backend during local dev) - never over a real network.
    return url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

// ---- 클라이언트 주소 전달(보안 점검 M1/M2) --------------------------------------------------------------
// 백엔드가 보는 연결 주소는 Vercel 쪽 주소 몇 개뿐이라 주소별 요청 상한이 모든 웹 이용자를 한 묶음으로 센다. 그래서 원래
// 주소를 x-qstory-client-ip로 넘기고, 백엔드와 나눠 가진 비밀(QSTORY_PROXY_SHARED_SECRET)로 서명한다 - 백엔드는 서명이
// 맞고 시각이 ±60초 안일 때만 그 주소를 믿는다(be ratelimit/ClientIpResolver.java). 비밀이 없으면 헤더를 붙이지 않는다.
//   x-qstory-proxy-ts:  유닉스 초
//   x-qstory-proxy-sig: hex(HMAC-SHA256(secret, ip + "\n" + ts))
const IP_LIKE = /^[0-9A-Fa-f:.]{2,45}$/;

/**
 * Vercel이 매 요청마다 덮어쓰는 x-real-ip / x-forwarded-for(첫 값)에서 클라이언트 주소를 읽는다. 브라우저가 보낸 같은 이름의
 * 헤더는 Vercel이 지운다. (Docker 진입점 container-server.mjs는 앞단 프록시가 이 헤더를 덮어쓴다고 가정한다.)
 */
export function clientIpOf(request) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && IP_LIKE.test(realIp)) return realIp;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded && IP_LIKE.test(forwarded)) return forwarded;
  return null;
}

export async function signClientIp(secret, ip, timestampSeconds) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(`${ip}\n${timestampSeconds}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---- 랜딩(qstory.ai.kr) 통계 CORS -----------------------------------------------------------------------
// 랜딩은 다른 출처라 자체 통계(landing_view·landing_cta_click)를 이 프록시로 보내려면 CORS가 필요하다. 백엔드의 운영
// 허용 출처에는 랜딩이 없으므로(직접 부르면 403) 이 프록시가 beta-events 한 경로에만 랜딩 출처를 허용한다.
// 프록시는 Origin을 백엔드로 넘기지 않으니(FORWARDED_HEADERS) 백엔드 CORS와 부딪히지 않는다.
export const LANDING_CORS_ORIGINS = new Set(['https://qstory.ai.kr', 'https://www.qstory.ai.kr']);
const LANDING_CORS_PATHS = new Set(['v1/beta-events']);

export function landingCorsHeaders(request, upstreamPath) {
  const origin = request.headers.get('origin');
  if (!origin || !LANDING_CORS_ORIGINS.has(origin) || !LANDING_CORS_PATHS.has(upstreamPath)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export function createQStoryProxy({
  upstreamUrl = process.env.QSTORY_API_UPSTREAM_URL,
  proxySecret = process.env.QSTORY_PROXY_SHARED_SECRET,
  fetchImpl = fetch,
  logger = console,
  now = () => Date.now(),
} = {}) {
  const upstream = normalizedUpstreamUrl(upstreamUrl);
  const secret = proxySecret?.trim() || null;

  return async function proxyQStoryRequest(request) {
    if (!upstream) {
      return failureResponse(
        503,
        'QSTORY_PROXY_NOT_CONFIGURED',
        '음성 처리 연결을 준비하지 못했어요.',
      );
    }

    const requestUrl = new URL(request.url);
    const startedAt = Date.now();
    const upstreamPath = (requestUrl.searchParams.get('path') ?? '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const corsHeaders = landingCorsHeaders(request, upstreamPath);
    if (request.method.toUpperCase() === 'OPTIONS') {
      return new Response(null, {
        status: corsHeaders ? 204 : 404,
        headers: { 'cache-control': 'no-store', 'x-qstory-proxy': 'vercel', ...(corsHeaders ?? {}) },
      });
    }
    if (
      upstreamPath.includes('..') ||
      !isAllowedRoute(request.method.toUpperCase(), upstreamPath)
    ) {
      return failureResponse(
        404,
        'QSTORY_PROXY_ROUTE_NOT_ALLOWED',
        '요청한 API 경로가 프록시 허용 목록에 없어요. (fe/api/_qstory-proxy-core.mjs)',
      );
    }

    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value) {
        headers.set(name, value);
      }
    }
    if (secret) {
      const clientIp = clientIpOf(request);
      if (clientIp) {
        const timestamp = Math.floor(now() / 1000);
        headers.set('x-qstory-client-ip', clientIp);
        headers.set('x-qstory-proxy-ts', String(timestamp));
        headers.set('x-qstory-proxy-sig', await signClientIp(secret, clientIp, timestamp));
      }
    }
    const isStreamingAudio = upstreamPath === 'v1/narrations/stream';
    headers.set('accept', isStreamingAudio ? 'audio/pcm' : 'application/json');

    const maxBodyBytes = maxBodyBytesFor(upstreamPath);
    const bodyTooLargeDetail =
      upstreamPath === 'v1/voice-research'
        ? '녹음이 30초 한도를 넘었어요. 짧게 다시 말해 주세요.'
        : '요청 데이터가 용량 제한을 넘었어요.';

    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const declaredLength = Number.parseInt(
        request.headers.get('content-length') ?? '',
        10,
      );
      if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
        return failureResponse(413, 'QSTORY_PROXY_BODY_TOO_LARGE', bodyTooLargeDetail);
      }
      body = await request.arrayBuffer();
      if (body.byteLength > maxBodyBytes) {
        return failureResponse(413, 'QSTORY_PROXY_BODY_TOO_LARGE', bodyTooLargeDetail);
      }
    }

    // "path" carries the routed segment; every other query param (status filters, etc. - see
    // entities/lesson/api/lesson-api.ts's listLessons) is the caller's actual query string and
    // must reach the backend, or filters silently no-op instead of erroring.
    const upstreamRequestUrl = new URL(`/${upstreamPath}`, upstream);
    for (const [key, value] of requestUrl.searchParams) {
      if (key === 'path') continue;
      upstreamRequestUrl.searchParams.append(key, value);
    }

    try {
      const response = await fetchImpl(
        upstreamRequestUrl,
        {
          method: request.method,
          headers,
          body,
          signal: request.signal,
        },
      );
      const contentType =
        response.headers.get('content-type') ??
        'application/json; charset=utf-8';
      // 그레텔 답 스트리밍(companion-chat/messages, stream:true)은 답 문장을 먼저 한 줄로 보낸다(NDJSON) -
      // 아래 clone().json()처럼 본문을 다 받을 때까지 기다리면 그 이점이 사라지므로 오디오 스트림처럼 그대로 흘려보낸다.
      const isStreamingBody =
        isStreamingAudio || contentType.includes('application/x-ndjson');
      const responseHeaders = new Headers({
        'cache-control': isStreamingBody
          ? 'no-store, no-transform'
          : 'no-store',
        'content-type': contentType,
        'x-qstory-proxy': 'vercel',
      });
      const requestId = response.headers.get('x-qstory-request-id');
      if (requestId) {
        responseHeaders.set('x-qstory-request-id', requestId);
      }
      // 요청 상한(429)에 걸렸을 때 언제 다시 해 볼지.
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        responseHeaders.set('retry-after', retryAfter);
      }
      for (const [name, value] of Object.entries(corsHeaders ?? {})) {
        responseHeaders.set(name, value);
      }
      if (isStreamingAudio) {
        for (const name of [
          'x-qstory-audio-sample-rate',
          'x-qstory-audio-channels',
          'x-qstory-audio-bit-depth',
          'x-qstory-generation-id',
        ]) {
          const value = response.headers.get(name);
          if (value) responseHeaders.set(name, value);
        }
      }
      let resultOk = null;
      let failureCode = null;
      if (!isStreamingBody) {
        try {
          const result = await response.clone().json();
          resultOk = typeof result?.ok === 'boolean' ? result.ok : null;
          // Speech routes use {failure:{code}}; beta-events/voice-research use {error} (edge-function shape).
          failureCode = result?.failure?.code ?? result?.error ?? null;
        } catch {
          // 비 JSON 응답도 그대로 전달하되 상태와 지연 시간은 기록한다.
        }
      }
      logger.info?.('[qstory-proxy]', {
        path: upstreamPath,
        status: response.status,
        ok: resultOk,
        failureCode,
        requestId,
        elapsedMs: Date.now() - startedAt,
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      if (request.signal.aborted) {
        return new Response(null, {
          status: 499,
          headers: {
            'cache-control': 'no-store',
            'x-qstory-proxy': 'vercel',
          },
        });
      }
      return failureResponse(
        502,
        'QSTORY_PROXY_UNREACHABLE',
        '음성 처리 서버에 연결하지 못했어요.',
      );
    }
  };
}
