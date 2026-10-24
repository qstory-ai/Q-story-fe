import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Card, enterFadeUp, Icon, radius, semanticColors, shadow, space, storybookTheme, type IconName } from '@/shared/ui';

/**
 * 홈 화면 공통 조각 - 보호자 홈(/parent)의 생김새를 선생님 홈(/tutor)·관리자 홈(/organization)도 같이 쓴다.
 * 인사 카드, 큰 대표 카드, 흰 행 하나씩. 데이터는 호출부가 정하고 여기는 모양만 맡는다.
 */

export function timeOfDayGreeting(now: Date = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '좋은 오후예요';
  return '좋은 저녁이에요';
}

/** 옅은 보라 인사 카드(radius 24). 넓은 화면에서는 섹션과 같은 폭까지 늘어난다. */
export function HomeGreetingCard({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  const { width } = useWindowDimensions();
  return (
    <Card variant="tinted" padding="lg" style={[styles.greetingCard, width >= 640 && styles.greetingCardWide]}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {children}
    </Card>
  );
}

/** 16:9 그림 + 제목·설명·이동 문구가 있는 큰 카드. 그림이 없으면 아이콘 자리표시. */
export function HomeHeroCard({
  title,
  description,
  meta,
  ctaLabel,
  coverImageUrl,
  fallbackIcon = 'book',
  badge,
  onPress,
}: {
  title: string;
  description?: string | null;
  meta?: ReactNode;
  ctaLabel: string;
  coverImageUrl?: string | null;
  fallbackIcon?: IconName;
  badge?: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${ctaLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
    >
      <View style={styles.heroCoverFrame}>
        {coverImageUrl ? (
          <Image source={{ uri: coverImageUrl }} resizeMode="cover" style={styles.heroCover} />
        ) : (
          <View style={styles.heroCoverFallback}>
            <Icon name={fallbackIcon} size={36} color={storybookTheme.color.onContentMuted} />
          </View>
        )}
        {badge ? <View style={styles.heroBadge}>{badge}</View> : null}
      </View>
      <View style={styles.heroBody}>
        <Text style={styles.heroTitle} accessibilityRole="header" numberOfLines={2}>{title}</Text>
        {description ? <Text style={styles.heroDescription} numberOfLines={3}>{description}</Text> : null}
        {meta}
        <View style={styles.heroCta}>
          <Text style={styles.heroCtaLabel}>{ctaLabel}</Text>
          <Icon name="chevronRight" size={16} color={storybookTheme.color.gold} />
        </View>
      </View>
    </Pressable>
  );
}

/** 아이보리 바탕 위 흰 행 - 동그란 아이콘 + 제목·보조 문구 + (선택) 오른쪽 배지 + 화살표. onPress가 없으면 화살표도 없다. */
export function HomeListRow({
  icon,
  label,
  meta,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  meta?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={16} color={storybookTheme.color.gold} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        {meta ? <Text style={styles.rowMeta} numberOfLines={2}>{meta}</Text> : null}
      </View>
      {trailing}
      {onPress ? <Icon name="chevronRight" size={16} color={storybookTheme.color.onContentMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const L = semanticColors.light;

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  greetingCard: {
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.xs,
    borderRadius: radius[24],
    ...enterFadeUp,
  },
  greetingCardWide: {
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
  },
  title: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
    marginTop: 2,
  },
  hero: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    borderRadius: radius[24],
    backgroundColor: L.bg.primary,
    borderWidth: 1,
    borderColor: L.border.secondary,
    overflow: 'hidden',
    ...shadow(2),
    ...enterFadeUp,
  },
  heroCoverFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: storybookTheme.color.coverFallback,
  },
  heroCover: { width: '100%', height: '100%' },
  heroCoverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroBadge: { position: 'absolute', top: 12, right: 12 },
  heroBody: { padding: space[24], gap: 6 },
  heroTitle: {
    fontSize: storybookTheme.type.xl,
    lineHeight: storybookTheme.type.xl * storybookTheme.lineHeight.tight,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  heroDescription: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  heroCta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroCtaLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: L.bg.primary,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: L.border.secondary,
    ...shadow(1),
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.bg.brandSubtle,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  rowMeta: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
});
