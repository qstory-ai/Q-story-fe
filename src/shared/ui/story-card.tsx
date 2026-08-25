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
};

/** 홈 서재의 그리드 아이템 - 어두운 배경 위에 떠 있는 크림색 카드로, 리더 자체의 reader-card 모티프와 맞춘다. */
export function StoryCard({ title, coverImageUrl, description, category, onPress }: StoryCardProps) {
  const accessibilityLabel = category ? `${category}, ${title}` : title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.coverFrame}>
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
      </View>
      <View style={styles.body}>
        {category ? <Pill label={category} /> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
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
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  coverFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: storybookTheme.color.coverFallback,
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
  body: {
    padding: 16,
    gap: 6,
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
});
