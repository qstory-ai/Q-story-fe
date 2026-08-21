import { Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function FailedRecoverablePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    failedQuestionCopy,
    beginQuestion,
    beginTypedQuestion,
    continueStory,
  } = runtime;

  if (runtimeState.status !== 'failed-recoverable') {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.questionEyebrow}>{failedQuestionCopy?.eyebrow}</Text>
      <Text style={styles.panelTitle}>{failedQuestionCopy?.title}</Text>
      <Text style={styles.questionHelp}>{failedQuestionCopy?.help}</Text>
      <ActionButton
        variant="record"
        icon="●"
        label="다시 말로 질문하기"
        onPress={beginQuestion}
      />
      <ActionButton
        variant="secondaryFull"
        label="글로 질문하기"
        onPress={beginTypedQuestion}
      />
      <ActionButton
        variant="secondaryFull"
        label="이번 질문 건너뛰기"
        onPress={continueStory}
      />
    </View>
  );
}
