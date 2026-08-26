import { Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';
import { hasKoreanBatchim } from '@/entities/narration';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';
import { ParentReportPanel } from './parent-report-panel';

export function CompletePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    isParentReport,
    openParentReport,
    finishExperience,
    restartStory,
    parentReport,
  } = runtime;

  if (runtimeState.status !== 'complete') {
    return null;
  }

  const objectParticle = hasKoreanBatchim(parentReport.storyTitle) ? '을' : '를';

  return (
    <View style={styles.contentGroup}>
      {!isParentReport ? (
        <>
          <Text style={styles.completeMark}>✦</Text>
          <Text style={styles.heroTitle}>
            오늘 {parentReport.storyTitle}
            {objectParticle}{'\n'}함께 읽었어요! 더 대화 나눠 볼까요?
          </Text>
          <Text style={styles.introBody}>{parentReport.completedStory}</Text>
          <ActionButton
            variant="primary"
            label="부모 리포트 보기"
            onPress={openParentReport}
          />
          <View style={styles.splitRow}>
            <ActionButton
              variant="secondary"
              label="홈으로 돌아가기"
              onPress={finishExperience}
            />
            <ActionButton
              variant="secondary"
              label="다시 읽기"
              onPress={restartStory}
            />
          </View>
        </>
      ) : (
        <ParentReportPanel runtime={runtime} />
      )}
    </View>
  );
}
