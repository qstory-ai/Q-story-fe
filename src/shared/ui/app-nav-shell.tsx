import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Icon, type IconName } from './icon';
import { SafeAreaView } from './safe-area-view';
import { storybookTheme } from './theme';

export type AppNavShellItem = {
  key: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
};

type AppNavShellProps = {
  items: readonly AppNavShellItem[];
  /** 좁은 화면 상단바의 왼쪽 뒤로가기 버튼 - 생략하면 숨긴다(예: 대시보드 자체처럼 되돌아갈 곳이 없는 화면). */
  onBack?: () => void;
  children: ReactNode;
};

// StoryLibraryGrid의 3열 전환 기준(860)과 맞춘다 - 이 폭부터 "웹처럼" 고정 사이드바를 쓴다.
const WIDE_BREAKPOINT = 860;
// bottomBarItem의 minHeight(56)과 맞춘다 - narrowMain의 paddingBottom 계산에 재사용해서
// 고정된 하단바에 콘텐츠 마지막 줄이 가려지지 않게 한다.
const BOTTOM_BAR_HEIGHT = 56;

/**
 * 로그인 후 대시보드형 화면(홈/보고서/마이페이지)들이 공유하는 페이지 이동 셸.
 * 넓은 화면(웹)에서는 오른쪽에 고정된 사이드바로, 좁은 화면(앱 크기)에서는 상단바
 * (좌: 뒤로가기, 우: 홈)와 하단 탭바로 같은 세 목적지를 보여준다 - 예전엔 각 페이지가
 * 제각각 "← 마이페이지로" 같은 단발성 뒤로가기 링크 하나만 갖고 있어서, 마이페이지가
 * 만들어져 있어도 거기로 가는 링크가 없는 화면이 있었다(ParentHomePage/ClassDashboardPage).
 */
export function AppNavShell({ items, onBack, children }: AppNavShellProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const homeItem = items.find((item) => item.key === 'home') ?? items[0];

  if (isWide) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.root}>
        <View style={styles.wideRow}>
          {/* Lighthouse의 "main landmark 없음" 접근성 경고 - RN엔 <main> 태그도, accessibilityRole
              'main'도 없어서(RN AccessibilityRole enum엔 landmark 개념 자체가 없다) raw aria role을
              얹는다. 이 셸을 쓰는 모든 대시보드 페이지(홈/서재/리포트/마이페이지 등)가 한 번에 해당된다. */}
          <View style={styles.wideMain} {...({ role: 'main' } as any)}>{children}</View>
          <View style={styles.sidebar}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: item.active }}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.sidebarItem,
                  item.active && styles.sidebarItemActive,
                  pressed && styles.sidebarItemPressed,
                ]}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  color={item.active ? storybookTheme.color.gold : storybookTheme.color.onDarkMuted}
                />
                <Text style={[styles.sidebarLabel, item.active && styles.sidebarLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    // bottom은 여기서 빼고 고정된 하단바 쪽(bottomBarFixed) 자신이 안전영역을 책임진다 -
    // 하단바가 position:fixed로 플로우 밖으로 빠지면 이 SafeAreaView의 padding-bottom은
    // (더 이상 하단바 뒤가 아니라) narrowMain 뒤에 그대로 남아 스크롤 콘텐츠에 어색한 여백만
    // 남긴다.
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.root}>
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable accessibilityRole="link" accessibilityLabel="뒤로가기" hitSlop={8} onPress={onBack} style={styles.topBarButton}>
            <Icon name="back" size={18} color={storybookTheme.color.onContent} />
          </Pressable>
        ) : (
          <View style={styles.topBarButton} />
        )}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="홈으로"
          hitSlop={8}
          onPress={homeItem?.onPress}
          style={styles.topBarButton}
        >
          <Icon name="home" size={18} color={storybookTheme.color.onContent} />
        </Pressable>
      </View>
      <View style={styles.narrowMain} {...({ role: 'main' } as any)}>{children}</View>
      {/* 예전엔 이 하단바가 그냥 마지막 flex 자식이라, 콘텐츠가 길면 스크롤할 때 화면 밖으로
          같이 밀려 올라갔다(뷰포트에 고정된 게 아니라 문서 흐름의 일부였다) - position:fixed로
          뷰포트 바닥에 붙여 스크롤과 무관하게 항상 보이게 한다. narrowMain의 paddingBottom이
          이 높이만큼 콘텐츠를 밀어줘서 마지막 줄이 하단바에 가려지지 않는다. */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBarFixed}>
        <View style={styles.bottomBar}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: item.active }}
              onPress={item.onPress}
              style={styles.bottomBarItem}
            >
              <Icon
                name={item.icon}
                size={20}
                color={item.active ? storybookTheme.color.primary : storybookTheme.color.onContentMuted}
              />
              <Text style={[styles.bottomBarLabel, item.active && styles.bottomBarLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 라이트 리테마: root=라이트 배경, 사이드바(우측)는 여전히 다크. 상/하단 nav는 라이트 배경 + 다크 텍스트.
  root: { flex: 1, backgroundColor: storybookTheme.color.background },
  wideRow: { flex: 1, flexDirection: 'row' },
  wideMain: { flex: 1, backgroundColor: storybookTheme.color.background },
  sidebar: {
    width: 220,
    backgroundColor: storybookTheme.color.sidebarBackground,
    borderLeftWidth: 1,
    borderLeftColor: storybookTheme.color.sidebarBorder,
    paddingVertical: 24,
    paddingHorizontal: 12,
    gap: 4,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  sidebarItemActive: { backgroundColor: storybookTheme.color.sidebarActive },
  sidebarItemPressed: { opacity: 0.85 },
  sidebarLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onDarkMuted,
  },
  sidebarLabelActive: { color: storybookTheme.color.onDark },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: storybookTheme.color.contentSurface,
    borderBottomWidth: 1,
    borderBottomColor: storybookTheme.color.contentPanelBorder,
  },
  topBarButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  narrowMain: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
    // 고정된 하단바(BOTTOM_BAR_HEIGHT + 안전영역)만큼 미리 띄워서, 콘텐츠 마지막 줄이 그
    // 뒤에 가려지지 않게 한다.
    paddingBottom: `calc(${BOTTOM_BAR_HEIGHT}px + env(safe-area-inset-bottom))` as unknown as number,
  },
  bottomBarFixed: {
    position: 'fixed' as 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: storybookTheme.zIndex.sticky,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentSurface,
  },
  bottomBar: {
    flexDirection: 'row',
  },
  bottomBarItem: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  bottomBarLabel: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onContentMuted,
  },
  bottomBarLabelActive: { color: storybookTheme.color.primary },
});
