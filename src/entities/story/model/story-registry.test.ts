import assert from 'node:assert/strict';
import test from 'node:test';

import { getDefaultBetaStory, getStoryPackage } from './story-registry';
import {
  fallbackFamilyId,
  rejoinAnchorId,
  speakerId,
  type RoutePlan,
} from '@/entities/story-runtime';

test('registry returns the current beta package and rejects unknown stories', () => {
  const storyPackage = getDefaultBetaStory();
  assert.equal(storyPackage.storyId, 'HG');
  assert.equal(storyPackage.availability, 'BETA');
  assert.equal(getStoryPackage(storyPackage.storyId), storyPackage);
  assert.equal(getStoryPackage('NOT-REGISTERED'), null);
});

test('runtime package owns manifest, fallback, assets, and report copy', () => {
  const storyPackage = getDefaultBetaStory();
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
  const storyPackage = getDefaultBetaStory();
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
      },
      {
        id: 'OPTION_2',
        label: '신호 보내기',
        meaning: '앞에서 정한 신호를 사용한다.',
        actionFamilyId: fallbackFamilyId('C_USE_SIGNAL'),
      },
      {
        id: 'OPTION_3',
        label: '자물쇠 살피기',
        meaning: '멀리서 자물쇠를 살핀다.',
        actionFamilyId: fallbackFamilyId('C_CHECK_LOCK_FROM_DISTANCE'),
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
