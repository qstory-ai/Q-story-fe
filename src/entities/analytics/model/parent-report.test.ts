// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  questionAnchorId,
  type RouteOption,
} from '@/entities/story-runtime';

import {
  buildParentReport,
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
  assert.deepEqual(report.curiosityTopics, ['하얀 새의 행동과 길 찾기']);
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
    label: '출구 표시하기',
    meaning: '한 걸음 물러나 안전한 출구 위치를 표시한다.',
    actionFamilyId: 'B_STEP_BACK_MARK_EXIT',
  };
  const report = buildParentReport(
    reportCopy,
    [
      {
        anchorId: questionAnchorId('HG-Q-B'),
        childRelevantMeaning: '어떻게 안전을 확인할지 궁금하다.',
        route: 'THREE_PATHS',
        responseText: '세 가지 방법 중 하나를 골라 보자.',
        actionFamilyId: 'B_STEP_BACK_MARK_EXIT',
        selectedOption,
      },
    ],
    {
      branchAssetId: storyPackage.branchIllustrationAssetId,
      branchSummary: storyPackage.branchReportSummary,
    },
  );

  assert.match(report.changedMoments[0], /출구 위치를 표시/);
  assert.equal(
    report.questionRecords[0].selectedPathTitle,
    '출구 표시하기',
  );
  assert.match(
    report.questionRecords[0].selectedPathSummary,
    /안전한 출구/,
  );
  assert.equal(
    report.questionRecords[0].imageRef.kind,
    'GENERATED_BRANCH_ASSET',
  );
  assert.equal(
    report.questionRecords[0].imageRef.assetId,
    'b-step-back-mark-exit-01',
  );
  assert.match(
    report.questionRecords[0].storyDevelopmentSummary,
    /과자집 주위/,
  );
  assert.match(report.coachEvidence[0], /출구 표시하기/);
  assert.match(report.coachInterpretations[0], /안전 확보/);
  assert.match(report.followUpQuestions[0], /처음 만난 사람/);
  assert.match(report.followUpQuestions[1], /다른 방법/);
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
        childRelevantMeaning: '집이 안전한지 궁금하다.',
        route: 'DIRECT_ACTION',
        responseText: '열쇠를 살펴보자.',
        actionFamilyId: 'B_CHECK_KEYS',
      },
      {
        anchorId: questionAnchorId('HG-Q-C'),
        childRelevantMeaning: '그레텔이 안전할 방법이 궁금하다.',
        route: 'DIRECT_ACTION',
        responseText: '멀리서 잠금을 확인하자.',
        actionFamilyId: 'C_CHECK_LOCK_FROM_DISTANCE',
      },
    ],
    {
      branchAssetId: storyPackage.branchIllustrationAssetId,
      branchSummary: storyPackage.branchReportSummary,
    },
  );

  assert.equal(report.coachEvidence.length, 3);
  assert.match(report.coachInterpretations[0], /3개 장면/);
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
        anchorId: questionAnchorId('HG-Q-B'),
        childRelevantMeaning: '창문과 출구를 확인한다.',
        route: 'THREE_PATHS',
        responseText: '다음 행동을 골라 보자.',
        selectedOption: {
          label: '창문과 출구 확인하기',
          meaning: '문턱 밖에서 다른 출구가 있는지 살펴본다.',
        },
      },
    ]),
    true,
  );
});
