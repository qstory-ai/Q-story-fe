import assert from 'node:assert/strict';
import test from 'node:test';

import { hanselGretelStoryPackage } from '../hansel-gretel/manifest';
import generatedContent from '../hansel-gretel/generated-story-content.json';
import packageData from '../hansel-gretel/story-package.generated.json';
import { loadStoryPackage, DEFAULT_BETA_STORY_ID } from './story-registry';
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
  assert.ok(storyPackage.illustrationForAssetId('HG-ART-10-OLD-WOMAN-DOOR'));
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
