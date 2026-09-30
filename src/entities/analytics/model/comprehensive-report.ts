import type { RouteKind } from '@/entities/story-runtime';

import type { QuestionOutcome, ReportCopyByStoryId } from './parent-report';
import {
  NOT_MEANINGFUL_ROUTES,
  QUESTION_TYPE_BY_ROUTE,
  isMeaningfulOutcome as isMeaningful,
  strategyLabelsOf,
  strategyVocabularyOf,
  tallyByLabel,
} from './report-labels';

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
 *
 * <p>예외로 "생각 전략"은 이야기마다 family → 전략 표(reportCopy.strategyByFamily)가 다르므로,
 * 호출부가 세션들의 이야기 reportCopy를 storyId별로 넘긴다. 넘기지 못한 이야기(불러오기 실패 등)나
 * 전략 표가 없는 이야기는 라우트 종류로 전략을 추정한다(report-labels 참고).
 */

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

/** 종합 리포트 상단 육각형 스탯 한 축 - 0~100 점수(비율/캡핑 지표를 섞어 같은 눈금에 맞춘 값). */
export type HexStat = { label: string; value: number };

export type ComprehensiveReport = {
  question: QuestionAnalysis;
  interest: InterestAnalysis;
  thought: ThoughtAnalysis;
  growth: GrowthTrend | null;
  /** 질문분석 카드 위에 그리는 육각형 레이더 6축 - 아래 네 축 지표에서 파생한 요약 스탯. */
  hexStats: HexStat[];
};

type Session = { storyId?: string; completedAt: string; outcomes: readonly QuestionOutcome[] };

function strategySourceOf(session: Session, reportCopyByStoryId: ReportCopyByStoryId) {
  return session.storyId ? reportCopyByStoryId[session.storyId] : null;
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

function analyzeThought(
  sessions: readonly Session[],
  reportCopyByStoryId: ReportCopyByStoryId,
): ThoughtAnalysis {
  const strategyLabels = sessions.flatMap((session) =>
    strategyLabelsOf(
      session.outcomes.filter(isMeaningful),
      strategySourceOf(session, reportCopyByStoryId),
    ),
  );
  const strategies = tallyByLabel(strategyLabels);
  return {
    strategies,
    diversity: strategies.length,
    totalWithStrategy: strategyLabels.length,
  };
}

function analyzeGrowth(
  sessions: readonly Session[],
  reportCopyByStoryId: ReportCopyByStoryId,
): GrowthTrend | null {
  if (sessions.length < 4) return null;
  const sorted = [...sessions].sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1));
  const mid = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, mid);
  const recent = sorted.slice(mid);
  const diversity = (subset: Session[]) => analyzeThought(subset, reportCopyByStoryId).diversity;
  const earlyDiv = diversity(early);
  const recentDiv = diversity(recent);
  const broadening = recentDiv === earlyDiv ? null : recentDiv > earlyDiv;
  return {
    early: { sessionCount: early.length, diversity: earlyDiv },
    recent: { sessionCount: recent.length, diversity: recentDiv },
    broadening,
  };
}

/** byType/strategies가 실제로 도달 가능한 서로 다른 라벨 수 - 캡을 하드코딩하지 않고 매핑
 * 테이블에서 직접 세어, 나중에 라우트/전략이 추가돼도 육각형 스탯이 따라간다. */
const MEANINGFUL_QUESTION_TYPE_COUNT = new Set(
  Object.entries(QUESTION_TYPE_BY_ROUTE)
    .filter(([route]) => !NOT_MEANINGFUL_ROUTES.has(route as RouteKind))
    .map(([, label]) => label),
).size;

/** 이 세션들의 이야기에서 나올 수 있는 전략 라벨 수(이야기별 전략 표의 합집합) - "생각 전략" 분모. */
function strategyLabelCount(
  sessions: readonly Session[],
  reportCopyByStoryId: ReportCopyByStoryId,
): number {
  const labels = new Set<string>();
  const seenStories = new Set<string | undefined>();
  for (const session of sessions) {
    if (seenStories.has(session.storyId)) continue;
    seenStories.add(session.storyId);
    for (const label of strategyVocabularyOf(strategySourceOf(session, reportCopyByStoryId))) {
      labels.add(label);
    }
  }
  // 세션이 없으면 다양성도 0이라 점수는 0 - 0으로 나누지 않도록 분모만 1로 둔다.
  return Math.max(1, labels.size);
}
/** 이 정도 빈도부터 "질문을 아주 활발히 한다"로 본다 - 완주 기록 데이터를 보고 고른 캡. */
const QUESTION_FREQUENCY_CAP = 3;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * 종합 리포트 네 축(질문/관심/생각/변화)에서 육각형 레이더용 6개 점수를 파생한다 - 새로운
 * 추적을 추가하지 않고, 이미 계산된 지표를 0~100 눈금 하나로 정규화만 한다.
 */
function analyzeHexStats(
  sessions: readonly Session[],
  question: QuestionAnalysis,
  thought: ThoughtAnalysis,
  growth: GrowthTrend | null,
  strategyCount: number,
): HexStat[] {
  const meaningful = sessions.flatMap((session) => session.outcomes).filter(isMeaningful);
  const total = meaningful.length;

  const expressedCount = meaningful.filter(
    (outcome) => (outcome.childRelevantMeaning?.trim().length ?? 0) > 0,
  ).length;
  const proactiveCount = meaningful.filter(
    (outcome) => outcome.route === 'DIRECT_ACTION' || outcome.route === 'THREE_PATHS',
  ).length;

  return [
    { label: '질문 빈도', value: clampScore((question.averagePerSession / QUESTION_FREQUENCY_CAP) * 100) },
    { label: '질문 다양성', value: clampScore((question.byType.length / MEANINGFUL_QUESTION_TYPE_COUNT) * 100) },
    { label: '관심 표현', value: clampScore(total > 0 ? (expressedCount / total) * 100 : 0) },
    { label: '생각 전략', value: clampScore((thought.diversity / strategyCount) * 100) },
    { label: '적극적 행동', value: clampScore(total > 0 ? (proactiveCount / total) * 100 : 0) },
    {
      label: '성장 추세',
      // growth 데이터가 없으면(4편 미만) 판단 근거가 없다는 뜻이라 중립값 50을 둔다.
      value: growth ? clampScore(50 + (growth.recent.diversity - growth.early.diversity) * 12) : 50,
    },
  ];
}

/**
 * 최근 여러 세션의 outcomes를 가로질러 IA "종합 리포트" 네 축을 한꺼번에 집계한다.
 * 완료 기록이 하나도 없으면 빈 값들이 채워진 형태로 돌아오므로 - null-check 없이 호출부에서
 * 각 배열/카운트가 0인지만 보고 empty state를 표시하면 된다.
 */
export function buildComprehensiveReport(
  sessions: readonly Session[],
  reportCopyByStoryId: ReportCopyByStoryId = {},
): ComprehensiveReport {
  const question = analyzeQuestions(sessions);
  const thought = analyzeThought(sessions, reportCopyByStoryId);
  const growth = analyzeGrowth(sessions, reportCopyByStoryId);
  return {
    question,
    interest: analyzeInterest(sessions),
    thought,
    growth,
    hexStats: analyzeHexStats(
      sessions,
      question,
      thought,
      growth,
      strategyLabelCount(sessions, reportCopyByStoryId),
    ),
  };
}
