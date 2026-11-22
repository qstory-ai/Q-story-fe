import { Icon } from '@/shared/ui';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { OneStoryRuntime } from '../model';
import type { UseDialogue } from '../model/use-dialogue';
import { scaledText, textScaleLabel, useReaderTextScale, type ReaderTextScaleKey } from '../lib/reader-text-scale';

/**
 * 아이 플레이어 화면 틀(피그마 「인터랙션 플로우_수정본」 03 읽기 · 04 일시정지 · 05 메뉴 열기).
 * - 왼쪽 위 메뉴 버튼: 누르면 낭독을 멈추고 세로 타일 메뉴(글씨 · 다음 장면 · 장면 목록 · 처음부터 · 나가기)를 연다.
 * - 가운데 위 진행 막대: 이야기 전체에서 지금 어디쯤인지.
 * - 오른쪽 위 일시정지/재생 버튼, 멈춘 동안은 화면을 살짝 어둡게 하고 가운데 큰 재생 버튼을 띄운다.
 * - 아래 자막 카드와 말하는 캐릭터 동그라미. 캐릭터를 누르면 그레텔과 이야기한다.
 * 아이콘은 피그마에서 내려받은 public/player/*.svg를 그대로 쓴다.
 */

const icon = (name: string) => `${import.meta.env.BASE_URL}player/${name}.svg`;

export const playerColor = {
  purple500: '#7550d3',
  purple50: '#f5f1fd',
  purpleTrack: '#eae2fa',
  neutral50: '#faf8fc',
  neutral200: '#e8e2ee',
  neutral400: '#b5abbf',
  neutral900: '#27222d',
  yellow: '#ffd447',
  white: '#ffffff',
} as const;

export function PlayerIcon({ name, size, style }: { name: string; size: number; style?: object }) {
  return <Image source={{ uri: icon(name) }} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}

export function PlayerIconButton({
  iconName,
  label,
  onPress,
  variant = 'white',
  size = 64,
  iconSize = 28,
  style,
}: {
  iconName: string;
  label: string;
  onPress: () => void;
  variant?: 'white' | 'outlined' | 'purple';
  size?: number;
  iconSize?: number;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        chrome.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'outlined' && chrome.iconButtonOutlined,
        variant === 'purple' && chrome.iconButtonPurple,
        pressed && chrome.pressed,
        style,
      ]}
    >
      <PlayerIcon name={iconName} size={iconSize} />
    </Pressable>
  );
}

/** 이야기 전체 진행률(0~1) - 지난 장면 수 + 지금 장면 안 진행률. */
function storyProgress(runtime: OneStoryRuntime) {
  const { totalScenes, displayedSceneIndex, runtimeState, narrationState } = runtime;
  if (runtimeState.status === 'complete') return 1;
  if (totalScenes <= 0) return 0;
  const inScene = Math.max(0, Math.min(1, narrationState.progress));
  return Math.max(0, Math.min(1, (displayedSceneIndex + inScene) / totalScenes));
}

