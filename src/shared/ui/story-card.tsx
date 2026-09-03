import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { Icon } from './icon';
import { Pill } from './pill';
import { storybookTheme } from './theme';

export type StoryCardProps = {
  title: string;
  coverImageUrl?: string | null;
  description?: string | null;
  category?: string | null;
  onPress: () => void;
  /**
   * 잠긴 책 - 표지는 보여 주되(어떤 이야기가 있는지는 알려 준다) 흐리게 처리하고 자물쇠와 안내
   * 문구를 얹는다. onPress는 여전히 눌리지만(카드를 비활성화하지 않는다) 어디로 보낼지는
   * 호출자가 결정한다 - 이 컴포넌트는 auth/router를 몰라야 하는 순수 프레젠테이션 컴포넌트다.
   */
  locked?: boolean;
  /** 잠긴 카드 아래 보여줄 안내 문구 - 비로그인/로그인·미결제 상황마다 다른 문구를 쓸 수 있게 호출자가 넘긴다. */
  lockedCaption?: string;
  /**
   * 'default' - 기존 그리드용 전체 폭 카드(설명·카테고리 pill 포함).
   * 'mini' - 홈 화면의 가로 스크롤 스트립용 축소 카드(고정 폭·설명 생략).
   * 홈에서 여러 섹션을 좁은 화면에 가로로 나열해야 하는 IA 요구가 새로 생겨서
   * 아예 별도 컴포넌트를 만드는 대신 여기 variant로 얹었다 - 표지·제목·잠금 처리 등
   * 기능이 완전히 같아 코드 중복이 크다.
   */
  size?: 'default' | 'mini';
  /**
   * "이어서 읽기" 섹션에서 진행률을 표지 하단에 얹는다. 0~1 범위. undefined면 표시하지 않음.
   * 진행률 계산은 호출자 책임 - 표시만 담당한다.
   */
  progress?: number;
  /**
   * 표지 우상단에 얹히는 작은 × 오버레이 버튼. "저장한 작품" 탭이 카드 자체 클릭(상세 열기)과
   * 별개로 즉시 저장 해제할 수 있게 한다. 이 Pressable은 카드 onPress가 함께 발동되지 않도록
   * stopPropagation으로 이벤트를 잡는다.
   */
  onRemove?: () => void;
  /** onRemove 버튼의 accessibilityLabel - "저장 해제" 같은 상황별 라벨을 호출자가 정한다. */
  removeLabel?: string;
};

