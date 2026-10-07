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
    voiceListenPrompt,
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
      <Text style={styles.recordingTitle}>{voiceListenPrompt}</Text>
      <Text style={styles.recordingTime}>
        {formatDuration(recorder.durationMillis)}
      </Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${meterPercent}%` }]} />
      </View>
      <Text style={styles.recordingGuide}>
        {typeof recorder.meteringDb === 'number'
          ? '말을 멈추면 저절로 끝나요.'
          : '말한 뒤 아래 버튼을 눌러 주세요.'}
      </Text>
      <View style={styles.splitRow}>
        <ActionButton
          variant="secondary"
          label="글로 질문하기"
          onPress={beginTypedQuestion}
        />
        <ActionButton
          variant="secondary"
          label="그만할래"
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
