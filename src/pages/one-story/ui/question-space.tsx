import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PlayerIcon, PlayerIconButton, playerColor } from './player-chrome';

/**
 * 「그레텔의 공간」 질문 화면(피그마 인터랙션 플로우_수정본 · 질문 896:635 대기 · 896:650 녹음 중 · 896:677 생각 중).
 * 하늘색 바탕에 그레텔 말풍선, 아이 말풍선, 아래 큰 마이크 버튼. 마이크 상태가 화면 단계를 보여 준다.
 * - idle: 노란 마이크(누르면 말하기)
 * - recording: 분홍 마이크와 퍼지는 고리, 왼쪽 [그만](X), 오른쪽 [다 말했어요](체크)
 * - disabled: 흐린 흰 마이크(그레텔이 생각하는 중)
 * - hidden: 마이크 대신 children(확인·글쓰기·제안 같은 단계 버튼)만 보인다.
 */

const SKY = '#e8f2ff';
const TEXT_PRIMARY = '#2a1f45';
const PINK = '#ff6685';
const GREEN = '#72d6a0';
const VOICE_BARS = [14, 28, 40, 22, 32, 16];

export type QuestionMicState = 'idle' | 'recording' | 'disabled' | 'hidden';

export type QuestionMenuAction = { key: string; label: string; onPress: () => void };

