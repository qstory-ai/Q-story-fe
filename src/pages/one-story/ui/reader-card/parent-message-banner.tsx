import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function ParentMessageBanner({ runtime }: { runtime: OneStoryRuntime }) {
  const { parentMessage, isPlaybackDockState, runtimeState, restartStory } = runtime;
  // Q-34: 처음 화면으로 돌아가면 지금까지 들은 위치와 질문 기록이 사라지므로 한 번 더 묻는다.
  const [confirmingRestart, setConfirmingRestart] = useState(false);

  if (!parentMessage || isPlaybackDockState) {
    return null;
  }

  return (
    <View style={styles.parentMessage}>
      <Text style={styles.parentMessageTitle}>부모님 확인</Text>
      <Text style={styles.parentMessageText}>{parentMessage}</Text>
      {runtimeState.status === 'idle' ? null : confirmingRestart ? (
        <>
          <Text style={styles.parentMessageText}>
            처음 화면으로 가면 지금까지 들은 곳과 질문 기록이 사라져요.
          </Text>
          <Pressable accessibilityRole="button" onPress={restartStory}>
            <Text style={styles.parentMessageAction}>네, 처음 화면으로</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmingRestart(false)}>
            <Text style={styles.parentMessageAction}>아니요, 여기 있을게요</Text>
          </Pressable>
        </>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setConfirmingRestart(true)}>
          <Text style={styles.parentMessageAction}>처음 화면으로 돌아가기</Text>
        </Pressable>
      )}
    </View>
  );
}
