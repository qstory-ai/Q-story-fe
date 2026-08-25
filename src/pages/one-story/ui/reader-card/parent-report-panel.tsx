import { Pressable, Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';
import { ReportContent } from './report-content';

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
      <ReportContent
        parentReport={parentReport}
        isWide={isWide}
        illustrationForAssetId={storyPackage.illustrationForAssetId}
      />

      <View
        style={[styles.reportActionPanel, isWide && styles.reportActionPanelWide]}
      >
        <View style={styles.reportActionCopy}>
          <Text style={styles.reportActionEyebrow}>1분이면 충분해요</Text>
          <Text style={styles.reportActionTitle}>방금 체험은 어떠셨나요?</Text>
          <Text style={styles.reportActionBody}>
            좋았던 점과 불편했던 점을 남겨주시면 더 나은 이야기로 다듬는 데
            바로 반영할게요.
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
