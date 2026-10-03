// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  questionAnchorId,
  type RouteOption,
} from '@/entities/story-runtime';

import {
  buildParentReport,
  buildRecentApproachTrend,
  hasExperiencedStoryAgency,
} from './parent-report';
import { hanselGretelStoryPackage } from '@/entities/story/hansel-gretel/manifest';

const storyPackage = hanselGretelStoryPackage;
const reportCopy = storyPackage.reportCopy;

test('parent report summarizes meaning without storing the transcript', () => {
  const report = buildParentReport(reportCopy,
    [
      {
        anchorId: questionAnchorId('HG-Q-A'),
        childRelevantMeaning: '하얀 새에게 길을 물어보고 싶다.',
        route: 'DIRECT_ACTION',
        responseText: '좋아. 새에게 물어보자.',
      },
    ],
    { durationSeconds: 305 },
  );

  assert.match(report.participationSummary, /1개의 장면/);
  assert.equal(report.questionCount, 1);
  assert.equal(report.changedSceneCount, 1);
  assert.equal(report.durationSeconds, 305);
  assert.equal(report.questionRecords.length, 1);
  assert.equal(
    report.questionRecords[0].imageRef.assetId,
    'white-bird-leads',
  );
  assert.equal(report.questionRecords[0].imageRef.kind, 'FIXED_STORY_ASSET');
  assert.match(report.questionRecords[0].questionTypeLabel, /행동/);
  assert.deepEqual(report.curiosityTopics, ['자꾸 돌아보는 하얀 새 관찰하기']);
  assert.match(report.changedMoments[0], /실제 행동/);
  assert.match(report.coachObservation, /1개 질문 장면/);
  assert.match(report.coachEvidence[0], /하얀 새/);
  assert.equal(report.togetherActivity.title, '3분 함께하기');
  assert.equal(report.followUpQuestions.length, 3);
  assert.equal(JSON.stringify(report).includes('원본 전사'), false);
});

test('selected path becomes the changed moment', () => {
  const selectedOption: Pick<
    RouteOption,
    'label' | 'meaning' | 'actionFamilyId'
  > = {
    label: '헨젤이 마녀 부르기',
    meaning: '헨젤이 마녀를 부르는 동안 그레텔이 열쇠를 가져온다.',
    actionFamilyId: 'C_DISTRACT_AND_TAKE_KEYS',
  };
  const report = buildParentReport(
    reportCopy,
    [
      {
        anchorId: questionAnchorId('HG-Q-C'),
        childRelevantMeaning: '헨젤이 마녀를 부르는 동안 열쇠를 가져오자.',
        route: 'DIRECT_ACTION',
        responseText: '좋아, 헨젤이 마녀를 부르는 동안 내가 열쇠를 가져올게.',
        actionFamilyId: 'C_DISTRACT_AND_TAKE_KEYS',
        selectedOption,
      },
    ],
    {
      branchAssetId: storyPackage.branchIllustrationAssetId,
      branchSummary: storyPackage.branchReportSummary,
    },
  );

  assert.match(report.changedMoments[0], /마녀를 부르는/);
  assert.equal(
    report.questionRecords[0].selectedPathTitle,
    '헨젤이 마녀 부르기',
  );
  assert.match(
    report.questionRecords[0].selectedPathSummary,
    /열쇠를 가져온다/,
  );
  assert.equal(
    report.questionRecords[0].imageRef.kind,
    'GENERATED_BRANCH_ASSET',
  );
  assert.equal(
    report.questionRecords[0].imageRef.assetId,
    'c-distract-and-take-keys-01',
  );
  assert.match(
    report.questionRecords[0].storyDevelopmentSummary,
    /시선을 돌린 사이/,
  );
  assert.match(report.coachEvidence[0], /헨젤이 마녀 부르기/);
  assert.match(report.coachInterpretations[0], /함께 움직일 방법/);
  assert.match(report.followUpQuestions[0], /그레텔과 헨젤이 함께/);
});

test('question-free completion still produces a non-evaluative report', () => {
  const report = buildParentReport(reportCopy, []);

  assert.match(report.participationSummary, /질문을 건너뛰고/);
  assert.equal(report.questionCount, 0);
  assert.equal(report.changedSceneCount, 0);
  assert.equal(report.questionRecords.length, 0);
  assert.match(report.coachObservation, /차분히 따라갔어요/);
  assert.deepEqual(report.coachEvidence, []);
  assert.equal(report.followUpQuestions.length, 3);
  assert.equal(JSON.stringify(report).includes('점수'), false);
  assert.equal(JSON.stringify(report).includes('평가'), false);
});

