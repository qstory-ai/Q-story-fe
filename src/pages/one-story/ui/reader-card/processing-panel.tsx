import { ActivityIndicator, Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function ProcessingPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    pendingTranscription,
    questionMode,
    beginQuestion,
    beginTypedQuestion,
    continueStory,
  } = runtime;

  if (
    !(runtimeState.status === 'processing-question' && !pendingTranscription)
  ) {
    return null;
  }

  return (
    <View style={styles.loadingGroup}>
      <ActivityIndicator color="#F6C64D" size="large" />
      <Text style={styles.loadingTitle}>
        헨젤과 그레텔이{'\n'}
        아이의 생각을 살펴보고 있어요
      </Text>
      <Text style={styles.loadingBody}>
        이야기와 어울리는 안전한 길을 찾으면 바로 이어갈게요.
      </Text>
      <View style={styles.loadingDots}>
        <View style={styles.loadingDot} />
        <View style={styles.loadingDot} />
        <View style={styles.loadingDot} />
      </View>
      <View style={styles.recoveryActions}>
        <ActionButton
          variant="secondaryFull"
          label={questionMode === 'text' ? '말로 바꾸기' : '글로 바꾸기'}
          onPress={questionMode === 'text' ? beginQuestion : beginTypedQuestion}
        />
        <ActionButton
          variant="secondaryFull"
          label="이번 질문 건너뛰기"
          onPress={continueStory}
        />
      </View>
    </View>
  );
}
