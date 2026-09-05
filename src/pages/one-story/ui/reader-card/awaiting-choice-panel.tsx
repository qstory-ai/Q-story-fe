import { Pressable, Text, View } from 'react-native';

import { personalizeStoryText } from '@/entities/narration';
import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';
import { LoadingPanel } from './loading-panel';

export function AwaitingChoicePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    childName,
    displayedBranchSubtitle,
    selectRouteOption,
    continueStory,
    isPreparingResponseAudio,
  } = runtime;

  if (runtimeState.status !== 'awaiting-choice') {
    return null;
  }

  // 선택 직후에도 status는 여전히 'awaiting-choice'로 남아 있고(branchLine의 TTS를
  // 준비하는 최대 RESPONSE_AUDIO_PREPARE_MS 동안), 이 사이에 선택지 목록을 그대로 두면
  // 화면이 멈춘 것처럼 보이고 아이가 다른 선택지를 또 눌러버릴 수 있다. ProcessingPanel과
  // 같은 로딩 시각언어로 대체해 대기 중임을 분명히 한다.
  if (isPreparingResponseAudio) {
    return (
      <LoadingPanel
        title={
          <>
            헨젤과 그레텔이{'\n'}
            다음 이야기를 준비하고 있어요
          </>
        }
        body="고른 대로 이야기를 이어갈게요, 조금만 기다려 주세요."
      />
    );
  }

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.questionEyebrow}>
        정답은 없어요, 마음에 드는 방법을 골라요
      </Text>
      <Text style={styles.panelTitle}>
        {displayedBranchSubtitle ||
          personalizeStoryText(runtimeState.plan.text, childName)}
      </Text>
      <View style={styles.choiceList}>
        {runtimeState.plan.options.map((option, index) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}번 선택, ${option.label}`}
            style={({ pressed }) => [
              styles.choiceButton,
              pressed && styles.choiceButtonPressed,
            ]}
            onPress={() => selectRouteOption(option.id)}
          >
            <View style={styles.choiceNumber}>
              <Text style={styles.choiceNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.choiceCopy}>
              <Text style={styles.choiceLabel}>{option.label}</Text>
              <Text style={styles.choiceMeaning}>{option.meaning}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <ActionButton
        variant="secondaryFull"
        label="선택하지 않고 계속 듣기"
        onPress={continueStory}
      />
    </View>
  );
}
