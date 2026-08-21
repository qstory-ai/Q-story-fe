import { Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { getSceneIndex } from '../../lib/runtime-view';
import { styles } from '../styles';

export function ResumeModal({ runtime }: { runtime: OneStoryRuntime }) {
  const { runtimeState, resumeCandidate, resumeStory, dismissResumeAndRestart } =
    runtime;

  if (!(runtimeState.status === 'idle' && resumeCandidate)) {
    return null;
  }

  return (
    <View style={styles.modalScrim} accessibilityViewIsModal>
      <View style={styles.modalCard}>
        <Text style={styles.modalEyebrow}>저장된 이야기</Text>
        <Text style={styles.modalTitle}>
          {getSceneIndex(resumeCandidate.state) + 1}번째 장면부터{'\n'}
          이어서 들을까요?
        </Text>
        <Text style={styles.modalBody}>
          이 기기의 브라우저에만 진행 상황을 저장했어요. 녹음 파일과 확인
          전 문장은 저장하지 않았어요.
        </Text>
        <ActionButton variant="primary" label="이어서 듣기" onPress={resumeStory} />
        <ActionButton
          variant="secondaryFull"
          label="처음부터 읽기"
          onPress={dismissResumeAndRestart}
        />
      </View>
    </View>
  );
}
