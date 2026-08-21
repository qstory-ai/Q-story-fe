import { Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function RecordingTextPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    questionMode,
    typedQuestion,
    setTypedQuestion,
    beginQuestion,
    continueStory,
    processTypedQuestion,
  } = runtime;

  if (
    !(runtimeState.status === 'recording-question' && questionMode === 'text')
  ) {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.recordingTitle}>궁금한 것을 글로 적어 주세요</Text>
      <Text style={styles.questionHelp}>
        짧은 질문, 추측, 경고, 방법을 그대로 적어도 괜찮아요.
      </Text>
      <TextInput
        value={typedQuestion}
        onChangeText={(value) => setTypedQuestion(value.slice(0, 240))}
        placeholder="예: 저 하얀 새는 우리를 어디로 데려가는 거야?"
        placeholderTextColor="#998EA5"
        maxLength={240}
        multiline
        autoFocus
        returnKeyType="done"
        style={styles.typedQuestionInput}
      />
      <Text style={styles.typedQuestionCount}>
        {typedQuestion.length} / 240
      </Text>
      <View style={styles.splitRow}>
        <ActionButton
          variant="secondary"
          label="말로 바꾸기"
          onPress={beginQuestion}
        />
        <ActionButton
          variant="secondary"
          label="계속 듣기"
          onPress={continueStory}
        />
      </View>
      <ActionButton
        variant="primary"
        label="질문 내용 확인하기"
        disabled={!typedQuestion.trim()}
        onPress={processTypedQuestion}
      />
    </View>
  );
}
