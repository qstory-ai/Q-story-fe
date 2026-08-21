import type {
  QuestionAnchorId,
  RouteKind,
  RouteOption,
} from '@/entities/story-runtime';
import type { StoryReportCopy } from '@/entities/story';

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
};

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

const CHANGE_ROUTES = new Set<RouteKind>([
  'DIRECT_ACTION',
  'THREE_PATHS',
  'SCENE_REPLACE',
  'DETOUR_REJOIN',
]);

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

function selectedFamilyId(outcome: QuestionOutcome) {
  return outcome.selectedOption?.actionFamilyId ?? outcome.actionFamilyId ?? null;
}

type ParentReportOptions = {
  durationSeconds?: number | null;
  branchAssetId?: (familyId: string) => string | null;
  branchSummary?: (familyId: string) => string | null;
};

export function buildParentReport(
  reportCopy: StoryReportCopy,
  outcomes: readonly QuestionOutcome[],
  options: ParentReportOptions = {},
): ParentReport {
  const meaningful = outcomes.filter(
    (outcome) =>
      outcome.route !== 'CLARIFY_ONCE' &&
      outcome.route !== 'SKIP_CONTINUE',
  );
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
  const strategies = meaningful
    .map((outcome) => {
      const familyId = selectedFamilyId(outcome);
      return familyId ? STRATEGY_BY_FAMILY[familyId] : null;
    })
    .filter((strategy): strategy is string => Boolean(strategy));
  const strategyCounts = strategies.reduce<Map<string, number>>(
    (counts, strategy) =>
      counts.set(strategy, (counts.get(strategy) ?? 0) + 1),
    new Map(),
  );
  const repeatedStrategy = [...strategyCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];
  const strategyObservation =
    repeatedStrategy && repeatedStrategy[1] >= 2
      ? `이번 체험에서는 ‘${repeatedStrategy[0]}’ 접근이 ${repeatedStrategy[1]}개 장면에서 반복해서 나타났어요.`
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
              '헨젤과 그레텔에게 한 가지 말을 해 줄 수 있다면 뭐라고 하고 싶어?',
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
            '한 편의 세 질문에서 나온 관찰이므로, 같은 접근이 다른 이야기에서도 반복되는지 더 지켜보면 관심의 방향을 더 정확히 알 수 있어요.',
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
  };
}
