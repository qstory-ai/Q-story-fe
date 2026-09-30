import type { RouteKind } from '@/entities/story-runtime';

import type { QuestionOutcome } from './parent-report';

/** 단일 세션 리포트(parent-report)와 종합 리포트(comprehensive-report)가 공유하는 라벨·집계 헬퍼. */

export const QUESTION_TYPE_BY_ROUTE: Record<RouteKind, string> = {
  ANSWER_RESUME: '이야기 속 정보를 궁금해한 질문',
  DIRECT_ACTION: '생각을 행동으로 옮긴 질문',
  THREE_PATHS: '여러 가능성을 비교한 질문',
  SCENE_REPLACE: '새로운 장면을 상상한 질문',
  DETOUR_REJOIN: '다른 이야기 길을 찾아본 질문',
  CLARIFY_ONCE: '뜻을 한 번 더 확인한 질문',
  GENTLE_REDIRECT: '안전한 방향으로 이어간 질문',
  SKIP_CONTINUE: '이야기를 계속 듣기로 한 선택',
};

export const STRATEGY_BY_FAMILY: Record<string, string> = {
  A_OBSERVE_BIRD: '단서를 관찰하고 확인하기',
  A_SPEAK_TO_BIRD: '질문으로 정보 얻기',
  A_CHECK_SURROUNDINGS: '단서를 관찰하고 확인하기',
  A_TRY_OTHER_PATH: '다른 가능성을 시험하기',
  B_ASK_OLD_WOMAN: '질문으로 정보 얻기',
  B_CHECK_KEYS: '단서를 관찰하고 확인하기',
  B_CHECK_HOUSE: '단서를 관찰하고 확인하기',
  B_STEP_BACK_MARK_EXIT: '미리 계획하고 안전 확보하기',
  B_MAKE_SIBLING_SIGNAL: '함께 움직일 방법 정하기',
  C_ASK_DEMONSTRATION: '질문으로 정보 얻기',
  C_DISTRACT_AND_TAKE_KEYS: '상황에 맞게 해결 방법 바꾸기',
  C_USE_SIGNAL: '함께 움직일 방법 정하기',
  C_CHECK_LOCK_FROM_DISTANCE: '단서를 관찰하고 확인하기',
  C_BLOCK_PURSUIT_SAFELY: '미리 계획하고 안전 확보하기',
};

/** 리포트 집계에서 빼는 라우트 - 되묻기와 건너뛰기는 아이의 질문으로 세지 않는다. */
export const NOT_MEANINGFUL_ROUTES = new Set<RouteKind>(['CLARIFY_ONCE', 'SKIP_CONTINUE']);

export function isMeaningfulOutcome(outcome: QuestionOutcome): boolean {
  return !NOT_MEANINGFUL_ROUTES.has(outcome.route);
}

export function selectedFamilyId(outcome: QuestionOutcome): string | null {
  return outcome.selectedOption?.actionFamilyId ?? outcome.actionFamilyId ?? null;
}

/** outcome마다 고른 family의 전략 라벨 - STRATEGY_BY_FAMILY에 없는 family(다른 이야기 등)는 빠진다. */
export function strategyLabelsOf(outcomes: readonly QuestionOutcome[]): string[] {
  return outcomes
    .map((outcome) => {
      const familyId = selectedFamilyId(outcome);
      return familyId ? STRATEGY_BY_FAMILY[familyId] : null;
    })
    .filter((label): label is string => Boolean(label));
}

/** 라벨별 등장 횟수 - 많은 순, 같으면 처음 나온 순. */
export function tallyByLabel(labels: readonly string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}
