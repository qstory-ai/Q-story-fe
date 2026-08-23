import { Image, Pressable, Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import { formatReportDuration } from '../../lib/runtime-view';
import { styles } from '../styles';

export function ParentReportPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    isWide,
    parentReport,
    openCompletionSurvey,
    finishExperience,
    restartStory,
    storyPackage,
  } = runtime;

  return (
    <View style={styles.parentReportContent}>
      <View style={styles.reportHero}>
        <Text style={styles.reportEyebrow}>Q-STORY PARENT REPORT</Text>
        <Text style={styles.reportHeroTitle}>오늘의 질문 기록</Text>
        <View style={styles.reportStoryPill}>
          <Text style={styles.reportStoryPillText}>
            {parentReport.storyTitle}
          </Text>
        </View>
        <Text style={styles.reportHeroBody}>
          점수가 아니라, 오늘 아이가 무엇을 궁금해하고 어떤 이야기 길을
          만들었는지 담았어요.
        </Text>
        <View style={[styles.reportStats, isWide && styles.reportStatsWide]}>
          {[
            { value: String(parentReport.questionCount), label: '아이 질문' },
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
        <Text style={styles.reportPanelTitle}>
          아이가 실제로 만든 질문과 선택
        </Text>
        <Text style={styles.reportPanelDescription}>
          원본 음성이나 전사 전문 대신, 아이가 확인한 질문의 뜻과 그 생각으로
          달라진 이야기 길을 보여드려요.
        </Text>

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
                      “{record.questionMeaning}”
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
                    source={storyPackage.illustrationForAssetId(
                      record.imageRef.assetId ??
                        storyPackage.reportCopy.defaultReportImageAssetId,
                    )}
                    resizeMode="cover"
                    style={styles.reportSceneImage}
                    accessibilityLabel={record.imageRef.alt}
                  />
                  <View style={styles.reportSceneCaption}>
                    <Text style={styles.reportSceneCaptionText}>
                      {record.imageRef.kind === 'GENERATED_BRANCH_ASSET'
                        ? '아이가 고른 선택으로 이어진 캐시 장면'
                        : '아이의 질문이 나온 원래 장면'}{' '}
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
        <Text style={styles.reportPanelDescription}>
          세 번의 질문과 선택에서 확인된 근거를 먼저 보고, 이번 체험에서
          나타난 접근을 조심스럽게 해석했어요.
        </Text>
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
          <Text style={styles.reportFocusNote}>
            이 내용은 한 편의 질문 기록에서 세운 관찰 가설이에요. 아이의
            고정된 성향·능력이나 발달 수준을 진단하는 결과가 아니에요.
          </Text>
        </View>
      </View>

      <View style={styles.reportPanel}>
        <Text style={styles.reportPanelTitle}>오늘 밤 이어갈 질문</Text>
        <Text style={styles.reportPanelDescription}>
          정답을 알려주기보다, 아이의 생각을 한 번 더 들어보세요.
        </Text>
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

      <View
        style={[styles.reportActionPanel, isWide && styles.reportActionPanelWide]}
      >
        <View style={styles.reportActionCopy}>
          <Text style={styles.reportActionEyebrow}>1분이면 충분해요</Text>
          <Text style={styles.reportActionTitle}>방금 체험은 어떠셨나요?</Text>
          <Text style={styles.reportActionBody}>
            좋았던 점과 불편했던 점을 남겨주시면 다음 베타를 더 자연스럽게
            다듬는 데 바로 반영할게요.
          </Text>
        </View>
        <View style={styles.reportActionButtons}>
          <Pressable
            accessibilityRole="button"
            style={styles.reportPrimaryAction}
            onPress={openCompletionSurvey}
          >
            <Text style={styles.reportPrimaryActionText}>
              1분 체험 후기 남기기 →
            </Text>
          </Pressable>
          <View style={styles.reportSecondaryActionRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.reportSecondaryAction}
              onPress={finishExperience}
            >
              <Text style={styles.reportSecondaryActionText}>
                홈으로 돌아가기
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.reportSecondaryAction}
              onPress={restartStory}
            >
              <Text style={styles.reportSecondaryActionText}>
                같은 이야기 다시 읽기
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
