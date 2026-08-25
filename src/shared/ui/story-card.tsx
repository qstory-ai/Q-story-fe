import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
}: StoryCardProps) {
  const accessibilityLabel = locked ? `잠김, ${title}` : category ? `${category}, ${title}` : title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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
            <Icon name="book" size={28} color={storybookTheme.color.onDarkMuted} />
          </View>
        )}
        {locked ? (
          <View style={styles.lockBadge}>
            <Icon name="lock" size={16} color={storybookTheme.color.onDark} />
          </View>
        ) : null}
      </View>
      <View style={[styles.body, locked && styles.bodyLocked]}>
        {category ? <Pill label={category} /> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {locked && lockedCaption ? <Text style={styles.lockedCaption}>{lockedCaption}</Text> : null}
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
  body: {
    padding: 16,
    gap: 6,
  },
  bodyLocked: {
    opacity: 0.72,
  },
  title: {
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
    color: storybookTheme.color.onCardTitle,
  },
  description: {
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
    color: storybookTheme.color.onCardBody,
  },
  lockedCaption: {
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
    color: storybookTheme.color.primary,
  },
});
