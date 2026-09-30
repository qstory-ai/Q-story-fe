import type {
  QuestionAnchorId,
  RouteKind,
  RouteOption,
} from '@/entities/story-runtime';
import type { StoryReportCopy } from '@/entities/story';

import {
  QUESTION_TYPE_BY_ROUTE,
  isMeaningfulOutcome,
  selectedFamilyId,
  strategyLabelsOf,
  tallyByLabel,
} from './report-labels';

export type QuestionOutcome = {
  anchorId: QuestionAnchorId;
  childRelevantMeaning: string;
  route: RouteKind;
  responseText: string;
  actionFamilyId?: string | null;
  selectedOption?: Pick<
    RouteOption,
    'label' | 'meaning' | 'actionFamilyId'
  >;
};

export type ParentReportQuestionRecord = {
  anchorId: QuestionAnchorId;
  questionMeaning: string;
  questionTypeLabel: string;
  sceneTitle: string;
  selectedPathTitle: string;
  selectedPathSummary: string;
  storyDevelopmentSummary: string;
  imageRef: {
    kind: 'FIXED_STORY_ASSET' | 'GENERATED_BRANCH_ASSET' | 'PLACEHOLDER';
    assetId: string | null;
    uri: string | null;
    alt: string;
  };
};

/**
 * 상시 대화(companion-chat) 태그 집계 스냅샷 - 서버가 완주 시점에 계산해 story_completion에
 * 저장한 형태. 상시 대화를 안 열었거나 아이가 한 번도 말을 걸지 않은 세션은 이 스냅샷이 null.
 */
export type CompanionChatSummary = {
  turnCount: number;
  topics: { label: string; count: number }[];
  tones: { label: string; count: number }[];
  values: { label: string; count: number }[];
};

export type ParentReport = {
  storyTitle: string;
  completedStory: string;
  participationSummary: string;
  questionCount: number;
  changedSceneCount: number;
  durationSeconds: number | null;
  questionRecords: ParentReportQuestionRecord[];
  curiosityTopics: string[];
  changedMoments: string[];
  coachObservation: string;
  coachEvidence: string[];
  coachInterpretations: string[];
  focusTopics: string[];
  conversationTopics: string[];
  followUpQuestions: string[];
  togetherActivity: {
    title: string;
    description: string;
  };
  companionChat: CompanionChatSummary | null;
  /** 상시 대화 요약 패널의 제목·설명 - 이야기의 reportCopy.companionChat, 없으면 일반 문구. */
  companionChatTitle: string;
  companionChatDescription: string;
};

/** 이야기별 reportCopy - storyId로 찾는다. 불러오지 못한 이야기는 빠져 있을 수 있다. */
export type ReportCopyByStoryId = Readonly<Record<string, StoryReportCopy | null | undefined>>;

const CHANGE_ROUTES = new Set<RouteKind>([
  'DIRECT_ACTION',
  'THREE_PATHS',
  'SCENE_REPLACE',
  'DETOUR_REJOIN',
]);

export type RecentApproachTrend = {
  sessionCount: number;
  questionSessionCount: number;
  repeatedApproach: { label: string; count: number } | null;
  otherApproaches: string[];
};

/**
 * 최근 N회 세션의 outcomes를 가로질러 반복되는 접근(전략 라벨)을 집계한다.
 * report-history 목록 화면의 누적 트렌드 카드용 - 이야기별 관심 주제(curiosityTopics)는 다루지 않고
 * 선택 전략만 본다. 전략은 세션마다 그 이야기의 reportCopy.strategyByFamily로 정하고, 이야기가
 * 전략 표를 적지 않았거나 reportCopy를 불러오지 못했으면 라우트 종류로 추정한다(report-labels 참고).
 */
export function buildRecentApproachTrend(
  sessions: readonly { storyId?: string; outcomes: readonly QuestionOutcome[] }[],
  reportCopyByStoryId: ReportCopyByStoryId = {},
): RecentApproachTrend {
  const meaningfulBySession = sessions.map((session) =>
    session.outcomes.filter(isMeaningfulOutcome),
  );
  const questionSessionCount = meaningfulBySession.filter(
    (meaningful) => meaningful.length > 0,
  ).length;
  const ranked = tallyByLabel(
    sessions.flatMap((session, index) =>
      strategyLabelsOf(
        meaningfulBySession[index],
        session.storyId ? reportCopyByStoryId[session.storyId] : null,
      ),
    ),
  );
  const top = ranked[0];
  const repeatedApproach = top && top.count >= 2 ? top : null;
  const remaining = repeatedApproach ? ranked.slice(1) : ranked;

  return {
    sessionCount: sessions.length,
    questionSessionCount,
    repeatedApproach,
    otherApproaches: remaining.map(({ label }) => label),
  };
}

