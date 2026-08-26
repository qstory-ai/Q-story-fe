import { Pressable, Text, View } from 'react-native';

import { personalizeStoryText } from '@/entities/narration';
import { ActionButton } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function AwaitingChoicePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    childName,
    displayedBranchSubtitle,
    selectRouteOption,
    continueStory,
  } = runtime;

  if (runtimeState.status !== 'awaiting-choice') {
    return null;
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
