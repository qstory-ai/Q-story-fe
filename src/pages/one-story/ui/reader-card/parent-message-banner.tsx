import { Pressable, Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function ParentMessageBanner({ runtime }: { runtime: OneStoryRuntime }) {
  const { parentMessage, isPlaybackDockState, runtimeState, restartStory } = runtime;

  if (!parentMessage || isPlaybackDockState) {
    return null;
  }

  return (
    <View style={styles.parentMessage}>
      <Text style={styles.parentMessageTitle}>부모님 확인</Text>
      <Text style={styles.parentMessageText}>{parentMessage}</Text>
      {runtimeState.status !== 'idle' ? (
        <Pressable onPress={restartStory}>
          <Text style={styles.parentMessageAction}>처음 화면으로 돌아가기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
