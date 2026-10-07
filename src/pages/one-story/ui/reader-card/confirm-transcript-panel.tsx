import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { withParticle } from '@/shared/lib/korean-particle';
import { ActionButton } from '@/shared/ui';

import { countdownSeconds, createAutoConfirm } from '../../lib/auto-confirm';
import { AUTO_CONFIRM_MS } from '../../lib/constants';
import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function ConfirmTranscriptPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    speaker,
    branchCaptionSpeaker,
    pendingTranscription,
    questionMode,
    isRoutingQuestion,
    confirmTranscript,
    editTranscriptAsText,
    beginQuestion,
    continueStory,
    retryAfterTranscript,
  } = runtime;

  const friendName =
    speaker?.displayName ?? branchCaptionSpeaker?.displayName ?? '친구';
  const visible =
    runtimeState.status === 'processing-question' && !!pendingTranscription;
  const autoConfirmActive =
    visible && questionMode === 'voice' && !isRoutingQuestion;
  const transcriptText = pendingTranscription?.speech.transcript ?? null;
  const confirmRef = useRef(confirmTranscript);
  useEffect(() => {
    confirmRef.current = confirmTranscript;
  }, [confirmTranscript]);
  const [secondsLeft, setSecondsLeft] = useState(
    countdownSeconds(AUTO_CONFIRM_MS),
  );

  // 음성 문장이 보이면 카운트다운 후 자동으로 보낸다. 상태가 바뀌거나 언마운트되면 정리한다.
  useEffect(() => {
    if (!autoConfirmActive) return undefined;
    const controller = createAutoConfirm(AUTO_CONFIRM_MS, () => {
      void confirmRef.current();
    });
    controller.start();
    const ticker = setInterval(() => {
      setSecondsLeft(countdownSeconds(controller.remainingMs()));
    }, 250);
    return () => {
      clearInterval(ticker);
      setSecondsLeft(countdownSeconds(AUTO_CONFIRM_MS));
      controller.cancel();
    };
  }, [autoConfirmActive, transcriptText]);

  if (!visible || !pendingTranscription) {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.questionEyebrow}>
        내가 한 말이에요
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
        {autoConfirmActive && secondsLeft > 0
          ? `${secondsLeft}초 뒤에 ${friendName}에게 보낼게요`
          : `맞으면 바로 ${friendName}에게 질문을 보낼게요.`}
      </Text>
      <ActionButton
        variant="primary"
        disabled={isRoutingQuestion}
        label={
          isRoutingQuestion ? `${withParticle(friendName, '이/가')} 답을 찾고 있어요` : '네, 이대로 질문할게요'
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
          label="이야기 계속 듣기"
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
