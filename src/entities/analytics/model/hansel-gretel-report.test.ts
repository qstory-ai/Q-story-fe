// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { questionAnchorId } from '@/entities/story-runtime';
import { hanselGretelStoryPackage as storyPackage } from '@/entities/story/hansel-gretel/manifest';

import { buildComprehensiveReport } from './comprehensive-report';
import { HG_COMPANION_CHAT, HG_REPORT_SCENARIOS, HG_REPORT_SESSIONS } from './hansel-gretel-report.fixtures';
import { buildParentReport, buildRecentApproachTrend } from './parent-report';
// 전략 표·후속 질문 문구를 report-copy.yaml로 옮기기 직전(report-labels.ts에 헨젤과 그레텔 전용 표가
// 하드코딩돼 있던 때)의 코드로 같은 fixture를 돌려 저장한 출력이다. 이 파일을 다시 만들지 말 것 -
// 헨젤과 그레텔 리포트가 바뀌면 이 테스트가 실패해야 한다.
import before from './hansel-gretel-report.snapshot.json';

const reportCopy = storyPackage.reportCopy;
const reportCopyByStoryId = { HG: reportCopy };

// 옮기기 전에는 상시 대화 패널 제목·설명이 report-content.tsx에 하드코딩돼 있었다.
const BEFORE_COMPANION_CHAT_TITLE = '헨젤·그레텔과 나눈 이야기';
const BEFORE_COMPANION_CHAT_DESCRIPTION =
  '아이가 상시 대화창에서 헨젤과 그레텔에게 물어본 말과 감정을 태그로만 남겼어요 - 원문 발화는 저장하지 않아요.';

function withoutNewFields(report) {
  const { companionChatTitle, companionChatDescription, ...rest } = report;
  assert.equal(companionChatTitle, BEFORE_COMPANION_CHAT_TITLE);
  assert.equal(companionChatDescription, BEFORE_COMPANION_CHAT_DESCRIPTION);
  return rest;
}

test('헨젤과 그레텔 단일 리포트는 이야기 데이터로 옮긴 뒤에도 이전과 똑같다', () => {
  for (const [name, outcomes] of Object.entries(HG_REPORT_SCENARIOS)) {
    assert.deepEqual(
      withoutNewFields(buildParentReport(reportCopy, outcomes)),
      before.parentReports[`${name}:plain`],
      `${name}:plain`,
    );
    assert.deepEqual(
      withoutNewFields(
        buildParentReport(reportCopy, outcomes, {
          durationSeconds: 305,
          branchAssetId: storyPackage.branchIllustrationAssetId,
          branchSummary: storyPackage.branchReportSummary,
          companionChat: HG_COMPANION_CHAT,
        }),
      ),
      before.parentReports[`${name}:branch`],
      `${name}:branch`,
    );
  }
});

test('헨젤과 그레텔 최근 트렌드·종합 리포트도 이전과 똑같다', () => {
  assert.deepEqual(
    buildRecentApproachTrend(HG_REPORT_SESSIONS.slice(0, 5), reportCopyByStoryId),
    before.recentTrend,
  );
  assert.deepEqual(buildRecentApproachTrend(HG_REPORT_SESSIONS, reportCopyByStoryId), before.recentTrendAll);
  assert.deepEqual(buildComprehensiveReport(HG_REPORT_SESSIONS, reportCopyByStoryId), before.comprehensive);
  assert.deepEqual(buildComprehensiveReport([], reportCopyByStoryId), before.comprehensiveEmpty);
});

/** 리포트 메타데이터(strategyByFamily/defaultFollowUpQuestion/companionChat)를 적지 않은 가상의 다른 이야기. */
const otherStoryCopy = {
  storyId: 'TT',
  storyTitle: '토끼와 거북이',
  completedStory: '토끼와 거북이 한 편을 끝까지 완주했어요.',
  defaultReportImageAssetId: 'race-start',
  noQuestionCuriosityTopic: '이야기의 처음부터 결말까지 따라가기',
  noQuestionFocusTopics: ['이야기 완주'],
  defaultConversationTopic: '끝까지 해내는 힘',
  defaultActivity: { title: '3분 함께하기', description: '경주 길을 함께 그려 보세요.' },
  anchors: {
    'TT-Q-A': { topic: '토끼의 낮잠', focusTopic: '토끼의 선택', sceneTitle: '언덕 위 나무 그늘', reportImageAssetId: 'rabbit-nap' },
    'TT-Q-B': { topic: '거북이의 걸음', focusTopic: '거북이의 끈기', sceneTitle: '결승선 앞', reportImageAssetId: 'finish-line' },
  },
};

test('리포트 메타데이터가 없는 이야기는 헨젤과 그레텔 문구 없이 일반 문구로 채운다', () => {
  const empty = buildParentReport(otherStoryCopy, []);
  const serialized = JSON.stringify(empty);
  assert.equal(serialized.includes('헨젤'), false);
  assert.equal(serialized.includes('그레텔'), false);
  assert.equal(
    empty.followUpQuestions[1],
    '‘토끼와 거북이’ 속 인물에게 한 가지 말을 해 줄 수 있다면 뭐라고 하고 싶어?',
  );
  assert.equal(empty.companionChatTitle, '이야기 속 인물들과 나눈 이야기');

  const report = buildParentReport(otherStoryCopy, [
    {
      anchorId: questionAnchorId('TT-Q-A'),
      childRelevantMeaning: '토끼를 깨우고 싶다.',
      route: 'DIRECT_ACTION',
      responseText: '토끼를 깨워 보자.',
      actionFamilyId: 'A_WAKE_RABBIT',
    },
    {
      anchorId: questionAnchorId('TT-Q-B'),
      childRelevantMeaning: '거북이를 응원하고 싶다.',
      route: 'DIRECT_ACTION',
      responseText: '거북이를 응원하자.',
      actionFamilyId: 'B_CHEER_TURTLE',
    },
  ]);
  // 전략 표가 없으니 라우트 종류로 추정한 전략이 반복 접근으로 잡힌다.
  assert.match(report.coachInterpretations[0], /‘생각을 바로 행동으로 옮기기’ 접근이 2개 장면/);
  assert.match(report.coachInterpretations[1], /^한 편의 두 질문/);
  assert.equal(JSON.stringify(report).includes('헨젤'), false);
});

test('여러 이야기를 섞은 종합 리포트는 이야기마다 제 전략 표(없으면 라우트 추정)를 쓴다', () => {
  const sessions = [
    ...HG_REPORT_SESSIONS.slice(4, 5),
    {
      storyId: 'TT',
      completedAt: '2026-09-12T10:00:00Z',
      outcomes: [
        {
          anchorId: questionAnchorId('TT-Q-A'),
          childRelevantMeaning: '다른 길로 가 보고 싶다.',
          route: 'DETOUR_REJOIN',
          responseText: '다른 길로 가 보자.',
          actionFamilyId: 'A_SHORTCUT',
        },
      ],
    },
  ];
  const comprehensive = buildComprehensiveReport(sessions, { HG: reportCopy, TT: otherStoryCopy });
  assert.deepEqual(comprehensive.thought.strategies, [
    { label: '단서를 관찰하고 확인하기', count: 3 },
    { label: '다른 가능성을 시험하기', count: 1 },
  ]);
  const trend = buildRecentApproachTrend(sessions, { HG: reportCopy, TT: otherStoryCopy });
  assert.deepEqual(trend.repeatedApproach, { label: '단서를 관찰하고 확인하기', count: 3 });
  assert.deepEqual(trend.otherApproaches, ['다른 가능성을 시험하기']);
});
