import { ActivityIndicator, Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function QuestionInvitePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    isQuestionInvitePlayback,
    runtimeState,
    activeQuestionOrdinal,
    activeQuestionPrompt,
    speaker,
    questionInviteSpeaking,
    beginQuestion,
    beginTypedQuestion,
    continueStory,
  } = runtime;

  if (
    !(
      isQuestionInvitePlayback ||
      runtimeState.status === 'awaiting-question' ||
      runtimeState.status === 'awaiting-clarification' ||
      runtimeState.status === 'awaiting-safety-retry'
    )
  ) {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.questionEyebrow}>
        이야기 속 질문 {activeQuestionOrdinal}
      </Text>
      <Text style={styles.questionTitle}>{activeQuestionPrompt}</Text>
      <Text style={styles.questionHelp}>
        {isQuestionInvitePlayback
          ? `${speaker?.displayName ?? '이야기 친구'}의 질문을 들어봐요.`
          : runtimeState.status === 'awaiting-clarification'
            ? '조금만 더 알려주면 그레텔이 뜻을 이해할 수 있어요.'
            : runtimeState.status === 'awaiting-safety-retry'
              ? '그건 이야기랑 조금 다른 이야기인 것 같아, 다시 말해줄래?'
              : '궁금한 것뿐 아니라 알고 싶은 것, 해 보고 싶은 것, 걱정되는 것도 말해도 돼요.'}
      </Text>
      {isQuestionInvitePlayback ? (
        <View style={styles.questionListening}>
          <ActivityIndicator color="#E46647" size="small" />
          <Text style={styles.questionListeningText}>
            {questionInviteSpeaking
              ? '질문을 듣고 있어요'
              : '질문 음성을 준비하고 있어요'}
          </Text>
        </View>
      ) : (
        <>
          <ActionButton
            variant="record"
            icon="●"
            label="말로 질문하기"
            onPress={beginQuestion}
          />
          <View style={styles.splitRow}>
            <ActionButton
              variant="secondary"
              label="글로 질문하기"
              onPress={beginTypedQuestion}
            />
            <ActionButton
              variant="secondary"
              label="건너뛰기"
              onPress={continueStory}
            />
          </View>
        </>
      )}
    </View>
  );
}