export function QuestionSpace({
  characterName,
  avatarUri,
  bubbleText,
  bubbleDim = false,
  onReplay,
  replayAccent = false,
  childText,
  childPending,
  childListening = false,
  meterPercent = 50,
  thinking = false,
  mic,
  onMicPress,
  onCancel,
  onDone,
  menuActions,
  children,
}: {
  characterName: string;
  avatarUri: string;
  bubbleText: string;
  /** 그레텔이 생각하는 동안 앞 질문 말풍선을 흐리게. */
  bubbleDim?: boolean;
  onReplay?: () => void;
  /** 다시 듣기 버튼을 보라 바탕으로(질문을 막 들려준 대기 화면). */
  replayAccent?: boolean;
  /** 아이 말풍선 - 확정된 말. */
  childText?: string;
  /** 아이 말풍선 - 아직 알아듣는 중인 뒷부분(흐리게). */
  childPending?: string;
  /** 녹음 중이면 말풍선 앞에 소리 막대를 그린다. */
  childListening?: boolean;
  meterPercent?: number;
  thinking?: boolean;
  mic: QuestionMicState;
  onMicPress?: () => void;
  onCancel?: () => void;
  onDone?: () => void;
  menuActions: QuestionMenuAction[];
  children?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 720;
  const [menuOpen, setMenuOpen] = useState(false);
  const edge = narrow ? 16 : 50;
  const top = narrow ? 16 : 32;
  const buttonSize = narrow ? 52 : 64;
  // 피그마 1440 기준 말풍선 줄은 왼쪽 41.67%+18 · 너비 660. 좁은 화면은 양옆 여백만 두고 꽉 채운다.
  const columnWidth = narrow ? width - 32 : Math.min(660, width - 2 * edge - buttonSize - 24);
  const columnLeft = narrow ? 16 : Math.max(edge + buttonSize + 24, Math.min(width * 0.4167 + 18, width - columnWidth - 24));
  const showChild = Boolean(childText || childPending || childListening);
  const micSize = narrow ? 112 : 144;
  const sideSize = narrow ? 60 : 72;

  return (
    <View style={styles.root} accessibilityLabel={`${characterName}와 이야기하기`}>
      <Text style={[styles.watermark, narrow && styles.watermarkNarrow]} numberOfLines={1} aria-hidden>
        {characterName}의 공간
      </Text>
      <View style={styles.scrim} pointerEvents="none" />

      <View style={[styles.column, { left: columnLeft, width: columnWidth, top: narrow ? top + buttonSize + 16 : 136 }]}>
        <View style={[styles.characterBubble, narrow && styles.characterBubbleNarrow, bubbleDim && styles.dim]}>
          <View style={styles.bubbleHeader}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} accessibilityLabel={`${characterName} 얼굴`} />
            <Text style={styles.bubbleName}>{characterName}</Text>
            {onReplay && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${characterName} 말 다시 듣기`}
                onPress={onReplay}
                style={({ pressed }) => [styles.replay, replayAccent && styles.replayAccent, pressed && styles.pressed]}
              >
                <PlayerIcon name={replayAccent ? 'volume-white' : 'volume-purple'} size={28} />
              </Pressable>
            )}
          </View>
          <Text style={[styles.bubbleText, narrow && styles.bubbleTextNarrow]} accessibilityLiveRegion="polite">
            {bubbleText}
          </Text>
        </View>

        {showChild && (
          <View style={[styles.childBubble, narrow && styles.childBubbleNarrow]}>
            {childListening && (
              <View style={styles.voiceWave} aria-hidden>
                {VOICE_BARS.map((height, index) => (
                  <View
                    key={index}
                    style={[styles.voiceBar, { height: Math.max(6, height * (0.45 + (meterPercent / 100) * 0.75)) }]}
                  />
                ))}
              </View>
            )}
            <Text style={[styles.childText, narrow && styles.childTextNarrow]} accessibilityLiveRegion="polite">
              {childText}
              {childPending ? <Text style={styles.childPending}>{childText ? ` ${childPending}` : childPending}</Text> : null}
            </Text>
          </View>
        )}

        {thinking && (
          <View style={styles.thinkingBubble} accessibilityLabel={`${characterName}가 생각하는 중`}>
            <View style={styles.bubbleHeader}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              <Text style={styles.bubbleName}>{characterName}</Text>
            </View>
            <PlayerIcon name="thinking-dots" size={84} style={styles.thinkingDots} />
          </View>
        )}

        {children ? <View style={styles.extras}>{children}</View> : null}
      </View>

      {mic !== 'hidden' && (
        <View
          style={[styles.micArea, { left: columnLeft, width: columnWidth, bottom: narrow ? 32 : 75, height: micSize }]}
          pointerEvents="box-none"
        >
          {mic === 'recording' && (
            <>
              <View style={[styles.ring, ringSize(micSize * (248 / 144)), { backgroundColor: 'rgba(255, 102, 133, 0.12)' }]} />
              <View style={[styles.ring, ringSize(micSize * (196 / 144)), { backgroundColor: 'rgba(255, 102, 133, 0.18)' }]} />
            </>
          )}
          {mic === 'idle' && (
            <View style={[styles.ring, ringSize(micSize * (192 / 144)), { backgroundColor: 'rgba(255, 212, 71, 0.25)' }]} />
          )}
          {mic === 'recording' && onCancel && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="그만할래"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.sideButton,
                { width: sideSize, height: sideSize, borderRadius: sideSize / 2, marginRight: narrow ? 20 : 40 },
                pressed && styles.pressed,
              ]}
            >
              <PlayerIcon name="close" size={32} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mic === 'recording' ? '듣고 있어요' : mic === 'disabled' ? `${characterName}가 생각하는 중` : '말하기'}
            accessibilityState={{ disabled: mic === 'disabled' }}
            disabled={mic === 'disabled' || !onMicPress}
            onPress={onMicPress}
            style={({ pressed }) => [
              styles.mic,
              { width: micSize, height: micSize, borderRadius: micSize / 2 },
              mic === 'recording' && styles.micRecording,
              mic === 'disabled' && styles.micDisabled,
              pressed && styles.pressed,
            ]}
          >
            <PlayerIcon name={mic === 'disabled' ? 'mic-disabled' : 'mic'} size={narrow ? 50 : 64} />
          </Pressable>
          {mic === 'recording' && onDone && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다 말했어요"
              onPress={onDone}
              style={({ pressed }) => [
                styles.sideButton,
                styles.sideDone,
                { width: sideSize, height: sideSize, borderRadius: sideSize / 2, marginLeft: narrow ? 20 : 40 },
                pressed && styles.pressed,
              ]}
            >
              <PlayerIcon name="check" size={32} />
            </Pressable>
          )}
        </View>
      )}

      <PlayerIconButton
        iconName={menuOpen ? 'menu-close' : 'menu'}
        label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
        variant={menuOpen ? 'white' : 'outlined'}
        onPress={() => setMenuOpen((open) => !open)}
        size={buttonSize}
        iconSize={menuOpen ? buttonSize : narrow ? 24 : 28}
        style={[styles.menuButton, { top, left: edge }, menuOpen && styles.bare]}
      />
      {menuOpen && (
        <View style={[styles.menu, { top: top + buttonSize + 12, left: edge }]}>
          {menuActions.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              onPress={() => {
                setMenuOpen(false);
                action.onPress();
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.menuItemText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const ringSize = (size: number) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  marginLeft: -size / 2,
  marginTop: -size / 2,
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    backgroundColor: SKY,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -70,
    textAlign: 'center',
    fontSize: 100,
    lineHeight: 140,
    fontWeight: '700',
    color: playerColor.white,
  },
  watermarkNarrow: { fontSize: 48, lineHeight: 68, marginTop: -34 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(42, 31, 69, 0.1)' },
  column: { position: 'absolute', gap: 18 },
  characterBubble: {
    alignSelf: 'stretch',
    gap: 16,
    backgroundColor: playerColor.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 8,
    paddingTop: 28,
    paddingHorizontal: 36,
    paddingBottom: 32,
    boxShadow: '0px 12px 36px rgba(91, 46, 158, 0.1)',
  } as never,
  characterBubbleNarrow: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, gap: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomRightRadius: 28 },
  dim: { opacity: 0.6 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff5d6' },
  bubbleName: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '700', color: playerColor.purple500 },
  replay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playerColor.purple50,
  },
  replayAccent: { backgroundColor: playerColor.purple500 },
  bubbleText: { fontSize: 28, lineHeight: 49, fontWeight: '700', color: TEXT_PRIMARY },
  bubbleTextNarrow: { fontSize: 20, lineHeight: 32 },
  childBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: playerColor.purple500,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  childBubbleNarrow: { paddingHorizontal: 20, paddingVertical: 16, gap: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28 },
  voiceWave: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40 },
  voiceBar: { width: 6, borderRadius: 3, backgroundColor: playerColor.yellow },
  childText: { flexShrink: 1, fontSize: 25, lineHeight: 35, fontWeight: '700', color: playerColor.white },
  childTextNarrow: { fontSize: 19, lineHeight: 27 },
  childPending: { color: 'rgba(255, 255, 255, 0.55)' },
  thinkingBubble: {
    alignSelf: 'flex-start',
    width: 220,
    gap: 16,
    backgroundColor: playerColor.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 8,
    paddingTop: 28,
    paddingHorizontal: 36,
    paddingBottom: 32,
    boxShadow: '0px 12px 36px rgba(91, 46, 158, 0.1)',
  } as never,
  thinkingDots: { height: 36 },
  extras: { gap: 12 },
  micArea: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', left: '50%', top: '50%' },
  mic: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playerColor.yellow,
    boxShadow: '0px 12px 18px rgba(42, 31, 69, 0.18)',
  } as never,
  micRecording: { backgroundColor: PINK },
  micDisabled: { backgroundColor: playerColor.white, opacity: 0.45 },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playerColor.white,
    boxShadow: '0px 6px 9px rgba(42, 31, 69, 0.18)',
  } as never,
  sideDone: { backgroundColor: GREEN },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  menuButton: { position: 'absolute', zIndex: 2 },
  bare: { backgroundColor: 'transparent' },
  menu: {
    position: 'absolute',
    zIndex: 2,
    minWidth: 200,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: playerColor.white,
    borderWidth: 1.5,
    borderColor: playerColor.neutral200,
    boxShadow: '0px 12px 36px rgba(91, 46, 158, 0.1)',
  } as never,
  menuItem: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 22 },
  menuItemPressed: { backgroundColor: playerColor.purple50 },
  menuItemText: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
});