/** 홈 서재의 그리드 아이템 - 어두운 배경 위에 떠 있는 크림색 카드로, 리더 자체의 reader-card 모티프와 맞춘다. */
export function StoryCard({
  title,
  coverImageUrl,
  description,
  category,
  onPress,
  locked = false,
  lockedCaption,
  size = 'default',
  progress,
  onRemove,
  removeLabel,
}: StoryCardProps) {
  const isMini = size === 'mini';
  const accessibilityLabel = locked ? `잠김, ${title}` : category ? `${category}, ${title}` : title;
  const handleRemove = (event: GestureResponderEvent) => {
    // 부모 Pressable의 onPress(상세 열기)가 함께 발동되지 않도록 이벤트 전파를 여기서 잡는다.
    // React Native Web은 DOM 이벤트를 GestureResponderEvent에 래핑하므로 표준 stopPropagation이 동작.
    event.stopPropagation();
    onRemove?.();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, isMini && styles.cardMini, pressed && styles.cardPressed]}
    >
      <View style={[styles.coverFrame, locked && styles.coverFrameLocked]}>
        {coverImageUrl ? (
          <Image
            source={{ uri: coverImageUrl }}
            resizeMode="cover"
            style={styles.cover}
            accessibilityLabel={`${title} 표지 그림`}
          />
        ) : (
          <View style={styles.coverFallback}>
            <Icon name="book" size={isMini ? 20 : 28} color={storybookTheme.color.onDarkMuted} />
          </View>
        )}
        {locked ? (
          <View style={styles.lockBadge}>
            <Icon name="lock" size={isMini ? 12 : 16} color={storybookTheme.color.onDark} />
          </View>
        ) : null}
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={removeLabel ?? '삭제'}
            onPress={handleRemove}
            hitSlop={6}
            style={({ pressed }) => [styles.removeBadge, pressed && styles.removeBadgePressed]}
          >
            <Icon name="close" size={12} color={storybookTheme.color.onDark} />
          </Pressable>
        ) : null}
        {typeof progress === 'number' ? (
          <View style={styles.progressTrack} accessibilityLabel={`진행률 ${Math.round(progress * 100)}퍼센트`}>
            <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(1, progress) * 100)}%` }]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.body, isMini && styles.bodyMini, locked && styles.bodyLocked]}>
        <View style={styles.textBlock}>
          {!isMini && category ? <Pill label={category} /> : null}
          <View style={styles.textGroup}>
            <Text
              style={[styles.title, isMini && styles.titleMini]}
              accessibilityRole="header"
              numberOfLines={isMini ? 2 : 1}
            >
              {title}
            </Text>
            {!isMini && description ? (
              <Text style={styles.description} numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>
        {locked && lockedCaption ? (
          <Text style={[styles.lockedCaption, isMini && styles.lockedCaptionMini]} numberOfLines={1}>
            {lockedCaption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    overflow: 'hidden',
    transform: [{ scale: 1 }],
    ...storybookTheme.elevation.low,
  },
  /**
   * 홈 가로 스트립에서 한 화면에 두 장 반 정도가 보이도록 폭을 고정한다 - 부모 컴포넌트의
   * ScrollView가 이 width를 신뢰하고 페이지 이동을 계산한다. 좁은 화면에서도 최소 156px는
   * 확보돼야 표지 + 제목 두 줄이 답답하지 않다.
   */
  cardMini: {
    width: 160,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  coverFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: storybookTheme.color.coverFallback,
  },
  coverFrameLocked: {
    opacity: 0.55,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: storybookTheme.color.coverFallback,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 10, 30, 0.6)',
  },
  // × 오버레이 - lockBadge와 같은 우상단 자리를 공유하지만, locked/onRemove가 동시에 발생하지
  // 않는 실사용 조건(잠긴 이야기는 저장할 수 없거나, 있어도 삭제 유효)에서 크게 문제되지 않는다.
  // 필요해지면 위치를 좌상단이나 top+가로 오프셋으로 나눈다.
  removeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 10, 30, 0.7)',
  },
  removeBadgePressed: { opacity: 0.7 },
  /**
   * Figma "Simple Design System"의 Card 컴포넌트는 Body2(텍스트 그룹+버튼 그룹) 사이는
   * space-400(16), Text 그룹 안(제목-설명)은 space-200(8)로 구분한다 - 지금까지는 pill/제목/
   * 설명/잠금 안내를 전부 gap:6 하나로 뭉뚱그려서, 이 카드가 실제로 "eyebrow + 제목·설명 묶음"
   * 두 단계라는 게 spacing만으로는 드러나지 않았다.
   */
  body: {
    padding: 16,
    gap: storybookTheme.spacing.md,
  },
  bodyMini: {
    padding: 10,
    gap: 4,
  },
  bodyLocked: {
    opacity: 0.72,
  },
  /** eyebrow(Pill)는 제목에 붙어 보이도록 가깝게 - Figma엔 없는 조합이라 이 앱의 다른
   * eyebrow+제목 카드(roleCard 등)가 쓰는 간격을 따른다. */
  textBlock: {
    gap: storybookTheme.spacing.xs,
  },
  /** Figma Card의 Text 그룹 간격(space-200=8)과 동일. */
  textGroup: {
    gap: storybookTheme.spacing.sm,
  },
  title: {
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  titleMini: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.bold,
  },
  description: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
    color: storybookTheme.color.onCardBody,
  },
  lockedCaption: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.primary,
  },
  lockedCaptionMini: {
    fontSize: storybookTheme.type.xxs,
  },
  /**
   * 표지 아래쪽에 얹히는 진행률 바 - "이어서 읽기" 섹션 전용. 표지 위에 반투명 검정 트랙을
   * 깔고 그 위에 gold 강조색으로 채운다. locked/coverFrameLocked opacity(0.55)와 무관하게
   * 진행 바는 항상 뚜렷하게 보이도록 트랙 자체는 프레임 바깥 레이어에 위치한다.
   */
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(18, 10, 30, 0.55)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: storybookTheme.color.gold,
  },
});
