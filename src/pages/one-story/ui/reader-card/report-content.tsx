import { Image, Text, View } from 'react-native';

import type { ParentReport } from '@/entities/analytics';
import type { ImageSource } from '@/entities/story';

import { formatReportDuration } from '../../lib/runtime-view';
import { styles } from '../styles';

type ReportContentProps = {
  parentReport: ParentReport;
  isWide: boolean;
  illustrationForAssetId: (assetId: string) => ImageSource;
  /**
   * child: 한 아이의 기록(집에서 읽은 기록, 선생님 개별 수업). class: 반 수업 - 여러 아이가 함께 읽어 누가 말했는지
   * 모르는 기록이라 "우리 아이가 한 말"처럼 보이지 않게 문구를 반 기준으로 바꾼다.
   */
  audience?: ReportAudience;
};

export type ReportAudience = 'child' | 'class';

const REPORT_COPY = {
  child: {
    heroTitle: '오늘의 질문 기록',
    heroBody: '점수가 아니라, 오늘 아이가 무엇을 궁금해하고 어떤 이야기 길을 만들었는지 담았어요.',
    questionStat: '아이 질문',
    questionsTitle: '아이가 실제로 만든 질문과 선택',
    questionsBody: '아이가 한 질문의 뜻과 그 생각으로 달라진 이야기 길이에요. 질문의 뜻은 요약이고, 아이가 한 말 그대로는 대화 기록에서 볼 수 있어요.',
    branchCaption: '아이가 고른 선택으로 이어진 캐시 장면',
    originCaption: '아이의 질문이 나온 원래 장면',
    coachBody: '아이가 남긴 질문과 선택을 바탕으로 오늘의 관찰을 정리했어요.',
    coachNote: '오늘 하루의 모습이에요 - 아이의 성격이나 발달을 판단하는 진단은 아니에요.',
    followUpBody: '정답을 알려주기보다, 아이의 생각을 한 번 더 들어보세요.',
  },
  class: {
    heroTitle: '우리 반 수업 기록',
    heroBody:
      '오늘 반 친구들이 함께 읽으며 어떤 질문을 하고 어떤 이야기 길을 만들었는지 담았어요. 여러 아이가 함께 만든 기록이라 우리 아이 한 명의 말은 아니에요.',
    questionStat: '반에서 나온 질문',
    questionsTitle: '우리 반이 함께 만든 질문과 선택',
    questionsBody: '반에서 나온 질문의 뜻(요약)과 그 생각으로 달라진 이야기 길이에요. 반 전체의 기록이라 아이 한 명의 말로 나누지 않았어요.',
    branchCaption: '반이 고른 선택으로 이어진 캐시 장면',
    originCaption: '질문이 나온 원래 장면',
    coachBody: '반에서 나온 질문과 선택을 바탕으로 오늘 수업의 흐름을 정리했어요.',
    coachNote: '오늘 수업 전체의 모습이에요 - 특정 아이를 판단하는 진단은 아니에요.',
    followUpBody: '유치원에서 읽은 이야기를 떠올리며, 이번에는 우리 아이의 생각을 들어보세요.',
  },
} as const;

