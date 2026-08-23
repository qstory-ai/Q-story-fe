const ALLOWED_ROUTES = new Map([
  ['GET health', true],
  ['POST v1/transcriptions/base64', true],
  ['POST v1/questions/route', true],
  ['POST v1/narrations', true],
  ['POST v1/narrations/stream', true],
  ['POST v1/beta-events', true],
  ['POST v1/voice-research', true],
  ['POST v1/auth/signup/director', true],
  ['POST v1/auth/login', true],
  ['GET v1/auth/me', true],
  ['POST v1/organizations', true],
  ['POST v1/classes/join', true],
]);

// Routes with a path segment (story/org/class id) that can't be listed as a literal above.
const UUID_SEGMENT = '[0-9a-fA-F-]{36}';
const DYNAMIC_ROUTES = [
  { method: 'GET', pattern: /^v1\/stories\/[A-Za-z0-9_-]{1,64}\/content$/ },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/entitlement$`) },
  { method: 'POST', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/classes$`) },
  { method: 'GET', pattern: new RegExp(`^v1/organizations/${UUID_SEGMENT}/classes$`) },
  { method: 'GET', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}$`) },
  { method: 'POST', pattern: new RegExp(`^v1/classes/${UUID_SEGMENT}/invites$`) },
];

function isAllowedRoute(method, upstreamPath) {
  if (ALLOWED_ROUTES.has(`${method} ${upstreamPath}`)) return true;
  return DYNAMIC_ROUTES.some((route) => route.method === method && route.pattern.test(upstreamPath));
}

const FORWARDED_HEADERS = [
  'content-type',
  'authorization',
  'x-qstory-story-id',
  'x-qstory-scene-id',
  'x-qstory-anchor-id',
  'x-qstory-question-round',
];
const MAX_RAW_AUDIO_BYTES = Math.floor(2.5 * 1024 * 1024);
// Base64 JSON audio upload inflates the raw bytes by ~4/3.
const MAX_TRANSCRIPTION_BODY_BYTES = Math.ceil(MAX_RAW_AUDIO_BYTES / 3) * 4 + 4_096;
// Matches voice-research/index.ts's MAX_REQUEST_BYTES (raw multipart, not base64-inflated).
const MAX_VOICE_RESEARCH_BODY_BYTES = 4 * 1024 * 1024;
// Matches BetaEventController's own payload cap.
const MAX_BETA_EVENT_BODY_BYTES = 8_192;
// Auth/org/class bodies are small JSON structs (email/password/names), never audio-sized.
const MAX_AUTH_BODY_BYTES = 8_192;
const AUTH_PATH_PREFIXES = ['v1/auth/', 'v1/organizations', 'v1/classes'];

function maxBodyBytesFor(upstreamPath) {
  if (upstreamPath === 'v1/voice-research') return MAX_VOICE_RESEARCH_BODY_BYTES;
  if (upstreamPath === 'v1/beta-events') return MAX_BETA_EVENT_BODY_BYTES;
  if (AUTH_PATH_PREFIXES.some((prefix) => upstreamPath.startsWith(prefix))) return MAX_AUTH_BODY_BYTES;
  return MAX_TRANSCRIPTION_BODY_BYTES;
}

const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/webm',
]);

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

function decodeAudioUpload(body) {
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return {
      response: failureResponse(
        400,
        'QSTORY_PROXY_INVALID_AUDIO_UPLOAD',
        '녹음 데이터를 읽지 못했어요.',
      ),
    };
  }

  const audioBase64 = String(value?.audioBase64 ?? '').trim();
  const mimeType = String(value?.mimeType ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (
    !audioBase64 ||
    audioBase64.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(audioBase64) ||
    !SUPPORTED_AUDIO_TYPES.has(mimeType)
  ) {
    return {
      response: failureResponse(
        400,
        'QSTORY_PROXY_INVALID_AUDIO_UPLOAD',
        '녹음 데이터가 비어 있거나 손상됐어요.',
      ),
    };
  }

  const audio = Buffer.from(audioBase64, 'base64');
  if (audio.byteLength === 0) {
    return {
      response: failureResponse(
        400,
        'QSTORY_PROXY_INVALID_AUDIO_UPLOAD',
        '녹음 데이터가 비어 있어요.',
      ),
    };
  }
  if (audio.byteLength > MAX_RAW_AUDIO_BYTES) {
    return {
      response: failureResponse(
        413,
        'QSTORY_PROXY_AUDIO_TOO_LARGE',
        '녹음이 30초 한도를 넘었어요. 짧게 다시 말해 주세요.',
      ),
    };
  }
  return { audio, mimeType };
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

    let resolvedUpstreamPath = upstreamPath;
    if (upstreamPath === 'v1/transcriptions/base64') {
      const decoded = decodeAudioUpload(body);
      if (decoded.response) {
        return decoded.response;
      }
      resolvedUpstreamPath = 'v1/transcriptions';
      body = decoded.audio;
      headers.set('content-type', decoded.mimeType);
    }

    try {
      const response = await fetchImpl(
        new URL(`/${resolvedUpstreamPath}`, upstream),
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
