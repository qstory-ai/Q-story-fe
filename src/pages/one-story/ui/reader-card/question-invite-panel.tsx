import { ActivityIndicator, Text, View } from 'react-native';

import { ActionButton, storybookTheme } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import type { UseDialogue } from '../../model/use-dialogue';
import { styles } from '../styles';

export function QuestionInvitePanel({ runtime, dialogue }: { runtime: OneStoryRuntime; dialogue: UseDialogue }) {
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

  const awaitingInvite = runtimeState.status === 'awaiting-question';
  // 초대 대사가 끝난 뒤(awaiting-question)에도 카드를 남겨 아이가 고를 때까지 기다린다 - [궁금한 거 물어보기]를
  // 누르면 그레텔 대화 패널(DialoguePanel)이 이어 받고, [이야기 계속 듣기]는 질문을 건너뛴다.
  if (
    !(
      isQuestionInvitePlayback ||
      awaitingInvite ||
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
          : awaitingInvite
            ? '궁금한 게 있으면 물어봐요. 없으면 이야기를 계속 들어도 돼요.'
          : runtimeState.status === 'awaiting-clarification'
            ? '조금만 더 알려주면 그레텔이 뜻을 이해할 수 있어요.'
            : runtimeState.status === 'awaiting-safety-retry'
              ? '그건 이야기랑 조금 다른 이야기인 것 같아, 다시 말해줄래?'
              : '궁금한 것뿐 아니라 알고 싶은 것, 해 보고 싶은 것, 걱정되는 것도 말해도 돼요.'}
      </Text>
      {isQuestionInvitePlayback ? (
        <View style={styles.questionListening}>
          <ActivityIndicator color={storybookTheme.color.error} size="small" />
          <Text style={styles.questionListeningText}>
            {questionInviteSpeaking
              ? '질문을 듣고 있어요'
              : '질문 음성을 준비하고 있어요'}
          </Text>
        </View>
      ) : awaitingInvite ? (
        <>
          <ActionButton variant="primary" label="궁금한 거 물어보기" onPress={dialogue.openInvite} />
          <ActionButton variant="secondaryFull" label="이야기 계속 듣기" onPress={() => void dialogue.skipInvite()} />
        </>
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
              label="이야기 계속 듣기"
              onPress={continueStory}
            />
          </View>
        </>
      )}
    </View>
  );
}
