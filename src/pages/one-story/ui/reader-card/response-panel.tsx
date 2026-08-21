import { Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function ResponsePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    plan,
    isBranchPlaybackState,
    isSafetyRedirect,
    isStoryChange,
    lastTranscript,
  } = runtime;

  if (
    !(
      runtimeState.status === 'playing-response' &&
      plan &&
      !isBranchPlaybackState
    )
  ) {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <View style={[styles.changeBadge, !isStoryChange && styles.answerBadge]}>
        <Text style={styles.changeBadgeText}>
          {isSafetyRedirect
            ? '안전한 방법으로 이어가요'
            : isStoryChange
              ? '아이의 말이 이야기에 들어왔어요'
              : '이야기가 질문에 대답해요'}
        </Text>
      </View>
      <Text style={styles.responseText}>{plan.text}</Text>
      {!lastTranscript ? (
        <Text style={styles.fallbackText}>
          이번에는 말을 정확히 확인하지 못해도 이야기가 멈추지 않도록
          준비된 길로 이어가요.
        </Text>
      ) : null}
    </View>
  );
}
