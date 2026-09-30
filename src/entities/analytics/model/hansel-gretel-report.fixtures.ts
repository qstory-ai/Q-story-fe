import { fallbackFamilyId, questionAnchorId } from '@/entities/story-runtime';

import type { CompanionChatSummary, QuestionOutcome } from './parent-report';

/**
 * 헨젤과 그레텔 리포트 회귀 테스트(hansel-gretel-report.test.ts)용 고정 outcomes.
 * 리포트 전략·후속 질문 문구를 스토리 데이터(report-copy.yaml)로 옮기기 전의 출력과 같은지 비교한다 -
 * 질문 0/1/2/3개, 선택지·family 유무, 되묻기/건너뛰기, 다른 이야기에 없는 family까지 두루 섞었다.
 */

const qa = questionAnchorId('HG-Q-A');
const qb = questionAnchorId('HG-Q-B');
const qc = questionAnchorId('HG-Q-C');

export const HG_COMPANION_CHAT: CompanionChatSummary = {
  turnCount: 4,
  topics: [{ label: '길 찾기', count: 2 }],
  tones: [{ label: '호기심', count: 3 }],
  values: [{ label: '협력', count: 1 }],
};

export const HG_REPORT_SCENARIOS: Record<string, QuestionOutcome[]> = {
  noQuestions: [],
  skippedOnly: [
    { anchorId: qa, childRelevantMeaning: '이야기를 계속 듣는다.', route: 'SKIP_CONTINUE', responseText: '' },
    { anchorId: qb, childRelevantMeaning: '다시 말해 달라고 한다.', route: 'CLARIFY_ONCE', responseText: '한 번 더 말해 줄래?' },
  ],
  oneDirectNoFamily: [
    { anchorId: qa, childRelevantMeaning: '하얀 새에게 길을 물어보고 싶다.', route: 'DIRECT_ACTION', responseText: '좋아. 새에게 물어보자.' },
  ],
  oneSelectedOption: [
    {
      anchorId: qb,
      childRelevantMeaning: '어떻게 안전을 확인할지 궁금하다.',
      route: 'THREE_PATHS',
      responseText: '세 가지 방법 중 하나를 골라 보자.',
      actionFamilyId: fallbackFamilyId('B_STEP_BACK_MARK_EXIT'),
      selectedOption: {
        label: '출구 표시하기',
        meaning: '한 걸음 물러나 안전한 출구 위치를 표시한다.',
        actionFamilyId: fallbackFamilyId('B_STEP_BACK_MARK_EXIT'),
      },
    },
  ],
  twoMixed: [
    { anchorId: qa, childRelevantMeaning: '새가 보는 방향이 궁금하다.', route: 'DIRECT_ACTION', responseText: '새를 살펴보자.', actionFamilyId: 'A_OBSERVE_BIRD' },
    { anchorId: qb, childRelevantMeaning: '다시 말해 달라고 한다.', route: 'CLARIFY_ONCE', responseText: '한 번 더 말해 줄래?' },
    {
      anchorId: qc,
      childRelevantMeaning: '헨젤과 신호를 맞추고 싶다.',
      route: 'THREE_PATHS',
      responseText: '방법을 골라 보자.',
      selectedOption: {
        label: '헨젤에게 신호 보내기',
        meaning: '작업대를 두 번 두드려 헨젤에게 준비하라는 신호를 보낸다.',
        actionFamilyId: fallbackFamilyId('C_USE_SIGNAL'),
      },
    },
  ],
  threeRepeatedStrategy: [
    { anchorId: qa, childRelevantMeaning: '새 주변 흔적이 궁금하다.', route: 'DIRECT_ACTION', responseText: '흔적을 찾아보자.', actionFamilyId: 'A_CHECK_SURROUNDINGS' },
    { anchorId: qb, childRelevantMeaning: '집이 안전한지 궁금하다.', route: 'DIRECT_ACTION', responseText: '열쇠를 살펴보자.', actionFamilyId: 'B_CHECK_KEYS' },
    { anchorId: qc, childRelevantMeaning: '그레텔이 안전할 방법이 궁금하다.', route: 'DIRECT_ACTION', responseText: '멀리서 잠금을 확인하자.', actionFamilyId: 'C_CHECK_LOCK_FROM_DISTANCE' },
  ],
  threeDiverseWithUnknownFamily: [
    { anchorId: qa, childRelevantMeaning: '새가 어디로 가는지 궁금하다.', route: 'ANSWER_RESUME', responseText: '새를 좀 더 지켜보자.' },
    { anchorId: qb, childRelevantMeaning: '할머니에게 물어보고 싶다.', route: 'SCENE_REPLACE', responseText: '할머니께 여쭤보자.', actionFamilyId: 'B_ASK_OLD_WOMAN' },
    { anchorId: qc, childRelevantMeaning: '다른 길로 도망치고 싶다.', route: 'DETOUR_REJOIN', responseText: '다른 길을 찾아보자.', actionFamilyId: 'LIVE_GENERATED_UNKNOWN' },
    { anchorId: qc, childRelevantMeaning: '추격을 막고 싶다.', route: 'GENTLE_REDIRECT', responseText: '안전하게 늦춰 보자.', actionFamilyId: 'C_BLOCK_PURSUIT_SAFELY' },
  ],
};

/** 종합 리포트·최근 트렌드용 세션 묶음 - 성장 추세까지 계산되도록 4편 이상. */
export const HG_REPORT_SESSIONS: { storyId: string; completedAt: string; outcomes: QuestionOutcome[] }[] = [
  { storyId: 'HG', completedAt: '2026-09-01T10:00:00Z', outcomes: HG_REPORT_SCENARIOS.oneDirectNoFamily },
  { storyId: 'HG', completedAt: '2026-09-03T10:00:00Z', outcomes: HG_REPORT_SCENARIOS.oneSelectedOption },
  { storyId: 'HG', completedAt: '2026-09-05T10:00:00Z', outcomes: HG_REPORT_SCENARIOS.skippedOnly },
  { storyId: 'HG', completedAt: '2026-09-07T10:00:00Z', outcomes: HG_REPORT_SCENARIOS.twoMixed },
  { storyId: 'HG', completedAt: '2026-09-09T10:00:00Z', outcomes: HG_REPORT_SCENARIOS.threeRepeatedStrategy },
  { storyId: 'HG', completedAt: '2026-09-11T10:00:00Z', outcomes: HG_REPORT_SCENARIOS.threeDiverseWithUnknownFamily },
];