export function hasExperiencedStoryAgency(
  outcomes: readonly QuestionOutcome[],
) {
  return outcomes.some(
    (outcome) =>
      CHANGE_ROUTES.has(outcome.route) || Boolean(outcome.selectedOption),
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

const KOREAN_COUNT_WORDS = ['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

/** "세 질문"처럼 관형사로 쓰는 수 - 열을 넘으면 숫자로 쓴다. */
function countWord(count: number) {
  return KOREAN_COUNT_WORDS[count - 1] ?? String(count);
}

function pathTitle(outcome: QuestionOutcome) {
  if (outcome.selectedOption?.label) {
    return outcome.selectedOption.label;
  }
  switch (outcome.route) {
    case 'ANSWER_RESUME':
      return '이야기 속 답을 더 들어보기';
    case 'DIRECT_ACTION':
      return '아이의 생각을 바로 해보기';
    case 'SCENE_REPLACE':
      return '아이의 상상으로 장면 바꾸기';
    case 'DETOUR_REJOIN':
      return '다른 길로 가서 이야기와 다시 만나기';
    case 'GENTLE_REDIRECT':
      return '안전한 방법으로 다시 생각해 보기';
    default:
      return '아이의 생각을 이야기 길로 이어보기';
  }
}

function pathSummary(outcome: QuestionOutcome) {
  return (
    outcome.selectedOption?.meaning ??
    outcome.responseText ??
    outcome.childRelevantMeaning
  );
}

type ParentReportOptions = {
  durationSeconds?: number | null;
  branchAssetId?: (familyId: string) => string | null;
  branchSummary?: (familyId: string) => string | null;
  companionChat?: CompanionChatSummary | null;
};

export function buildParentReport(
  reportCopy: StoryReportCopy,
  outcomes: readonly QuestionOutcome[],
  options: ParentReportOptions = {},
): ParentReport {
  const meaningful = outcomes.filter(isMeaningfulOutcome);
  const curiosityTopics =
    meaningful.length > 0
      ? unique(
          meaningful.map(
            (outcome) =>
              reportCopy.anchors[outcome.anchorId]?.topic ??
              '이야기 속 인물과 사건 살펴보기',
          ),
        )
      : [reportCopy.noQuestionCuriosityTopic];
  const changedMoments = meaningful
    .filter(
      (outcome) =>
        CHANGE_ROUTES.has(outcome.route) || outcome.selectedOption,
    )
    .map((outcome) => {
      const scene =
        reportCopy.anchors[outcome.anchorId]?.sceneTitle ??
        '이야기 속 한 장면';
      const action =
        outcome.selectedOption?.meaning ?? outcome.childRelevantMeaning;
      const familyId = selectedFamilyId(outcome);
      const development = familyId ? options.branchSummary?.(familyId) : null;
      return development
        ? `${scene}에서 아이가 ‘${action}’을 골랐고, ${development}`
        : `${scene}에서 아이의 생각인 ‘${action}’이 실제 행동으로 이어졌어요.`;
    });
  const firstTopic = meaningful[0];
  const conversationTopics = unique([
    firstTopic
      ? `아이의 생각: ${firstTopic.childRelevantMeaning}`
      : '끝까지 이야기를 들으며 가장 기억에 남은 장면',
    meaningful
      .map(
        (outcome) =>
          reportCopy.anchors[outcome.anchorId]?.conversationTopic,
      )
      .find(Boolean) ?? reportCopy.defaultConversationTopic,
  ]).slice(0, 2);
  const questionRecords = meaningful.map((outcome) => {
    const sceneTitle =
      reportCopy.anchors[outcome.anchorId]?.sceneTitle ??
      '이야기 속 한 장면';
    const familyId = selectedFamilyId(outcome);
    const branchAssetId = familyId ? options.branchAssetId?.(familyId) : null;
    return {
      anchorId: outcome.anchorId,
      questionMeaning: outcome.childRelevantMeaning,
      questionTypeLabel:
        QUESTION_TYPE_BY_ROUTE[outcome.route] ??
        '이야기를 다른 각도에서 바라본 질문',
      sceneTitle,
      selectedPathTitle: pathTitle(outcome),
      selectedPathSummary: pathSummary(outcome),
      storyDevelopmentSummary:
        (familyId ? options.branchSummary?.(familyId) : null) ??
        pathSummary(outcome),
      imageRef: {
        kind: branchAssetId
          ? ('GENERATED_BRANCH_ASSET' as const)
          : ('FIXED_STORY_ASSET' as const),
        assetId: branchAssetId ??
          reportCopy.anchors[outcome.anchorId]?.reportImageAssetId ??
          reportCopy.defaultReportImageAssetId,
        uri: null,
        alt: `${sceneTitle}에서 아이의 생각이 반영된 이야기 장면`,
      },
    };
  });
  const focusTopics = unique(
    meaningful.map(
      (outcome) =>
        reportCopy.anchors[outcome.anchorId]?.focusTopic ??
        '이야기 탐색',
    ),
  ).slice(0, 3);
  const changedSceneCount = meaningful.filter(
    (outcome) =>
      CHANGE_ROUTES.has(outcome.route) || Boolean(outcome.selectedOption),
  ).length;
  const coachEvidence = questionRecords.map(
    (record) =>
      `${record.sceneTitle}: ‘${record.questionMeaning}’ → ‘${record.selectedPathTitle}’`,
  );
  const strategies = strategyLabelsOf(meaningful, reportCopy);
  const repeatedStrategy = tallyByLabel(strategies)[0];
  const strategyObservation =
    repeatedStrategy && repeatedStrategy.count >= 2
      ? `이번 체험에서는 ‘${repeatedStrategy.label}’ 접근이 ${repeatedStrategy.count}개 장면에서 반복해서 나타났어요.`
      : strategies.length >= 2
        ? `이번 기록에서는 ${unique(strategies).join(', ')}처럼 장면에 따라 서로 다른 접근이 나타났어요.`
        : strategies[0]
          ? `이번 장면에서는 ‘${strategies[0]}’ 접근을 선택했어요.`
          : '이번에는 선택보다 이야기의 흐름을 따라가는 모습이 기록됐어요.';
  const coachObservation =
    questionRecords.length > 0
      ? `${questionRecords.length}개 질문 장면에서 아이가 궁금해한 내용과 고른 방법을 함께 살펴봤어요.`
      : '이번에는 질문을 건너뛰고 이야기의 처음과 끝을 차분히 따라갔어요. 다음에 기억에 남은 장면 하나부터 이야기해 보면 자연스럽게 생각을 들을 수 있어요.';
  const recordFollowUps = questionRecords.map(
    (record) =>
      reportCopy.anchors[record.anchorId]?.followUpQuestion ??
      `‘${record.selectedPathTitle}’을 고를 때 가장 중요하게 생각한 것은 뭐였어?`,
  );
  const followUpQuestions =
    recordFollowUps.length >= 3
      ? recordFollowUps.slice(0, 3)
      : recordFollowUps.length === 2
        ? [
            ...recordFollowUps,
            `${questionRecords[0].sceneTitle}과 ${questionRecords[1].sceneTitle}에서 고른 방법에는 어떤 공통점과 차이가 있었어?`,
          ]
        : recordFollowUps.length === 1
          ? [
              recordFollowUps[0],
              `‘${questionRecords[0].selectedPathTitle}’ 말고 다른 방법을 골랐다면 이야기가 어떻게 달라졌을까?`,
              `그 장면에서 ${questionRecords[0].selectedPathTitle}을 고른 뒤 가장 마음에 든 변화는 뭐였어?`,
            ]
          : [
              '이야기에서 가장 기억에 남은 장면은 어디였어? 왜 그랬어?',
              reportCopy.defaultFollowUpQuestion ??
                `‘${reportCopy.storyTitle}’ 속 인물에게 한 가지 말을 해 줄 수 있다면 뭐라고 하고 싶어?`,
              '이야기에서 한 장면을 바꿀 수 있다면 어디를 어떻게 바꾸고 싶어?',
            ];

  return {
    storyTitle: reportCopy.storyTitle,
    completedStory: reportCopy.completedStory,
    participationSummary:
      meaningful.length > 0
        ? `아이는 ${meaningful.length}개의 장면에서 질문하거나 생각을 이야기했어요.`
        : '이번에는 질문을 건너뛰고 이야기를 끝까지 감상했어요.',
    questionCount: meaningful.length,
    changedSceneCount,
    durationSeconds: options.durationSeconds ?? null,
    questionRecords,
    curiosityTopics,
    changedMoments:
      changedMoments.length > 0
        ? changedMoments
        : ['이야기의 큰 줄기를 바꾸지 않고 원래 결말까지 함께 갔어요.'],
    coachObservation,
    coachEvidence,
    coachInterpretations:
      questionRecords.length > 0
        ? [
            strategyObservation,
            `한 편의 ${countWord(Object.keys(reportCopy.anchors).length)} 질문에서 나온 관찰이므로, 같은 접근이 다른 이야기에서도 반복되는지 더 지켜보면 관심의 방향을 더 정확히 알 수 있어요.`,
          ]
        : [
            '질문을 하지 않은 것도 자연스러운 참여 방식이에요. 기억에 남은 장면을 말할 때 어떤 인물·사건·감정을 먼저 꺼내는지 들어보세요.',
          ],
    focusTopics:
      focusTopics.length > 0
        ? focusTopics
        : reportCopy.noQuestionFocusTopics,
    conversationTopics,
    followUpQuestions,
    togetherActivity:
      meaningful
        .map((outcome) => reportCopy.anchors[outcome.anchorId]?.activity)
        .find(Boolean) ?? reportCopy.defaultActivity,
    companionChat: options.companionChat ?? null,
    companionChatTitle: reportCopy.companionChat?.title ?? '이야기 속 인물들과 나눈 이야기',
    companionChatDescription:
      reportCopy.companionChat?.description ??
      '아이가 상시 대화창에서 이야기 속 인물들에게 물어본 말과 감정을 태그로만 남겼어요 - 원문 발화는 저장하지 않아요.',
  };
}
