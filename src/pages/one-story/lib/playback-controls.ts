import type { IconName } from '@/shared/ui';

import type { OneStoryRuntime } from '../model';

export type PlaybackControl = {
  key: 'toggle' | 'replay' | 'next';
  icon: IconName;
  /** 넓은 화면 상단 바에 아이콘 옆에 붙는 글자. */
  label: string;
  /** 폰 하단 도크의 아이콘 아래 짧은 글자. */
  shortLabel: string;
  accessibilityLabel: string;
  primary?: boolean;
  /** 꺼진 상태 - 아이콘·글자를 흐리게. */
  dim?: boolean;
  onPress: () => void;
};

/**
 * 재생 컨트롤 세 개의 단일 정의 - TopBar(넓은 화면, 가로 배치)와 PlaybackDock(폰, 하단 도크)이 이
 * 목록을 각자의 레이아웃으로만 그린다(라벨·접근성 문구가 두 곳에서 어긋나지 않게).
 */
export function playbackControls(runtime: OneStoryRuntime): PlaybackControl[] {
  const {
    narrationState,
    isBranchPlaybackState,
    sceneEndActive,
    sceneEndAutoAdvancing,
    toggleNarration,
    replayCurrent,
    skipCurrentScene,
  } = runtime;
  // 장면 끝 쉼에서 아이가 자동 넘김을 멈췄으면 "이어 듣기"로 다음 장면에 간다.
  const paused = sceneEndActive ? !sceneEndAutoAdvancing : narrationState.isPaused;
  return [
    {
      key: 'toggle',
      icon: paused ? 'play' : 'pause',
      label: paused ? '이어 듣기' : '일시정지',
      shortLabel: paused ? '이어 듣기' : '일시정지',
      accessibilityLabel: paused ? '이어 듣기' : '일시정지',
      primary: true,
      onPress: () => void toggleNarration(),
    },
    {
      key: 'replay',
      icon: 'replay',
      label: isBranchPlaybackState ? '선택 전개 다시' : '현재 문장 다시',
      shortLabel: isBranchPlaybackState ? '전개 다시' : '문장 다시',
      accessibilityLabel: isBranchPlaybackState ? '선택한 전개 처음부터 다시 듣기' : '현재 문장 다시 듣기',
      onPress: () => void replayCurrent(),
    },
    {
      key: 'next',
      icon: 'next',
      label: '다음 장면',
      shortLabel: '다음 장면',
      accessibilityLabel: '다음 장면',
      onPress: () => void skipCurrentScene(),
    },
    // 자막 켜기/끄기는 버튼이 많다는 의견(PM)으로 이야기 홈 메뉴로 옮겼다(modals/home-menu-modal).
  ];
}