export function PlayerProgress({ runtime, compact }: { runtime: OneStoryRuntime; compact: boolean }) {
  const progress = storyProgress(runtime);
  const trackWidth = compact ? 140 : 240;
  const label = `${Math.min(runtime.displayedSceneIndex + 1, runtime.totalScenes)} / ${runtime.totalScenes} 장면`;
  return (
    <View
      style={[chrome.progressPill, compact && chrome.progressPillCompact]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <View style={[chrome.track, { width: trackWidth }]}>
        <View style={[chrome.trackFill, { width: `${progress * 100}%` }, widthTransition]} />
        <View style={[chrome.knob, { left: progress * trackWidth - 8.5 }, leftTransition]} />
      </View>
    </View>
  );
}

const widthTransition = { transitionProperty: 'width', transitionDuration: '280ms', transitionTimingFunction: 'linear' } as never;
const leftTransition = { transitionProperty: 'left', transitionDuration: '280ms', transitionTimingFunction: 'linear' } as never;

type MenuTile = {
  key: string;
  iconName: string;
  label: string;
  tone: 'sky' | 'orange' | 'green' | 'pink' | 'neutral';
  onPress: () => void;
};

const TILE_TONE = StyleSheet.create<Record<MenuTile['tone'], { backgroundColor: string; borderColor: string; borderWidth: number }>>({
  sky: { backgroundColor: '#f1f9ff', borderColor: '#5eb6f6', borderWidth: 1 },
  orange: { backgroundColor: '#fff5ef', borderColor: '#fd7b26', borderWidth: 2 },
  green: { backgroundColor: '#f1fcf6', borderColor: '#7bd9a6', borderWidth: 1 },
  pink: { backgroundColor: '#fff2f5', borderColor: '#ff6685', borderWidth: 2 },
  neutral: { backgroundColor: '#ffffff', borderColor: '#d6cedf', borderWidth: 1.5 },
});

/**
 * 이야기 중 화면 틀 전체. 메뉴 열림은 OneStoryPage가 갖고(menuOpen), 열 때 낭독을 멈추고 닫을 때 다시 잇는 것도
 * 이 컴포넌트가 맡는다.
 */
export function PlayerChrome({
  runtime,
  menuOpen,
  onMenuOpenChange,
  textScaleKey,
  onCycleTextScale,
  onOpenChapters,
}: {
  runtime: OneStoryRuntime;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  textScaleKey: ReaderTextScaleKey;
  onCycleTextScale: () => void;
  onOpenChapters: () => void;
}) {
  const { isNarrow, narrationState, sceneEndActive, sceneEndAutoAdvancing, toggleNarration, showPlaybackControls } = runtime;
  const paused = sceneEndActive ? !sceneEndAutoAdvancing : narrationState.isPaused;
  const buttonSize = isNarrow ? 52 : 64;
  const iconSize = isNarrow ? 24 : 28;

  const openMenu = () => {
    if (narrationState.isSpeaking && !narrationState.isPaused) void toggleNarration();
    onMenuOpenChange(true);
  };
  const closeMenu = () => onMenuOpenChange(false);
  // 메뉴에서 고른 일은 메뉴를 닫고 한다. 다음 장면·처음부터는 스스로 재생을 다시 시작한다.
  const run = (action: () => void) => () => {
    onMenuOpenChange(false);
    action();
  };

  const tiles: MenuTile[] = [
    {
      key: 'text',
      iconName: 'text',
      label: `글씨 크기 ${textScaleLabel(textScaleKey)}, 눌러서 바꾸기`,
      tone: 'sky',
      onPress: onCycleTextScale,
    },
    { key: 'next', iconName: 'fast-forward', label: '다음 장면', tone: 'orange', onPress: run(() => void runtime.skipCurrentScene()) },
    { key: 'chapters', iconName: 'skip-next', label: '장면 고르기', tone: 'green', onPress: run(onOpenChapters) },
    { key: 'restart', iconName: 'restart', label: '처음부터 다시', tone: 'pink', onPress: run(runtime.requestRestart) },
    { key: 'home', iconName: 'home', label: '이야기 나가기', tone: 'neutral', onPress: run(() => void runtime.openHomeMenu()) },
  ];

  const edge = isNarrow ? 16 : 50;
  const top = isNarrow ? 16 : 32;
  const showPausedOverlay = paused && !menuOpen && showPlaybackControls;

  return (
    <>
      {(menuOpen || showPausedOverlay) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={menuOpen ? '메뉴 닫기' : '이어 듣기'}
          style={chrome.dim}
          onPress={menuOpen ? closeMenu : () => void toggleNarration()}
        />
      )}
      {showPausedOverlay && (
        <View style={chrome.centerLayer} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이어 듣기"
            onPress={() => void toggleNarration()}
            style={({ pressed }) => [chrome.bigPlay, isNarrow && chrome.bigPlayNarrow, pressed && chrome.pressed]}
          >
            <PlayerIcon name="play-large" size={isNarrow ? 40 : 56} />
          </Pressable>
        </View>
      )}

      <View style={[chrome.topRow, { top, left: edge, right: edge }]} pointerEvents="box-none">
        {menuOpen ? (
          <PlayerIconButton iconName="menu-close" label="메뉴 닫기" onPress={closeMenu} size={buttonSize} iconSize={buttonSize} style={chrome.bare} />
        ) : (
          <PlayerIconButton iconName="menu" label="메뉴 열기" variant="outlined" onPress={openMenu} size={buttonSize} iconSize={iconSize} />
        )}
        <PlayerProgress runtime={runtime} compact={isNarrow} />
        {showPlaybackControls ? (
          paused || menuOpen ? (
            <PlayerIconButton
              iconName="play"
              label="이어 듣기"
              variant="purple"
              onPress={() => {
                closeMenu();
                if (paused) void toggleNarration();
              }}
              size={buttonSize}
              iconSize={iconSize}
            />
          ) : (
            <PlayerIconButton iconName="pause" label="일시정지" onPress={() => void toggleNarration()} size={buttonSize} iconSize={iconSize} />
          )
        ) : (
          <View style={{ width: buttonSize }} />
        )}
      </View>

      {menuOpen && (
        <View style={[chrome.tiles, { left: edge, top: top + buttonSize + (isNarrow ? 20 : 34), gap: isNarrow ? 16 : 34 }]}>
          {tiles.map((tile) => (
            <Pressable
              key={tile.key}
              accessibilityRole="button"
              accessibilityLabel={tile.label}
              onPress={tile.onPress}
              style={({ pressed }) => [
                chrome.tile,
                { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
                TILE_TONE[tile.tone],
                pressed && chrome.pressed,
              ]}
            >
              {tile.iconName === 'home' ? (
                <Icon name="home" size={isNarrow ? 26 : 30} color={playerColor.neutral900} />
              ) : (
                <PlayerIcon name={tile.iconName} size={isNarrow ? 30 : 36} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

/** 낱말 단위로 자른 지금 줄 - 읽은 낱말 · 지금 낱말 · 아직 안 읽은 낱말. */
function splitByProgress(text: string, cueProgress: number) {
  const words = text.split(/(\s+)/).filter((part) => part.length > 0);
  const wordCount = words.filter((part) => !/^\s+$/.test(part)).length;
  if (wordCount === 0) return { read: text, current: '', rest: '' };
  const currentWord = Math.min(wordCount - 1, Math.floor(cueProgress * wordCount));
  let seen = -1;
  let read = '';
  let current = '';
  let rest = '';
  for (const part of words) {
    const isSpace = /^\s+$/.test(part);
    if (!isSpace) seen += 1;
    if (seen < currentWord || (isSpace && seen === currentWord && current === '')) read += part;
    else if (seen === currentWord && !isSpace) current = part;
    else rest += part;
  }
  return { read, current, rest };
}

/** 아래 자막 카드 + 말하는 캐릭터. 장면 끝 쉼과 질문 초대는 ReaderCard가 그대로 맡는다. */
export function PlayerCaption({ runtime, dialogue }: { runtime: OneStoryRuntime; dialogue: UseDialogue }) {
  const textScale = useReaderTextScale();
  const {
    isNarrow,
    isPlaybackDockState,
    currentClip,
    isBranchPlaybackState,
    sceneEndActive,
    captionVisible,
    subtitleWindow,
    replayCurrent,
  } = runtime;

  if (!isPlaybackDockState || !(currentClip || isBranchPlaybackState) || sceneEndActive) return null;

  const { read, current, rest } = splitByProgress(subtitleWindow.text, subtitleWindow.cueProgress);
  const character = dialogue.character;
  const lineStyle = isNarrow ? chrome.captionLineNarrow : chrome.captionLine;
  const nextStyle = isNarrow ? chrome.captionNextNarrow : chrome.captionNext;

  return (
    <View style={[chrome.captionRow, isNarrow && chrome.captionRowNarrow]} pointerEvents="box-none">
      {captionVisible && (
        <View style={[chrome.captionCard, isNarrow && chrome.captionCardNarrow]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isBranchPlaybackState ? '선택한 전개 처음부터 다시 듣기' : '현재 문장 다시 듣기'}
            onPress={() => void replayCurrent()}
            style={({ pressed }) => [chrome.listen, isNarrow && chrome.listenNarrow, pressed && chrome.pressed]}
          >
            <PlayerIcon name="volume" size={isNarrow ? 24 : 28} />
          </Pressable>
          <View style={chrome.captionLines}>
            <Text accessibilityLiveRegion="polite" numberOfLines={2} style={[lineStyle, scaledText(lineStyle, textScale)]}>
              {read}
              {current ? <Text style={chrome.captionCurrent}>{current}</Text> : null}
              {rest ? <Text style={chrome.captionRest}>{rest}</Text> : null}
            </Text>
            {subtitleWindow.next ? (
              <Text numberOfLines={1} style={[nextStyle, scaledText(nextStyle, textScale)]}>
                {subtitleWindow.next}
              </Text>
            ) : null}
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${character.displayName}에게 말하기`}
        onPress={() => void dialogue.openChat()}
        style={({ pressed }) => [
          chrome.character,
          isNarrow && chrome.characterNarrow,
          runtime.sceneEndActive && chrome.characterHighlight,
          pressed && chrome.pressed,
        ]}
      >
        <Image source={{ uri: character.avatarImageUri }} style={chrome.characterImage} resizeMode="cover" />
      </Pressable>
    </View>
  );
}

const chrome = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playerColor.white,
  },
  iconButtonOutlined: { borderWidth: 2, borderColor: playerColor.neutral200 },
  iconButtonPurple: { backgroundColor: playerColor.purple500 },
  bare: { backgroundColor: 'transparent' },
  topRow: {
    position: 'absolute',
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  progressPill: {
    marginTop: 6,
    backgroundColor: playerColor.white,
    borderWidth: 1.5,
    borderColor: playerColor.neutral200,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  progressPillCompact: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 12 },
  track: { height: 12, borderRadius: 6, backgroundColor: playerColor.purpleTrack },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, backgroundColor: playerColor.purple500 },
  knob: {
    position: 'absolute',
    top: -2.5,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: playerColor.yellow,
    borderWidth: 3,
    borderColor: playerColor.white,
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    backgroundColor: 'rgba(39, 34, 45, 0.2)',
  },
  centerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigPlay: {
    width: 144,
    height: 144,
    borderRadius: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playerColor.purple500,
    boxShadow: '0px 12px 16px rgba(48, 33, 105, 0.12)',
  } as never,
  bigPlayNarrow: { width: 104, height: 104, borderRadius: 52 },
  tiles: { position: 'absolute', zIndex: 30 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  captionRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 50,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 72,
  },
  captionRowNarrow: { left: 12, right: 12, bottom: 16, gap: 10 },
  captionCard: {
    flexShrink: 1,
    flexGrow: 1,
    maxWidth: 940,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    backgroundColor: playerColor.white,
    borderWidth: 1.5,
    borderColor: playerColor.neutral200,
    borderRadius: 32,
    paddingHorizontal: 36,
    paddingVertical: 28,
  },
  captionCardNarrow: { gap: 12, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 14 },
  listen: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playerColor.purple50,
  },
  listenNarrow: { width: 48, height: 48, borderRadius: 24 },
  captionLines: { flex: 1, gap: 6 },
  captionLine: { fontSize: 30, lineHeight: 45, fontWeight: '700', letterSpacing: -0.6, color: playerColor.neutral900 },
  captionLineNarrow: { fontSize: 19, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4, color: playerColor.neutral900 },
  captionCurrent: {
    color: playerColor.purple500,
    textDecorationLine: 'underline',
    textDecorationColor: playerColor.purple500,
    textDecorationThickness: 3,
  } as never,
  captionRest: { color: playerColor.neutral400 },
  captionNext: { fontSize: 26, lineHeight: 39, fontWeight: '400', letterSpacing: -0.52, color: playerColor.neutral400 },
  captionNextNarrow: { fontSize: 16, lineHeight: 24, fontWeight: '400', color: playerColor.neutral400 },
  character: {
    width: 146,
    height: 146,
    borderRadius: 73,
    overflow: 'hidden',
    backgroundColor: playerColor.white,
    borderWidth: 3,
    borderColor: playerColor.white,
    boxShadow: '0px 12px 36px rgba(91, 46, 158, 0.1)',
  } as never,
  characterNarrow: { width: 72, height: 72, borderRadius: 36 },
  characterHighlight: { borderColor: playerColor.yellow },
  characterImage: { width: '100%', height: '100%' },
});
