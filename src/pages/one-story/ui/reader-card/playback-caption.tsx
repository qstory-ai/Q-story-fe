import { Pressable, Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import type { UseDialogue } from '../../model/use-dialogue';
import { styles } from '../styles';

export function PlaybackCaption({ runtime, dialogue }: { runtime: OneStoryRuntime; dialogue: UseDialogue }) {
  const {
    isPlaybackDockState,
    currentClip,
    isBranchPlaybackState,
    narrationState,
    branchCaptionSpeaker,
    captionSpeaker,
    captionVisible,
    displayedBranchSubtitle,
    displayedSubtitle,
    sceneEndActive,
    sceneEndAutoAdvancing,
    holdSceneEnd,
    advanceFromSceneEnd,
  } = runtime;

  if (!isPlaybackDockState || !(currentClip || isBranchPlaybackState)) {
    return null;
  }

  if (sceneEndActive) {
    const name = dialogue.character.displayName;
    // 장면 끝 쉼(lib/scene-end-pause) - 다음 장면으로 넘어가기 전, 물어볼 틈을 준다. 안내를 누르면 자동 넘김을
    // 멈추고, "말하기"는 그레텔 대화를 연다(닫으면 다음 장면으로 간다).
    return (
      <View style={styles.playbackContent}>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 장면으로 넘어가지 않고 기다리기" onPress={holdSceneEnd}>
          <Text accessibilityLiveRegion="polite" style={styles.sceneEndPrompt}>
            궁금한 게 있으면 {name}에게 말해 봐
          </Text>
        </Pressable>
        <View style={styles.sceneEndActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void dialogue.openChat()}
            style={({ pressed }) => [styles.sceneEndButton, styles.sceneEndButtonPrimary, pressed && styles.sceneEndButtonPressed]}
          >
            <Text style={[styles.sceneEndButtonText, styles.sceneEndButtonTextPrimary]}>{name}에게 말하기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={advanceFromSceneEnd}
            style={({ pressed }) => [styles.sceneEndButton, pressed && styles.sceneEndButtonPressed]}
          >
            <Text style={styles.sceneEndButtonText}>
              {sceneEndAutoAdvancing ? '바로 다음 장면' : '다음 장면 듣기'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.playbackContent}>
      <View style={styles.captionHeader}>
        <View style={styles.captionSpeakerRow}>
          <View
            style={[
              styles.playingDot,
              (isBranchPlaybackState ||
                narrationState.isSpeaking ||
                narrationState.isPaused) &&
                styles.playingDotActive,
            ]}
          />
          <Text style={styles.playbackSpeaker}>
            {isBranchPlaybackState
              ? branchCaptionSpeaker?.displayName ?? '그레텔'
              : captionSpeaker?.displayName ?? '이야기꾼'}
          </Text>
        </View>
      </View>
      {captionVisible && (
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={styles.playbackSubtitle}
        >
          {isBranchPlaybackState ? displayedBranchSubtitle : displayedSubtitle}
        </Text>
      )}
    </View>
  );
}
