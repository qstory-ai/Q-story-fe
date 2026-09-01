import type { RouteKind } from '@/entities/story-runtime';

import type { QuestionOutcome } from './parent-report';

/**
 * IA "[3] 리포트 > 개인 리포트 > 종합 리포트" 네 축(질문/관심/생각/변화) 집계.
 *
 * <p>단일 세션이 아니라 최근 여러 세션의 outcomes를 가로질러 계산한다 - 팀은 이 리포트가
 * "이 아이의 요즘 흐름"을 보여주는 것을 의도했다. reportCopy(스토리 자체 텍스트 팩)에는
 * 접근하지 않으므로 스토리별 관심 주제(anchor.topic)까지 다루지는 못하고, 아이가 실제로
 * 표현한 관심(childRelevantMeaning)과 route/전략 분포로 좁혔다.
 *
 * <p>outcome-level 필드 이상은 계산하지 않는다 - QuestionOutcome이 anchorId를 갖긴 하지만
 * anchor 메타(scene, topic 등)는 스토리 팩이 있어야 알 수 있어서, 스토리 없이 부를 수 있는
 * 종합 지표에만 국한한다.
 */

const QUESTION_TYPE_BY_ROUTE: Record<RouteKind, string> = {
  ANSWER_RESUME: '이야기 속 정보를 궁금해한 질문',
  DIRECT_ACTION: '생각을 행동으로 옮긴 질문',
  THREE_PATHS: '여러 가능성을 비교한 질문',
  SCENE_REPLACE: '새로운 장면을 상상한 질문',
  DETOUR_REJOIN: '다른 이야기 길을 찾아본 질문',
  CLARIFY_ONCE: '뜻을 한 번 더 확인한 질문',
  GENTLE_REDIRECT: '안전한 방향으로 이어간 질문',
  SKIP_CONTINUE: '이야기를 계속 듣기로 한 선택',
};

const STRATEGY_BY_FAMILY: Record<string, string> = {
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

/** 의미 없는 관찰(주제 회피/안전 리다이렉트/스킵)을 걸러내는 술어. */
function isMeaningful(outcome: QuestionOutcome): boolean {
  return outcome.route !== 'CLARIFY_ONCE' && outcome.route !== 'SKIP_CONTINUE';
}

export type QuestionAnalysis = {
  totalQuestions: number;
  sessionCount: number;
  averagePerSession: number;
  byType: { label: string; count: number }[];
};

export type InterestAnalysis = {
  /** 아이가 실제로 표현한 관심 문구 상위 N개 - 원문 문장(childRelevantMeaning) 그대로 노출한다. */
  topExpressions: { text: string; count: number }[];
  /** 상위 문구가 없어서 보조로 보여줄 최근 표현. */
  recentExpressions: string[];
};

export type ThoughtAnalysis = {
  strategies: { label: string; count: number }[];
  /** 전략이 얼마나 다양했는지(라벨 종류 수) - 클수록 여러 접근을 시도했다는 뜻. */
  diversity: number;
  totalWithStrategy: number;
};

export type GrowthTrend = {
  /** 시간 순으로 정렬된 세션의 앞 절반 vs 뒤 절반의 전략 다양성. */
  early: { sessionCount: number; diversity: number };
  recent: { sessionCount: number; diversity: number };
  /** 최근 절반이 앞보다 다양성이 커졌는지(true), 줄었는지(false), 같은지(null). */
  broadening: boolean | null;
};

export type ComprehensiveReport = {
  question: QuestionAnalysis;
  interest: InterestAnalysis;
  thought: ThoughtAnalysis;
  growth: GrowthTrend | null;
};

type Session = { completedAt: string; outcomes: readonly QuestionOutcome[] };

function selectedFamilyId(outcome: QuestionOutcome): string | null {
  return outcome.selectedOption?.actionFamilyId ?? outcome.actionFamilyId ?? null;
}

function tallyByLabel(labels: string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function analyzeQuestions(sessions: readonly Session[]): QuestionAnalysis {
  const allMeaningful = sessions.flatMap((session) => session.outcomes.filter(isMeaningful));
  const total = allMeaningful.length;
  const sessionCount = sessions.length;
  const average = sessionCount > 0 ? total / sessionCount : 0;
  const byType = tallyByLabel(
    allMeaningful.map((outcome) => QUESTION_TYPE_BY_ROUTE[outcome.route] ?? '기타 질문'),
  );
  return {
    totalQuestions: total,
    sessionCount,
    averagePerSession: Math.round(average * 10) / 10,
    byType,
  };
}

function analyzeInterest(sessions: readonly Session[]): InterestAnalysis {
  const meaningful = sessions
    .flatMap((session) => session.outcomes)
    .filter(isMeaningful);
  // 원문 문구를 그대로 tally - NLP 없이 근사한 "관심 주제". 같은 표현이 여러 번 나오면 상위.
  const tallied = tallyByLabel(
    meaningful
      .map((outcome) => outcome.childRelevantMeaning?.trim() ?? '')
      .filter((text): text is string => text.length > 0),
  );
  const topExpressions = tallied
    .filter((entry) => entry.count >= 2)
    .slice(0, 3)
    .map((entry) => ({ text: entry.label, count: entry.count }));
  const recentExpressions = meaningful
    .slice(-6)
    .map((outcome) => outcome.childRelevantMeaning?.trim() ?? '')
    .filter((text) => text.length > 0)
    .reverse();
  return { topExpressions, recentExpressions };
}

function analyzeThought(sessions: readonly Session[]): ThoughtAnalysis {
  const strategyLabels = sessions
    .flatMap((session) => session.outcomes.filter(isMeaningful))
    .map((outcome) => {
      const familyId = selectedFamilyId(outcome);
      return familyId ? STRATEGY_BY_FAMILY[familyId] : null;
    })
    .filter((label): label is string => Boolean(label));
  const strategies = tallyByLabel(strategyLabels);
  return {
    strategies,
    diversity: strategies.length,
    totalWithStrategy: strategyLabels.length,
  };
}

function analyzeGrowth(sessions: readonly Session[]): GrowthTrend | null {
  if (sessions.length < 4) return null;
  const sorted = [...sessions].sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1));
  const mid = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, mid);
  const recent = sorted.slice(mid);
  const diversity = (subset: Session[]) => analyzeThought(subset).diversity;
  const earlyDiv = diversity(early);
  const recentDiv = diversity(recent);
  const broadening = recentDiv === earlyDiv ? null : recentDiv > earlyDiv;
  return {
    early: { sessionCount: early.length, diversity: earlyDiv },
    recent: { sessionCount: recent.length, diversity: recentDiv },
    broadening,
  };
}

/**
 * 최근 여러 세션의 outcomes를 가로질러 IA "종합 리포트" 네 축을 한꺼번에 집계한다.
 * 완료 기록이 하나도 없으면 빈 값들이 채워진 형태로 돌아오므로 - null-check 없이 호출부에서
 * 각 배열/카운트가 0인지만 보고 empty state를 표시하면 된다.
 */
export function buildComprehensiveReport(sessions: readonly Session[]): ComprehensiveReport {
  return {
    question: analyzeQuestions(sessions),
    interest: analyzeInterest(sessions),
    thought: analyzeThought(sessions),
    growth: analyzeGrowth(sessions),
  };
}
