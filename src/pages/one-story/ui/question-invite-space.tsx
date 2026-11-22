import { Pressable, StyleSheet, Text } from 'react-native';

import type { OneStoryRuntime } from '../model';
import type { UseDialogue } from '../model/use-dialogue';
import { inviteAskCopy, inviteAskKind } from '../lib/invite-ask-kind';
import { QuestionSpace } from './question-space';

/**
 * 이야기 속 질문 초대(피그마 질문 896:635). 그레텔이 질문을 말하는 동안은 마이크가 흐리고,
 * 다 말하면 노란 마이크가 켜진다. 마이크를 누르면 대화(DialoguePanel)가 이어 받아 바로 듣기 시작한다.
 * [이야기 계속 듣기]는 질문을 건너뛴다.
 */
export function QuestionInviteSpace({ runtime, dialogue }: { runtime: OneStoryRuntime; dialogue: UseDialogue }) {
  const { isQuestionInvitePlayback, runtimeState, activeQuestionPrompt } = runtime;
  const awaitingInvite = runtimeState.status === 'awaiting-question';
  if (dialogue.open || !(isQuestionInvitePlayback || awaitingInvite)) return null;

  const askCopy = inviteAskCopy(inviteAskKind(activeQuestionPrompt));
  const skip = () => void dialogue.skipInvite();

  return (
    <QuestionSpace
      characterName={dialogue.character.displayName}
      avatarUri={dialogue.character.avatarImageUri}
      bubbleText={activeQuestionPrompt}
      replayAccent
      mic={awaitingInvite ? 'idle' : 'disabled'}
      onMicPress={dialogue.openInvite}
      menuActions={[
        { key: 'ask', label: askCopy.askLabel, onPress: dialogue.openInvite },
        { key: 'continue', label: '이야기 계속 듣기', onPress: skip },
      ]}
    >
      {awaitingInvite && (
        <Pressable accessibilityRole="button" onPress={skip} hitSlop={10} style={styles.skip}>
          <Text style={styles.skipText}>이야기 계속 듣기 ›</Text>
        </Pressable>
      )}
    </QuestionSpace>
  );
}

const styles = StyleSheet.create({
  skip: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  skipText: { color: '#6b6178', fontSize: 18, fontWeight: '700' },
});
