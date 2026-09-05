import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { Icon, storybookTheme } from '@/shared/ui';

type HomeSectionProps = {
  title: string;
  subtitle?: string;
  /** 우측 상단의 "더 보기" 버튼 - 서재 탭으로 이동시키는 데 쓴다. onPress가 없으면 렌더링하지 않는다. */
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** 자식 배치 방향 - horizontal(default)은 스토리 스트립처럼 가로 ScrollView로, vertical은
   *  최근 활동 리스트처럼 세로 스택으로 쌓는다. horizontal일 때만 스크롤 컨테이너가 붙는다. */
  direction?: 'horizontal' | 'vertical';
  children: ReactNode;
};

/**
 * IA에서 정의한 홈 섹션 하나(제목 + 카드 스트립/리스트)의 공통 껍데기.
 * "메인 추천 히어로"는 이 컴포넌트 없이 자체 레이아웃을 쓰고, 그 밖의 섹션
 * (이어서 읽기 / 아이에게 추천 / 새로운 작품 / 최근 활동)이 모두 이걸 재사용한다.
 *
 * 자식 자체는 이 컴포넌트가 관여하지 않는다 - 안에 무엇을 넣을지는 호출부가 결정하고,
 * 이 컴포넌트는 direction에 따라 그 결과를 가로 ScrollView(horizontal, default) 혹은
 * 세로 스택(vertical)으로 감싼다. StoryCard 외의 다른 카드(예: 최근 활동의 리포트 카드)도
 * 같은 헤더/여백을 쓸 수 있다.
 */
export function HomeSection({
  title,
  subtitle,
  onSeeAll,
  seeAllLabel = '더 보기',
  direction = 'horizontal',
  children,
}: HomeSectionProps) {
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
            accessibilityLabel={`${title} ${seeAllLabel}`}
            onPress={onSeeAll}
            style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}
          >
            <Text style={styles.seeAllLabel}>{seeAllLabel}</Text>
            <Icon name="chevronRight" size={14} color={storybookTheme.color.gold} />
          </Pressable>
        ) : null}
      </View>
      {direction === 'horizontal' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.verticalStack}>{children}</View>
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
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  stripContent: {
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  verticalStack: {
    gap: 8,
    paddingHorizontal: 4,
  },
});
