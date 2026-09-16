import { Pressable, Text, View } from 'react-native';

import { Icon, storybookTheme, type IconName } from '@/shared/ui';

import type { OneStoryRuntime } from '../model';
import { styles } from './styles';

/**
 * 휴대폰(isNarrow)에서 재생 컨트롤(일시정지/다시 듣기/다음 장면/자막)을 화면 하단에 고정하는
 * 도크 - 넓은 화면에선 같은 네 버튼이 TopBar 오른쪽에 라벨과 함께 놓이지만, 폰에선 그 자리가
 * 없어서 라벨 없는 아이콘 8개가 두 줄로 쌓였고(어느 게 뭔지 알 수 없었다) 엄지가 닿지 않는
 * 화면 맨 위에 있었다. 비디오 플레이어 관례대로 하단, 아이콘 아래 짧은 라벨, 터치 영역 56px.
 * TopBar와 같은 조건(재생 도킹 상태 + 클립 있음)에서만 보인다.
 */
export function PlaybackDock({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    isNarrow,
    isParentReport,
    isPlaybackDockState,
    currentClip,
    isBranchPlaybackState,
    narrationState,
    captionVisible,
    setCaptionVisible,
    toggleNarration,
    replayCurrent,
    skipCurrentScene,
  } = runtime;

  if (!isNarrow || isParentReport || !isPlaybackDockState || !(currentClip || isBranchPlaybackState)) {
    return null;
  }

  return (
    <View style={styles.playbackDock} accessibilityRole="toolbar" accessibilityLabel="재생 컨트롤">
      <DockButton
        icon={narrationState.isPaused ? 'play' : 'pause'}
        label={narrationState.isPaused ? '이어 듣기' : '일시정지'}
        primary
        onPress={toggleNarration}
      />
      <DockButton
        icon="replay"
        label={isBranchPlaybackState ? '전개 다시' : '문장 다시'}
        accessibilityLabel={isBranchPlaybackState ? '선택한 전개 처음부터 다시 듣기' : '현재 문장 다시 듣기'}
        onPress={replayCurrent}
      />
      <DockButton icon="next" label="다음 장면" onPress={skipCurrentScene} />
      <DockButton
        icon="captions"
        label={captionVisible ? '자막 끄기' : '자막 켜기'}
        dim={!captionVisible}
        onPress={() => setCaptionVisible((visible) => !visible)}
      />
    </View>
  );
}

function DockButton({
  icon,
  label,
  accessibilityLabel,
  primary = false,
  dim = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel?: string;
  primary?: boolean;
  dim?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dockButton,
        primary && styles.dockButtonPrimary,
        pressed && styles.dockButtonPressed,
      ]}
    >
      <Icon
        name={icon}
        size={20}
        color={dim ? 'rgba(255,255,255,0.55)' : storybookTheme.color.gold}
      />
      <Text style={[styles.dockLabel, dim && styles.dockLabelDim]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
