import { Pressable, Text, View } from 'react-native';

import { Icon, SafeAreaView, storybookTheme } from '@/shared/ui';

import type { OneStoryRuntime } from '../model';
import { playbackControls } from '../lib/playback-controls';
import { styles } from './styles';

/**
 * 휴대폰(isNarrow)에서 재생 컨트롤(일시정지/다시 듣기/다음 장면/자막)을 화면 하단에 고정하는
 * 도크 - 넓은 화면에선 같은 네 버튼이 TopBar 오른쪽에 놓인다. 비디오 플레이어 관례대로 엄지가
 * 닿는 하단, 아이콘 아래 짧은 라벨, 터치 영역 56px. 버튼 정의는 TopBar와 공유한다
 * (lib/playback-controls.ts). 보임 조건은 runtime.showPlaybackDock 하나로, 도크 자리를 비워
 * 두는 여백(OneStoryPage)과 같은 값을 쓴다.
 */
export function PlaybackDock({ runtime }: { runtime: OneStoryRuntime }) {
  if (!runtime.showPlaybackDock) return null;

  return (
    <SafeAreaView edges={['bottom']} style={styles.playbackDock}>
      <View style={styles.playbackDockRow} accessibilityRole="toolbar" accessibilityLabel="재생 컨트롤">
        {playbackControls(runtime).map((control) => (
          <Pressable
            key={control.key}
            accessibilityRole="button"
            accessibilityLabel={control.accessibilityLabel}
            onPress={control.onPress}
            style={({ pressed }) => [
              styles.dockButton,
              control.primary && styles.dockButtonPrimary,
              pressed && styles.dockButtonPressed,
            ]}
          >
            <Icon
              name={control.icon}
              size={20}
              color={control.dim ? storybookTheme.color.onDarkMuted : storybookTheme.color.gold}
            />
            <Text style={[styles.dockLabel, control.dim && styles.dockLabelDim]} numberOfLines={1}>
              {control.shortLabel}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
