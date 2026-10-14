import type { RouteKind } from '@/entities/story-runtime';
import type { StoryReportCopy } from '@/entities/story';

import type { QuestionOutcome } from './parent-report';

/** 단일 세션 리포트(parent-report)와 종합 리포트(comprehensive-report)가 공유하는 라벨·집계 헬퍼. */

/** 라우트 종류별 질문 유형 - 이야기와 무관한 공통 분류라 이야기 데이터로 옮기지 않는다. */
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

/**
 * 이야기가 family별 전략(reportCopy.strategyByFamily)을 적지 않았을 때 쓰는 라우트 기준 전략.
 * GENTLE_REDIRECT는 아이가 고른 접근이 아니라 안전 쪽으로 돌린 것이라 전략으로 세지 않는다.
 */
export const STRATEGY_BY_ROUTE: Partial<Record<RouteKind, string>> = {
  ANSWER_RESUME: '질문으로 정보 얻기',
  DIRECT_ACTION: '생각을 바로 행동으로 옮기기',
  THREE_PATHS: '여러 방법을 비교해 고르기',
  SCENE_REPLACE: '새로운 장면을 상상해 보기',
  DETOUR_REJOIN: '다른 가능성을 시험하기',
};

/** 전략 라벨을 정할 때 보는 이야기 쪽 데이터 - 이야기를 모르면(null) 라우트 기준으로 추정한다. */
export type StrategySource = Pick<StoryReportCopy, 'strategyByFamily'> | null | undefined;

/** 리포트 집계에서 빼는 라우트 - 되묻기와 건너뛰기는 아이의 질문으로 세지 않는다. */
export const NOT_MEANINGFUL_ROUTES = new Set<RouteKind>(['CLARIFY_ONCE', 'SKIP_CONTINUE']);

export function isMeaningfulOutcome(outcome: QuestionOutcome): boolean {
  return !NOT_MEANINGFUL_ROUTES.has(outcome.route);
}

export function selectedFamilyId(outcome: QuestionOutcome): string | null {
  return outcome.selectedOption?.actionFamilyId ?? outcome.actionFamilyId ?? null;
}

/**
 * outcome 하나의 전략 라벨. 이야기가 strategyByFamily를 적었으면 그 표만 본다 - 표에 없는
 * family(실시간 생성 family 등)나 family 없는 outcome은 null. 적지 않은 이야기는 라우트 종류로
 * 추정한다(STRATEGY_BY_ROUTE).
 */
export function strategyLabelOf(outcome: QuestionOutcome, source: StrategySource): string | null {
  const strategyByFamily = source?.strategyByFamily;
  if (strategyByFamily) {
    const familyId = selectedFamilyId(outcome);
    return (familyId ? strategyByFamily[familyId] : null) ?? null;
  }
  return STRATEGY_BY_ROUTE[outcome.route] ?? null;
}

/** outcome마다 고른 접근의 전략 라벨 - 라벨을 정할 수 없는 outcome은 빠진다. */
export function strategyLabelsOf(
  outcomes: readonly QuestionOutcome[],
  source: StrategySource,
): string[] {
  return outcomes
    .map((outcome) => strategyLabelOf(outcome, source))
    .filter((label): label is string => Boolean(label));
}

/** 이 이야기에서 나올 수 있는 전략 라벨 전체(중복 제거) - 종합 리포트 "생각 전략" 점수의 분모. */
export function strategyVocabularyOf(source: StrategySource): string[] {
  const labels = source?.strategyByFamily
    ? Object.values(source.strategyByFamily)
    : Object.values(STRATEGY_BY_ROUTE);
  return [...new Set(labels)];
}

/** 라벨별 등장 횟수 - 많은 순, 같으면 처음 나온 순. */
export function tallyByLabel(labels: readonly string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}
