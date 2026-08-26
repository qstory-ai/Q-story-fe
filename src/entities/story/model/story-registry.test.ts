import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelStoryPackage } from '../hansel-gretel/manifest';
import generatedContent from '../hansel-gretel/generated-story-content.json';
import packageData from '../hansel-gretel/story-package.generated.json';
import {
  loadStoryPackage,
  describeStoryLoadFailure,
  StoryLoadError,
  DEFAULT_BETA_STORY_ID,
} from './story-registry';
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

  const anchor = storyPackage.manifest.questionAnchors[1];
  const fallback = storyPackage.manifest.fallbackFamilies.find(
    (family) => family.id === anchor.defaultFallbackFamilyId,
  );

  assert.equal(anchor.sceneId, 'HG-F05');
  assert.equal(fallback?.id, 'B_CHECK_KEYS');
  assert.ok(storyPackage.illustrationForAssetId('old-woman-door'));
  assert.equal(
    storyPackage.reportCopy.anchors[anchor.id]?.sceneTitle,
    '과자집 문 앞',
  );
});

test('runtime repairs a stale server plan that offers a family without its prerequisite', () => {
  const storyPackage = hanselGretelStoryPackage;
  const plan: RoutePlan = {
    kind: 'route',
    route: 'THREE_PATHS',
    childRelevantMeaning: '안전하게 빠져나가는 방법',
    coverageStatus: 'partial',
    coverageReason: 'test',
    text: '안전한 방법을 골라 보자.',
    speakerId: speakerId('HG-SPK-GRETEL'),
    actionFamilyId: null,
    rejoinAt: rejoinAnchorId('HG-F07-DEMONSTRATION'),
    fallbackFamilyId: fallbackFamilyId('C_USE_SIGNAL'),
    options: [
      {
        id: 'OPTION_1',
        label: '시범 요청하기',
        meaning: '먼저 시범을 요청한다.',
        actionFamilyId: fallbackFamilyId('C_ASK_DEMONSTRATION'),
        branchLine: '먼저 시범을 보여달라고 부탁해보자.',
      },
      {
        id: 'OPTION_2',
        label: '신호 보내기',
        meaning: '앞에서 정한 신호를 사용한다.',
        actionFamilyId: fallbackFamilyId('C_USE_SIGNAL'),
        branchLine: '우리가 정한 신호를 보내보자.',
      },
      {
        id: 'OPTION_3',
        label: '자물쇠 살피기',
        meaning: '멀리서 자물쇠를 살핀다.',
        actionFamilyId: fallbackFamilyId('C_CHECK_LOCK_FROM_DISTANCE'),
        branchLine: '멀리서 자물쇠를 조심히 살펴보자.',
      },
    ],
    versions: {
      modelId: 'test',
      promptVersion: 'test',
      storyManifestVersion: 'test',
      routePolicyVersion: 'test',
    },
  };

  const withoutSignal = storyPackage.repairRoutePlanForHistory(
    'HG-Q-C',
    plan,
    ['B_CHECK_KEYS'],
  );
  assert.equal(withoutSignal.options.length, 3);
  assert.ok(
    withoutSignal.options.every(
      (option) => option.actionFamilyId !== 'C_USE_SIGNAL',
    ),
  );
  assert.notEqual(withoutSignal.fallbackFamilyId, 'C_USE_SIGNAL');

  const withSignal = storyPackage.repairRoutePlanForHistory(
    'HG-Q-C',
    plan,
    ['B_MAKE_SIBLING_SIGNAL'],
  );
  assert.equal(withSignal, plan);
});
