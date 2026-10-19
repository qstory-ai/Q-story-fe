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
    isClassLesson,
    completionSaveStatus,
    retryCompletionSave,
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
            {objectParticle}{'\n'}끝까지 함께 읽었어요!
          </Text>
          <Text style={styles.introBody}>{parentReport.completedStory}</Text>
          {/* 완주 기록 저장 안내 - 실패하면 리포트·수업 완료가 남지 않으니 숨기지 않고 알린다(lib/completion-save). */}
          {completionSaveStatus === 'saving' && (
            <Text style={styles.completionSaveNote} accessibilityLiveRegion="polite">
              오늘 기록을 저장하고 있어요…
            </Text>
          )}
          {completionSaveStatus === 'failed' && (
            <View style={styles.completionSaveError} accessibilityRole="alert">
              <Text style={styles.completionSaveErrorTitle}>오늘 기록을 아직 저장하지 못했어요</Text>
              <Text style={styles.completionSaveErrorBody}>
                인터넷 연결을 확인한 뒤 다시 저장해 주세요. 저장해야 {isClassLesson ? '수업 기록과 보호자 리포트' : '리포트'}가 남아요.
              </Text>
              <ActionButton variant="secondaryFull" label="다시 저장하기" onPress={retryCompletionSave} />
            </View>
          )}
          <ActionButton
            variant="primary"
            // 반 수업은 선생님이 보는 수업 기록 - 보호자 리포트는 연결된 보호자에게 따로 간다.
            label={isClassLesson ? '오늘 수업 기록 보기' : '보호자 리포트 보기'}
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
