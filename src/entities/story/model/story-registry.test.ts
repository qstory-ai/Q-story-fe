import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelStoryPackage } from '../hansel-gretel/manifest';
import generatedContent from '../hansel-gretel/generated-story-content.json';
import packageData from '../hansel-gretel/story-package.generated.json';
import {
  loadStoryPackage,
  refetchStoryPackage,
  describeStoryLoadFailure,
  StoryLoadError,
  DEFAULT_BETA_STORY_ID,
} from './story-registry';
import { buildStoryRuntimePackage } from './story-package';
import { setStoryAuthToken } from './story-auth';
import {
  fallbackFamilyId,
  rejoinAnchorId,
  speakerId,
  type RoutePlan,
} from '@/entities/story-runtime';

test('DEFAULT_BETA_STORY_ID matches the currently-authored story', () => {
  assert.equal(DEFAULT_BETA_STORY_ID, 'HG');
});

test('loadStoryPackage fetches the content endpoint, builds the runtime package, and caches it', async () => {
  const requestedUrls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    requestedUrls.push(String(input));
    return new Response(JSON.stringify({ generatedContent, packageData }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  const storyId = 'HG-registry-test';
  const first = await loadStoryPackage(storyId, {
    baseUrl: 'https://api.q-story.test',
    fetchImpl,
  });
  const second = await loadStoryPackage(storyId, {
    baseUrl: 'https://api.q-story.test',
    fetchImpl,
  });

  assert.equal(first.storyId, 'HG');
  assert.equal(second, first, 'a cached load must not re-fetch');
  assert.deepEqual(requestedUrls, [
    `https://api.q-story.test/v1/stories/${storyId}/content`,
  ]);
});

test('refetchStoryPackage bypasses the cache and replaces it, unlike loadStoryPackage', async () => {
  let requestCount = 0;
  const fetchImpl = (async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ generatedContent, packageData }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  const storyId = 'HG-refetch-test';
  const options = { baseUrl: 'https://api.q-story.test', fetchImpl };
  const first = await loadStoryPackage(storyId, options);
  assert.equal(requestCount, 1, 'the first load hits the network once');

  const cachedAgain = await loadStoryPackage(storyId, options);
  assert.equal(cachedAgain, first, 'loadStoryPackage still serves from cache');
  assert.equal(requestCount, 1);

  // live-branch READY 뒤(use-one-story-runtime.ts) 이걸로 강제 재조회한다 - 캐시를 무시하고
  // 다시 네트워크를 태워야 새로 커밋된 family/segment/asset을 받아올 수 있다.
  const refetched = await refetchStoryPackage(storyId, options);
  assert.equal(requestCount, 2, 'refetchStoryPackage always hits the network');
  assert.equal(refetched.storyId, 'HG');

  // 재조회 이후의 loadStoryPackage 호출은 새로 채워진 캐시 항목을 반환해야 한다.
  const cachedAfterRefetch = await loadStoryPackage(storyId, options);
  assert.equal(cachedAfterRefetch, refetched);
  assert.equal(requestCount, 2);
});

test('loadStoryPackage rejects on a non-ok response and does not poison the cache', async () => {
  const storyId = 'HG-registry-error-test';
  const failingFetch = (async () => new Response('server error', { status: 500 })) as typeof fetch;
  await assert.rejects(() =>
    loadStoryPackage(storyId, { baseUrl: 'https://api.q-story.test', fetchImpl: failingFetch }),
  );

  const succeedingFetch = (async () =>
    new Response(JSON.stringify({ generatedContent, packageData }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  const retried = await loadStoryPackage(storyId, {
    baseUrl: 'https://api.q-story.test',
    fetchImpl: succeedingFetch,
  });
  assert.equal(retried.storyId, 'HG');
});

test('a failure envelope becomes the message the load screen shows, not a generic HTTP string', async () => {
  const failingFetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        failure: {
          code: 'STORY_NOT_REGISTERED',
          stage: 'upload',
          retryable: false,
          safeDetail: '요청한 작품이 등록되어 있지 않아요.',
        },
      }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  await assert.rejects(
    () =>
      loadStoryPackage('HG-envelope-test', {
        baseUrl: 'https://api.q-story.test',
        fetchImpl: failingFetch,
      }),
    (error: unknown) => {
      assert.ok(error instanceof StoryLoadError);
      assert.equal(error.message, '요청한 작품이 등록되어 있지 않아요.');
      assert.equal(error.code, 'STORY_NOT_REGISTERED');
      assert.equal(error.status, 404);
      assert.equal(error.retryable, false);
      return true;
    },
  );
});

test('a non-JSON failure falls back to the status, and 5xx stays retryable', async () => {
  const failingFetch = (async () => new Response('gateway exploded', { status: 502 })) as typeof fetch;

  await assert.rejects(
    () =>
      loadStoryPackage('HG-non-json-test', {
        baseUrl: 'https://api.q-story.test',
        fetchImpl: failingFetch,
      }),
    (error: unknown) => {
      assert.ok(error instanceof StoryLoadError);
      assert.equal(error.message, '이야기를 불러오지 못했어요. (HTTP 502)');
      assert.equal(error.code, undefined);
      assert.equal(error.retryable, true);
      return true;
    },
  );
});

test('describeStoryLoadFailure blames the connection only when the request never reached the backend', () => {
  const offline = describeStoryLoadFailure(new TypeError('Failed to fetch'));
  assert.equal(offline.message, '인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
  assert.equal(offline.retryable, true);
  assert.equal(offline.code, undefined);

  const fromBackend = describeStoryLoadFailure(
    new StoryLoadError('요청한 작품이 등록되어 있지 않아요.', 'STORY_NOT_REGISTERED', 404, false),
  );
  assert.deepEqual(fromBackend, {
    message: '요청한 작품이 등록되어 있지 않아요.',
    code: 'STORY_NOT_REGISTERED',
    retryable: false,
  });
});

test('runtime package owns manifest, fallback, assets, and report copy', () => {
  const storyPackage = hanselGretelStoryPackage;
  assert.equal(storyPackage.storyId, 'HG');
  assert.equal(storyPackage.availability, 'BETA');

  const [anchorA, anchorB, anchorC] = storyPackage.manifest.questionAnchors;
  // Q-30 최종 원고: 기본 분기 없이 질문만 하면 기본 이야기로 이어 가고, B는 대화만 한다.
  assert.ok(storyPackage.manifest.questionAnchors.every((anchor) => anchor.defaultFallbackFamilyId === null));
  assert.equal(anchorB.sceneId, 'HG-F05');
  assert.deepEqual(anchorB.fallbackFamilyIds, []);
  assert.deepEqual(anchorA.fallbackFamilyIds, ['A_OBSERVE_BIRD', 'A_SPEAK_TO_BIRD']);
  assert.deepEqual(anchorC.fallbackFamilyIds, ['C_WAIT_FOR_WITCH_TURN', 'C_DISTRACT_AND_TAKE_KEYS']);
  assert.ok(storyPackage.illustrationForAssetId('old-woman-door'));
  assert.equal(
    storyPackage.reportCopy.anchors[anchorB.id]?.sceneTitle,
    '과자집 문 앞',
  );
});

test('runtime repairs a stale server plan that offers a family without its prerequisite', () => {
  // HG 최종 원고에는 선행 조건이 있는 분기가 없어서, 같은 데이터에 선행 조건만 더한 사본으로 검증한다.
  const gatedPackageData = structuredClone(packageData);
  const gatedFamily = gatedPackageData.routeContext.anchors['HG-Q-C'].actionFamilies.find(
    (family) => family.id === 'C_DISTRACT_AND_TAKE_KEYS',
  );
  assert.ok(gatedFamily);
  (gatedFamily as { requiresPriorFamilyIds?: string[] }).requiresPriorFamilyIds = ['A_SPEAK_TO_BIRD'];
  const storyPackage = buildStoryRuntimePackage({
    generatedContent: generatedContent as Parameters<typeof buildStoryRuntimePackage>[0]['generatedContent'],
    packageData: gatedPackageData as Parameters<typeof buildStoryRuntimePackage>[0]['packageData'],
    imageAssets: hanselGretelStoryPackage.imageAssets,
    audioAssets: hanselGretelStoryPackage.audioAssets,
  });
  const plan: RoutePlan = {
    kind: 'route',
    route: 'DIRECT_ACTION',
    childRelevantMeaning: '헨젤이 마녀를 부르는 동안 열쇠를 가져온다',
    coverageStatus: 'exact',
    coverageReason: 'test',
    text: '좋아, 헨젤이 마녀를 부르는 동안 내가 열쇠를 가져올게.',
    speakerId: speakerId('HG-SPK-GRETEL'),
    actionFamilyId: fallbackFamilyId('C_DISTRACT_AND_TAKE_KEYS'),
    rejoinAt: rejoinAnchorId('HG-F07-KEYS-TAKEN'),
    fallbackFamilyId: fallbackFamilyId('C_DISTRACT_AND_TAKE_KEYS'),
    options: [],
    versions: {
      modelId: 'test',
      promptVersion: 'test',
      storyManifestVersion: 'test',
      routePolicyVersion: 'test',
    },
  };

  const withoutPrior = storyPackage.repairRoutePlanForHistory('HG-Q-C', plan, ['A_OBSERVE_BIRD']);
  assert.equal(withoutPrior.actionFamilyId, 'C_WAIT_FOR_WITCH_TURN');
  assert.equal(withoutPrior.fallbackFamilyId, 'C_WAIT_FOR_WITCH_TURN');
  assert.equal(withoutPrior.rejoinAt, 'HG-F07-KEYS-TAKEN');

  const withPrior = storyPackage.repairRoutePlanForHistory('HG-Q-C', plan, ['A_SPEAK_TO_BIRD']);
  assert.equal(withPrior, plan);
});

test('loadStoryPackage sends the signed-in token so entitlement-gated stories are not refused (Q-33)', async () => {
  const authHeaders: (string | null)[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    authHeaders.push(new Headers(init?.headers).get('Authorization'));
    return new Response(
      JSON.stringify({ ok: false, failure: { code: 'STORY_ENTITLEMENT_REQUIRED', safeDetail: '이 이야기는 이용권이 있어야 열려요.', retryable: false } }),
      { status: 402, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  setStoryAuthToken('signed-in-token');
  try {
    await assert.rejects(loadStoryPackage('HG-auth-test', { baseUrl: 'https://api.q-story.test', fetchImpl }), (error: unknown) => {
      const failure = describeStoryLoadFailure(error);
      assert.equal(failure.message, '이 이야기는 이용권이 있어야 열려요.');
      assert.equal(failure.retryable, false);
      return true;
    });
  } finally {
    setStoryAuthToken(null);
  }
  assert.deepEqual(authHeaders, ['Bearer signed-in-token']);
});
