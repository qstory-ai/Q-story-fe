import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { Icon, storybookTheme } from '@/shared/ui';

type HomeSectionProps = {
  title: string;
  subtitle?: string;
  /** 우측 상단의 "더 보기" 버튼 - 없으면 렌더링하지 않는다. */
  onSeeAll?: () => void;
  /** strip(기본): 가로 카드 스트립, list: 세로로 쌓는 행 목록(최근 리포트 등). */
  layout?: 'strip' | 'list';
  children: ReactNode;
};

/** 보호자 홈 섹션 하나(제목 + 가로 카드 스트립 또는 세로 목록)의 공통 껍데기. 자식은 호출부가 결정한다. */
export function HomeSection({ title, subtitle, onSeeAll, layout = 'strip', children }: HomeSectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onSeeAll ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${title} 더 보기`}
            onPress={onSeeAll}
            style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}
          >
            <Text style={styles.seeAllLabel}>더 보기</Text>
            <Icon name="chevronRight" size={14} color={storybookTheme.color.gold} />
          </Pressable>
        ) : null}
      </View>
      {layout === 'list' ? (
        <View style={styles.listContent}>{children}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  headerText: { flex: 1, gap: 2 },
  listContent: { gap: 8 },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
  },
  subtitle: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.xs,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  seeAllPressed: { opacity: 0.7 },
  seeAllLabel: {
    color: storybookTheme.color.goldText,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  stripContent: {
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
