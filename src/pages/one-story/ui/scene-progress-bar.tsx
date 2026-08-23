import { View } from 'react-native';

import type { OneStoryRuntime } from '../model';
import { styles } from './styles';

export function SceneProgressBar({ runtime }: { runtime: OneStoryRuntime }) {
  const { isParentReport, isCompactPlayback, scenes, displayedSceneIndex } =
    runtime;

  if (isParentReport) {
    return null;
  }

  return (
    <View
      style={[
        styles.sceneProgress,
        isCompactPlayback && styles.sceneProgressCompactPlayback,
      ]}
    >
      {scenes.map((progressScene, index) => (
        <View
          key={progressScene.id}
          style={[
            styles.progressSegment,
            index <= displayedSceneIndex && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  );
}
