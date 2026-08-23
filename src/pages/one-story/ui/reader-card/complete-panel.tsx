import { Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';
import { ParentReportPanel } from './parent-report-panel';

export function CompletePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const { runtimeState, isParentReport, openParentReport, finishExperience, restartStory } =
    runtime;

  if (runtimeState.status !== 'complete') {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      {!isParentReport ? (
        <>
          <Text style={styles.completeMark}>✦</Text>
          <Text style={styles.heroTitle}>
            오늘 이야기를{'\n'}끝까지 함께 읽었어!
          </Text>
          <Text style={styles.introBody}>
            세 번의 질문과 선택을 지나 헨젤과 그레텔이 집으로 돌아와 새로운
            약속을 세웠어요.
          </Text>
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
