import { Text, View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { formatDuration } from '../../lib/runtime-view';
import { styles } from '../styles';

export function RecordingVoicePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    questionMode,
    recorder,
    meterPercent,
    beginTypedQuestion,
    continueStory,
    finishQuestion,
  } = runtime;

  if (
    !(runtimeState.status === 'recording-question' && questionMode === 'voice')
  ) {
    return null;
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.recordingTitle}>목소리를 듣고 있어요</Text>
      <Text style={styles.recordingTime}>
        {formatDuration(recorder.durationMillis)}
      </Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${meterPercent}%` }]} />
      </View>
      <Text style={styles.recordingGuide}>
        {typeof recorder.meteringDb === 'number'
          ? '막대가 움직이면 목소리가 잘 담기고 있어요.'
          : '녹음 시간이 흐르고 있어요. 말한 뒤 문장 확인을 눌러 주세요.'}
      </Text>
      <View style={styles.splitRow}>
        <ActionButton
          variant="secondary"
          label="글로 질문하기"
          onPress={beginTypedQuestion}
        />
        <ActionButton
          variant="secondary"
          label="계속 듣기"
          onPress={continueStory}
        />
      </View>
      <ActionButton
        variant="stop"
        label="말 다 했어요 · 문장 확인하기"
        onPress={finishQuestion}
      />
    </View>
  );
}
