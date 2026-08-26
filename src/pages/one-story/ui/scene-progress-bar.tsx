import { View } from 'react-native';

import type { OneStoryRuntime } from '../model';
import { styles } from './styles';

export function SceneProgressBar({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    isParentReport,
    isCompactPlayback,
    scenes,
    displayedSceneIndex,
    runtimeState,
    narrationState,
  } = runtime;

  if (isParentReport) {
    return null;
  }

  // 비디오 플레이어의 스크러버처럼, 지금 읽고 있는 문장의 재생 진행률만큼 매끄럽게
  // 채워지되 인스타 스토리처럼 그 모션은 현재 장면(챕터)의 세그먼트 안에서만 움직인다 -
  // 지난 장면은 꽉 찬 채로 고정, 다음 장면은 비어 있다.
  const currentSceneProgress =
    runtimeState.status === 'complete'
      ? 1
      : Math.max(0, Math.min(1, narrationState.progress));

  return (
    <View
      style={[
        styles.sceneProgress,
        isCompactPlayback && styles.sceneProgressCompactPlayback,
      ]}
    >
      {scenes.map((progressScene, index) => {
        const fill =
          index < displayedSceneIndex
            ? 1
            : index === displayedSceneIndex
              ? currentSceneProgress
              : 0;
        return (
          <View
            key={progressScene.id}
            style={styles.progressSegment}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100) }}
          >
            <View
              style={[
                styles.progressSegmentFill,
                {
                  width: `${fill * 100}%`,
                  transitionProperty: 'width',
                  transitionDuration: '280ms',
                  transitionTimingFunction: 'linear',
                } as never,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}