/** 상시 대화 요약의 태그별 횟수 칩 묶음 - 태그가 하나도 없으면 그리지 않는다. */
function TagCountChips({
  title,
  tags,
}: {
  title: string;
  tags: readonly { label: string; count: number }[];
}) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <View style={styles.reportFocusBox}>
      <Text style={styles.reportFocusLabel}>{title}</Text>
      <View style={styles.reportFocusChips}>
        {tags.map((tag) => (
          <View key={tag.label} style={styles.reportFocusChip}>
            <Text style={styles.reportFocusChipText}>
              {tag.label} · {tag.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * 읽기 전용 "오늘의 질문 기록" 콘텐츠 - hero/통계, 질문별 카드, 코치의 관찰 소견,
 * 오늘 밤의 후속 질문들로 구성된다. 스토리를 끝낸 직후 표시되는 실시간 ParentReportPanel과
 * 부모가 과거 리포트를 다시 볼 때 표시되는 report-history 상세 페이지에서 공유된다 -
 * 둘 다 buildParentReport()로 동일한 방식으로 만들어진 ParentReport를 이 컴포넌트에 전달한다.
 */
export function ReportContent({ parentReport, isWide, illustrationForAssetId, audience = 'child' }: ReportContentProps) {
  const copy = REPORT_COPY[audience];
  return (
    <>
      <View style={styles.reportHero}>
        <Text style={styles.reportEyebrow}>Q-STORY PARENT REPORT</Text>
        <Text style={styles.reportHeroTitle}>{copy.heroTitle}</Text>
        <View style={styles.reportStoryPill}>
          <Text style={styles.reportStoryPillText}>
            {parentReport.storyTitle}
          </Text>
        </View>
        <Text style={styles.reportHeroBody}>{copy.heroBody}</Text>
        <View style={[styles.reportStats, isWide && styles.reportStatsWide]}>
          {[
            { value: String(parentReport.questionCount), label: copy.questionStat },
            {
              value: String(parentReport.changedSceneCount),
              label: '달라진 장면',
            },
            {
              value: formatReportDuration(parentReport.durationSeconds),
              label: '이야기 진행 시간',
            },
          ].map((stat) => (
            <View key={stat.label} style={styles.reportStatCard}>
              <Text style={styles.reportStatValue}>{stat.value}</Text>
              <Text style={styles.reportStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.reportPanel}>
        <Text style={styles.reportPanelTitle}>{copy.questionsTitle}</Text>
        <Text style={styles.reportPanelDescription}>{copy.questionsBody}</Text>

        {parentReport.questionRecords.length > 0 ? (
          <View style={styles.reportQuestionList}>
            {parentReport.questionRecords.map((record, index) => (
              <View key={record.anchorId} style={styles.reportQuestionCard}>
                <View
                  style={[
                    styles.reportQuestionHeader,
                    isWide && styles.reportQuestionHeaderWide,
                  ]}
                >
                  <View style={styles.reportQuestionNumber}>
                    <Text style={styles.reportQuestionNumberText}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.reportQuestionHeading}>
                    <Text style={styles.reportQuestionText}>
                      {record.questionMeaning}
                    </Text>
                    <View style={styles.reportQuestionType}>
                      <Text style={styles.reportQuestionTypeText}>
                        {record.questionTypeLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.reportSceneFigure}>
                  <Image
                    source={illustrationForAssetId(
                      record.imageRef.assetId ?? '',
                    )}
                    resizeMode="cover"
                    style={styles.reportSceneImage}
                    accessibilityLabel={record.imageRef.alt}
                  />
                  <View style={styles.reportSceneCaption}>
                    <Text style={styles.reportSceneCaptionText}>
                      {record.imageRef.kind === 'GENERATED_BRANCH_ASSET'
                        ? copy.branchCaption
                        : copy.originCaption}{' '}
                      · {record.sceneTitle}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportSelectedPath}>
                  <Text style={styles.reportSelectedPathEyebrow}>
                    고른 이야기 길
                  </Text>
                  <Text style={styles.reportSelectedPathTitle}>
                    {record.selectedPathTitle}
                  </Text>
                  <Text style={styles.reportSelectedPathSummary}>
                    {record.selectedPathSummary}
                  </Text>
                  <View style={styles.reportStoryDevelopment}>
                    <Text style={styles.reportStoryDevelopmentLabel}>
                      선택 뒤 이어진 장면
                    </Text>
                    <Text style={styles.reportStoryDevelopmentText}>
                      {record.storyDevelopmentSummary}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.reportEmptyState}>
            <Text style={styles.reportEmptyTitle}>
              오늘은 이야기를 차분히 따라갔어요
            </Text>
            <Text style={styles.reportEmptyBody}>
              질문하지 않은 것도 자연스러운 참여예요. 가장 기억에 남은 장면
              한 곳부터 물어봐 주세요.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.reportCoachPanel}>
        <Text style={styles.reportPanelTitle}>AI 질문 코치의 오늘 관찰</Text>
        <Text style={styles.reportPanelDescription}>{copy.coachBody}</Text>
        <View style={styles.reportCoachSummary}>
          <Text style={styles.reportCoachSummaryText}>
            {parentReport.coachObservation}
          </Text>
        </View>
        {parentReport.coachEvidence.length > 0 && (
          <View style={styles.reportEvidenceBox}>
            <Text style={styles.reportFocusLabel}>
              질문과 선택에서 확인된 근거
            </Text>
            {parentReport.coachEvidence.map((evidence) => (
              <View key={evidence} style={styles.reportBulletRow}>
                <Text style={styles.reportBulletMark}>•</Text>
                <Text style={styles.reportBulletText}>{evidence}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.reportFocusBox}>
          <Text style={styles.reportFocusLabel}>이번 체험에서 보인 접근</Text>
          {parentReport.coachInterpretations.map((interpretation) => (
            <View key={interpretation} style={styles.reportBulletRow}>
              <Text style={styles.reportBulletMark}>•</Text>
              <Text style={styles.reportBulletText}>{interpretation}</Text>
            </View>
          ))}
          <Text style={styles.reportFocusLabel}>관심이 향한 주제</Text>
          <View style={styles.reportFocusChips}>
            {parentReport.focusTopics.map((topic) => (
              <View key={topic} style={styles.reportFocusChip}>
                <Text style={styles.reportFocusChipText}>{topic}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.reportFocusNote}>{copy.coachNote}</Text>
        </View>
      </View>

      {parentReport.companionChat && parentReport.companionChat.turnCount > 0 && (
        <View style={styles.reportPanel}>
          <Text style={styles.reportPanelTitle}>{parentReport.companionChatTitle}</Text>
          <Text style={styles.reportPanelDescription}>
            {parentReport.companionChatDescription}
          </Text>
          <View style={styles.reportStats}>
            <View style={styles.reportStatCard}>
              <Text style={styles.reportStatValue}>
                {parentReport.companionChat.turnCount}
              </Text>
              <Text style={styles.reportStatLabel}>주고받은 대화</Text>
            </View>
          </View>
          <TagCountChips title="궁금해한 주제" tags={parentReport.companionChat.topics} />
          <TagCountChips title="드러난 감정" tags={parentReport.companionChat.tones} />
          <TagCountChips title="관심이 향한 가치" tags={parentReport.companionChat.values} />
        </View>
      )}

      <View style={styles.reportPanel}>
        <Text style={styles.reportPanelTitle}>오늘 밤 이어갈 질문</Text>
        <Text style={styles.reportPanelDescription}>{copy.followUpBody}</Text>
        <View style={styles.reportFollowUpList}>
          {parentReport.followUpQuestions.map((question, index) => (
            <View key={question} style={styles.reportFollowUpCard}>
              <View style={styles.reportFollowUpNumber}>
                <Text style={styles.reportFollowUpNumberText}>
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.reportFollowUpText}>{question}</Text>
            </View>
          ))}
        </View>
        <View style={styles.reportActivity}>
          <Text style={styles.reportActivityTitle}>
            {parentReport.togetherActivity.title}
          </Text>
          <Text style={styles.reportActivityBody}>
            {parentReport.togetherActivity.description}
          </Text>
        </View>
      </View>
    </>
  );
}
