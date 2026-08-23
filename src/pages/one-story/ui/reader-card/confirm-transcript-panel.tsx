import { Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function ConfirmTranscriptPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    pendingTranscription,
    questionMode,
    isRoutingQuestion,
    confirmTranscript,
    editTranscriptAsText,
    beginQuestion,
    continueStory,
    retryAfterTranscript,
  } = runtime;

  if (
    !(runtimeState.status === 'processing-question' && pendingTranscription)
  ) {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.questionEyebrow}>
        질문을 보내기 전 한 번만 확인해요
      </Text>
      <Text style={styles.panelTitle}>
        {questionMode === 'text' ? '이대로 물어볼까요?' : '이렇게 말한 게 맞나요?'}
      </Text>
      <View style={styles.transcriptConfirmCard}>
        <Text style={styles.transcriptConfirmText}>
          “{pendingTranscription.speech.transcript}”
        </Text>
      </View>
      <Text style={styles.questionHelp}>
        맞으면 바로 그레텔에게 질문을 보낼게요.
      </Text>
      <ActionButton
        variant="primary"
        disabled={isRoutingQuestion}
        label={
          isRoutingQuestion ? '그레텔이 답을 찾고 있어요' : '네, 이대로 질문할게요'
        }
        onPress={confirmTranscript}
      />
      <View style={styles.splitRow}>
        <ActionButton
          variant="secondary"
          label={questionMode === 'voice' ? '글로 고치기' : '말로 바꾸기'}
          onPress={questionMode === 'voice' ? editTranscriptAsText : beginQuestion}
        />
        <ActionButton
          variant="secondary"
          label="계속 듣기"
          onPress={continueStory}
        />
      </View>
      <ActionButton
        variant="secondaryFull"
        label={`다시 ${questionMode === 'text' ? '쓰기' : '말하기'}`}
        onPress={retryAfterTranscript}
      />
    </View>
  );
}