test('three question records produce one follow-up per story anchor', () => {
  const report = buildParentReport(
    reportCopy,
    [
      {
        anchorId: questionAnchorId('HG-Q-A'),
        childRelevantMeaning: '새가 보는 방향이 궁금하다.',
        route: 'DIRECT_ACTION',
        responseText: '새를 살펴보자.',
        actionFamilyId: 'A_OBSERVE_BIRD',
      },
      {
        anchorId: questionAnchorId('HG-Q-B'),
        childRelevantMeaning: '할머니가 누구인지 궁금하다.',
        route: 'ANSWER_RESUME',
        responseText: '이 집에서 나온 할머니야. 우리도 처음 만났어.',
      },
      {
        anchorId: questionAnchorId('HG-Q-C'),
        childRelevantMeaning: '마녀가 등을 돌릴 때까지 기다리자.',
        route: 'DIRECT_ACTION',
        responseText: '좋아, 마녀가 등을 돌릴 때까지 조용히 기다려 볼게.',
        actionFamilyId: 'C_WAIT_FOR_WITCH_TURN',
      },
    ],
    {
      branchAssetId: storyPackage.branchIllustrationAssetId,
      branchSummary: storyPackage.branchReportSummary,
    },
  );

  assert.equal(report.coachEvidence.length, 3);
  // B는 대화만 해서 분기 전략이 없고, A·C가 같은 '관찰하고 확인하기' 전략이다.
  assert.match(report.coachInterpretations[0], /2개 장면/);
  assert.match(report.followUpQuestions[0], /하얀 새/);
  assert.match(report.followUpQuestions[1], /처음 만난 사람/);
  assert.match(report.followUpQuestions[2], /그레텔/);
});

test('agency experience requires an actual action route or a selected path', () => {
  assert.equal(
    hasExperiencedStoryAgency([
      {
        anchorId: questionAnchorId('HG-Q-A'),
        childRelevantMeaning: '새가 어디로 가는지 궁금하다.',
        route: 'ANSWER_RESUME',
        responseText: '새를 좀 더 지켜보자.',
      },
    ]),
    false,
  );
  assert.equal(
    hasExperiencedStoryAgency([
      {
        anchorId: questionAnchorId('HG-Q-C'),
        childRelevantMeaning: '열쇠를 가져올 방법을 고른다.',
        route: 'THREE_PATHS',
        responseText: '다음 행동을 골라 보자.',
        selectedOption: {
          label: '등 돌릴 때 기다리기',
          meaning: '마녀가 다른 곳을 볼 때까지 기다렸다가 열쇠를 가져온다.',
        },
      },
    ]),
    true,
  );
});

test('recent approach trend surfaces a strategy repeated across sessions', () => {
  const checkKeysOutcome = {
    anchorId: questionAnchorId('HG-Q-C'),
    childRelevantMeaning: '마녀가 어디를 보는지 살피며 기다린다.',
    route: 'DIRECT_ACTION' as const,
    responseText: '마녀가 등을 돌릴 때까지 기다려 보자.',
    actionFamilyId: 'C_WAIT_FOR_WITCH_TURN',
  };
  const markExitOutcome = {
    anchorId: questionAnchorId('HG-Q-C'),
    childRelevantMeaning: '헨젤이 마녀를 부른다.',
    route: 'DIRECT_ACTION' as const,
    responseText: '헨젤이 마녀를 부르는 동안 가져오자.',
    actionFamilyId: 'C_DISTRACT_AND_TAKE_KEYS',
  };
  const noQuestionOutcome = {
    anchorId: questionAnchorId('HG-Q-A'),
    childRelevantMeaning: '이야기를 계속 듣는다.',
    route: 'SKIP_CONTINUE' as const,
    responseText: '',
  };

  const trend = buildRecentApproachTrend([
    { storyId: 'HG', outcomes: [checkKeysOutcome] },
    { storyId: 'HG', outcomes: [checkKeysOutcome, markExitOutcome] },
    { storyId: 'HG', outcomes: [noQuestionOutcome] },
  ], { HG: reportCopy });

  assert.equal(trend.sessionCount, 3);
  assert.equal(trend.questionSessionCount, 2);
  assert.deepEqual(trend.repeatedApproach, { label: '단서를 관찰하고 확인하기', count: 2 });
  assert.deepEqual(trend.otherApproaches, ['함께 움직일 방법 정하기']);
});

test('recent approach trend has no repeated approach when nothing recurs', () => {
  const trend = buildRecentApproachTrend([
    {
      storyId: 'HG',
      outcomes: [
        {
          anchorId: questionAnchorId('HG-Q-A'),
          childRelevantMeaning: '새를 관찰한다.',
          route: 'DIRECT_ACTION' as const,
          responseText: '새를 지켜보자.',
          actionFamilyId: 'A_OBSERVE_BIRD',
        },
      ],
    },
    { storyId: 'HG', outcomes: [] },
  ], { HG: reportCopy });

  assert.equal(trend.sessionCount, 2);
  assert.equal(trend.questionSessionCount, 1);
  assert.equal(trend.repeatedApproach, null);
  assert.deepEqual(trend.otherApproaches, ['단서를 관찰하고 확인하기']);
});

test('a record saved under a retired branch still builds a report from the story image', () => {
  // Q-30 이전 판본의 완료 기록에는 지금은 없는 분기 id가 남아 있다 - 리포트는 깨지지 않고
  // 그 장면의 고정 삽화와 일반 문구로 보여 준다.
  const report = buildParentReport(
    reportCopy,
    [
      {
        anchorId: questionAnchorId('HG-Q-B'),
        childRelevantMeaning: '한 걸음 물러나 출구를 표시한다.',
        route: 'DIRECT_ACTION',
        responseText: '출구 표시부터 하자.',
        actionFamilyId: 'B_STEP_BACK_MARK_EXIT',
      },
    ],
    {
      branchAssetId: storyPackage.branchIllustrationAssetId,
      branchSummary: storyPackage.branchReportSummary,
    },
  );

  assert.equal(report.questionRecords.length, 1);
  assert.equal(report.questionRecords[0].imageRef.kind, 'FIXED_STORY_ASSET');
  assert.equal(report.questionRecords[0].imageRef.assetId, 'old-woman-door');
});
