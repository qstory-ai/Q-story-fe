const ALLOWED_ROUTES = new Map([
  ['GET health', true],
  ['POST v1/transcriptions/base64', true],
  ['POST v1/questions/route', true],
  ['POST v1/narrations', true],
  ['POST v1/narrations/stream', true],
  ['POST v1/beta-events', true],
  ['POST v1/voice-research', true],
  ['POST v1/voice-research/withdraw', true],
  ['POST v1/companion-chat/messages', true],
  ['POST v1/companion-chat/transcriptions/base64', true],
  ['POST v1/auth/signup/organization', true],
  ['POST v1/auth/login', true],
  ['GET v1/auth/me', true],
  ['POST v1/auth/password-reset/request', true],
  ['POST v1/auth/password-reset/confirm', true],
  ['POST v1/organizations', true],
  ['POST v1/classes/join', true],
  ['POST v1/launch-notifications', true],
  ['POST v1/completion-surveys', true],
  ['GET v1/stories', true],
  ['POST v1/story-completions', true],
  ['GET v1/story-completions', true],
]);

// Routes with a path segment (story/org/class/scene/segment id) that can't be listed as a literal above.
const UUID_SEGMENT = '[0-9a-fA-F-]{36}';
const STORY_ID_SEGMENT = '[A-Za-z0-9_-]{1,64}';
const DYNAMIC_ROUTES = [
  { method: 'GET', pattern: /^v1\/stories\/[A-Za-z0-9_-]{1,64}\/content$/ },
  { method: 'GET', pattern: new RegExp(`^v1/stories/${STORY_ID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/story-completions/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/entitlement$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/classes$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/classes$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}$`) },
  { method: 'POST', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/invites$`) },
  // Staff CMS (story-admin-api.ts) - storyId/sceneId are content ids, segmentId is a UUID.
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

function isAllowedRoute(method, upstreamPath) {
  if (ALLOWED_ROUTES.has(`${method} ${upstreamPath}`)) return true;
  return DYNAMIC_ROUTES.some((route) => route.method === method && route.pattern.test(upstreamPath));
}

// 리소스 컨텍스트(storyId/sceneId/anchorId/questionRound)는 모든 라우트가 JSON body로
// 받는다 - 예전엔 x-qstory-* 헤더로 전달하는 라우트도 있었지만, 그 라우트들(/v1/transcriptions,
// /v1/questions)은 애초에 이 프록시의 화이트리스트에 없었거나(raw 바이너리 업로드는 이 프록시를
// 안 탄다) 지금은 body 기반으로 옮겨져서, 이 프록시가 전달해야 할 커스텀 컨텍스트 헤더가 없다.
const FORWARDED_HEADERS = ['content-type', 'authorization'];
const MAX_RAW_AUDIO_BYTES = Math.floor(2.5 * 1024 * 1024);
// Base64 JSON audio upload inflates the raw bytes by ~4/3.
const MAX_TRANSCRIPTION_BODY_BYTES = Math.ceil(MAX_RAW_AUDIO_BYTES / 3) * 4 + 4_096;
// Matches voice-research/index.ts's MAX_REQUEST_BYTES (raw multipart, not base64-inflated).
const MAX_VOICE_RESEARCH_BODY_BYTES = 4 * 1024 * 1024;
// Matches BetaEventController's own payload cap.
const MAX_BETA_EVENT_BODY_BYTES = 8_192;
// Auth/org/class bodies are small JSON structs (email/password/names), never audio-sized.
const MAX_AUTH_BODY_BYTES = 8_192;
// Two optional free-text fields (topPriority/oneLineReview, 500 chars each server-side) plus
// checkbox arrays and a contact field can add up past MAX_AUTH_BODY_BYTES in the worst case.
const MAX_COMPLETION_SURVEY_BODY_BYTES = 16_384;
const AUTH_PATH_PREFIXES = ['v1/auth/', 'v1/organizations', 'v1/classes'];

function maxBodyBytesFor(upstreamPath) {
  if (upstreamPath === 'v1/voice-research') return MAX_VOICE_RESEARCH_BODY_BYTES;
  if (upstreamPath === 'v1/beta-events') return MAX_BETA_EVENT_BODY_BYTES;
  if (upstreamPath === 'v1/launch-notifications') return MAX_AUTH_BODY_BYTES;
  if (upstreamPath === 'v1/completion-surveys') return MAX_COMPLETION_SURVEY_BODY_BYTES;
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

export function createQStoryProxy({
  upstreamUrl = process.env.QSTORY_API_UPSTREAM_URL,
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const upstream = normalizedUpstreamUrl(upstreamUrl);

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
    if (
      upstreamPath.includes('..') ||
      !isAllowedRoute(request.method.toUpperCase(), upstreamPath)
    ) {
      return failureResponse(
        404,
        'QSTORY_PROXY_ROUTE_NOT_ALLOWED',
        '요청한 음성 처리 경로를 찾지 못했어요.',
      );
    }

    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value) {
        headers.set(name, value);
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

    try {
      const response = await fetchImpl(
        new URL(`/${upstreamPath}`, upstream),
        {
          method: request.method,
          headers,
          body,
          signal: request.signal,
        },
      );
      const responseHeaders = new Headers({
        'cache-control': isStreamingAudio
          ? 'no-store, no-transform'
          : 'no-store',
        'content-type':
          response.headers.get('content-type') ??
          'application/json; charset=utf-8',
        'x-qstory-proxy': 'vercel',
      });
      const requestId = response.headers.get('x-qstory-request-id');
      if (requestId) {
        responseHeaders.set('x-qstory-request-id', requestId);
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
      if (!isStreamingAudio) {
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
