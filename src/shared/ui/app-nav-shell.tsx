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
          <View style={styles.wideMain}>{children}</View>
          <View style={styles.sidebar}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="link"
                accessibilityLabel={item.label}
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
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.root}>
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable accessibilityRole="link" accessibilityLabel="뒤로가기" hitSlop={8} onPress={onBack} style={styles.topBarButton}>
            <Icon name="back" size={18} color={storybookTheme.color.onDark} />
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
          <Icon name="home" size={18} color={storybookTheme.color.onDark} />
        </Pressable>
      </View>
      <View style={styles.narrowMain}>{children}</View>
      <View style={styles.bottomBar}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={styles.bottomBarItem}
          >
            <Icon
              name={item.icon}
              size={20}
              color={item.active ? storybookTheme.color.gold : storybookTheme.color.onDarkMuted}
            />
            <Text style={[styles.bottomBarLabel, item.active && styles.bottomBarLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: storybookTheme.color.background },
  wideRow: { flex: 1, flexDirection: 'row' },
  wideMain: { flex: 1 },
  sidebar: {
    width: 220,
    borderLeftWidth: 1,
    borderLeftColor: storybookTheme.color.panelOnDarkBorder,
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
  sidebarItemActive: { backgroundColor: storybookTheme.color.panelOnDarkBackground },
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
    borderBottomWidth: 1,
    borderBottomColor: storybookTheme.color.panelOnDarkBorder,
  },
  topBarButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  narrowMain: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.panelOnDarkBorder,
    backgroundColor: storybookTheme.color.background,
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
    color: storybookTheme.color.onDarkMuted,
  },
  bottomBarLabelActive: { color: storybookTheme.color.gold },
});
