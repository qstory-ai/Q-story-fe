import { fallbackFamilyId, questionAnchorId } from '@/entities/story-runtime';

import type { CompanionChatSummary, QuestionOutcome } from './parent-report';

/**
 * 헨젤과 그레텔 리포트 회귀 테스트(hansel-gretel-report.test.ts)용 고정 outcomes.
 * 질문 0/1/2/3개, 선택지·family 유무, 되묻기/건너뛰기, 다른 이야기에 없는 family, Q-30 이전 판본에만
 * 있던(지금은 없는) family까지 두루 섞었다.
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
      anchorId: qc,
      childRelevantMeaning: '헨젤이 마녀를 부르는 동안 열쇠를 가져오자.',
      route: 'THREE_PATHS',
      responseText: '방법을 골라 보자.',
      actionFamilyId: fallbackFamilyId('C_DISTRACT_AND_TAKE_KEYS'),
      selectedOption: {
        label: '헨젤이 마녀 부르기',
        meaning: '헨젤이 마녀를 부르는 동안 그레텔이 열쇠를 가져온다.',
        actionFamilyId: fallbackFamilyId('C_DISTRACT_AND_TAKE_KEYS'),
      },
    },
  ],
  twoMixed: [
    { anchorId: qa, childRelevantMeaning: '새가 보는 방향이 궁금하다.', route: 'DIRECT_ACTION', responseText: '새를 살펴보자.', actionFamilyId: 'A_OBSERVE_BIRD' },
    { anchorId: qb, childRelevantMeaning: '다시 말해 달라고 한다.', route: 'CLARIFY_ONCE', responseText: '한 번 더 말해 줄래?' },
    {
      anchorId: qc,
      childRelevantMeaning: '마녀가 등을 돌릴 때까지 기다리고 싶다.',
      route: 'THREE_PATHS',
      responseText: '방법을 골라 보자.',
      selectedOption: {
        label: '등 돌릴 때 기다리기',
        meaning: '마녀가 다른 곳을 볼 때까지 기다렸다가 열쇠를 가져온다.',
        actionFamilyId: fallbackFamilyId('C_WAIT_FOR_WITCH_TURN'),
      },
    },
  ],
  threeRepeatedStrategy: [
    { anchorId: qa, childRelevantMeaning: '잠깐 멈춰서 새를 지켜보고 싶다.', route: 'DIRECT_ACTION', responseText: '잠깐 멈춰서 하얀 새를 지켜보자.', actionFamilyId: 'A_OBSERVE_BIRD' },
    { anchorId: qb, childRelevantMeaning: '할머니가 누구인지 궁금하다.', route: 'ANSWER_RESUME', responseText: '이 집에서 나온 할머니야. 우리도 처음 만났어.' },
    { anchorId: qc, childRelevantMeaning: '마녀가 등을 돌릴 때까지 기다리고 싶다.', route: 'DIRECT_ACTION', responseText: '마녀가 등을 돌릴 때까지 기다려 볼게.', actionFamilyId: 'C_WAIT_FOR_WITCH_TURN' },
  ],
  threeDiverseWithUnknownFamily: [
    { anchorId: qa, childRelevantMeaning: '새가 어디로 가는지 궁금하다.', route: 'ANSWER_RESUME', responseText: '새를 좀 더 지켜보자.' },
    // Q-30 이전 판본의 기록 - 지금은 없는 family라 전략·분기 그림 없이 장면 기본 문구로 보여야 한다.
    { anchorId: qb, childRelevantMeaning: '할머니에게 물어보고 싶다.', route: 'SCENE_REPLACE', responseText: '할머니께 여쭤보자.', actionFamilyId: 'B_ASK_OLD_WOMAN' },
    { anchorId: qc, childRelevantMeaning: '다른 길로 도망치고 싶다.', route: 'DETOUR_REJOIN', responseText: '다른 길을 찾아보자.', actionFamilyId: 'LIVE_GENERATED_UNKNOWN' },
    { anchorId: qc, childRelevantMeaning: '헨젤에게 마녀를 불러 달라고 하고 싶다.', route: 'GENTLE_REDIRECT', responseText: '조심해서 해 보자.', actionFamilyId: 'C_DISTRACT_AND_TAKE_KEYS' },
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
