import { Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function PlaybackCaption({ runtime }: { runtime: OneStoryRuntime }) {
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
  } = runtime;

  if (!isPlaybackDockState || !(currentClip || isBranchPlaybackState)) {
    return null;
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
