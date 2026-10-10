import type { ReactNode } from 'react';
import { useState } from 'react';
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
  /**
   * 뒤로가기 - 좁은 화면은 상단바 왼쪽, 넓은 화면은 본문 왼쪽 위에 둔다. 생략하면 숨긴다(예: 대시보드 자체처럼
   * 되돌아갈 곳이 없는 화면).
   */
  onBack?: () => void;
  children: ReactNode;
};

// StoryLibraryGrid의 3열 전환 기준(860)과 맞춘다 - 이 폭부터 "웹처럼" 고정 사이드바를 쓴다.
const WIDE_BREAKPOINT = 860;
// bottomBarItem의 minHeight이자 narrowMain의 paddingBottom 계산 기준 - 고정된 하단바에
// 콘텐츠 마지막 줄이 가려지지 않게 한다.
const BOTTOM_BAR_HEIGHT = 56;
// sidebar의 width와 맞춘다 - wideMain의 paddingRight/토글 버튼 위치 계산에 재사용한다.
const SIDEBAR_WIDTH = 220;
const SLIDE_DURATION = '220ms';
const SLIDE_EASING = 'ease';

/**
 * react-native-web 전용 CSS transition - RN 자체 ViewStyle 타입엔 없는 웹 전용 프로퍼티라
 * 한 곳에서만 캐스팅해서 재사용한다(사이드바 슬라이드/토글 위치/메인 영역 여백 셋 다 같은
 * 지속시간으로 맞춰야 "같이 움직이는" 느낌이 나서 헬퍼로 뺐다).
 */
function transition(property: string) {
  return {
    transitionProperty: property,
    transitionDuration: SLIDE_DURATION,
    transitionTimingFunction: SLIDE_EASING,
  } as unknown as Record<string, never>;
}

/**
 * 로그인 후 대시보드형 화면(홈/보고서/마이페이지)들이 공유하는 페이지 이동 셸.
 * 넓은 화면(웹)에서는 오른쪽에 고정된 사이드바로, 좁은 화면(앱 크기)에서는 상단바
 * (좌: 뒤로가기, 우: 홈)와 하단 탭바로 같은 목적지들을 보여준다.
 */
export function AppNavShell({ items, onBack, children }: AppNavShellProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const homeItem = items.find((item) => item.key === 'home') ?? items[0];
  // 기본은 열림 - 햄버거로 접을 수만 있게 한다.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isWide) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.root}>
        <View style={styles.wideRow}>
          {/* main landmark - RN AccessibilityRole엔 landmark 개념이 없어 raw aria role을 얹는다. */}
          <View
            style={[styles.wideMain, !sidebarOpen && styles.wideMainCollapsed]}
            {...({ role: 'main' } as any)}
          >
            {/* 넓은 화면엔 상단바가 없어 하위 화면(마이페이지 > 수업 연결 등)에서 돌아갈 길이 사이드바뿐이었다. */}
            {onBack ? (
              <View style={styles.wideBackRow}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="뒤로가기"
                  hitSlop={8}
                  onPress={onBack}
                  style={({ pressed }) => [styles.wideBackButton, pressed && styles.sidebarItemPressed]}
                >
                  <Icon name="back" size={16} color={storybookTheme.color.onContent} />
                  <Text style={styles.wideBackLabel}>뒤로</Text>
                </Pressable>
              </View>
            ) : null}
            {children}
          </View>
          {/* 사이드바 폭만큼 항상 고정된 자리에서 열고 닫는다 - sidebar 자체가 옆으로
              밀려나거나(reflow) main 위로 겹쳐 덮는(overlay) 대신, 토글 버튼은 사이드바가
              열려있든 닫혀있든 그 왼쪽 가장자리에 그대로 붙어 있다. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
            onPress={() => setSidebarOpen((open) => !open)}
            style={[styles.sidebarToggle, { right: sidebarOpen ? SIDEBAR_WIDTH + 12 : 12 }]}
            {...({ 'aria-expanded': sidebarOpen, 'aria-controls': 'app-nav-sidebar' } as any)}
          >
            {/* 'close'(X)는 화면을 닫는 것처럼 읽혀서 - 접힘 방향을 가리키는 chevron으로. */}
            <Icon name={sidebarOpen ? 'chevronRight' : 'menu'} size={18} color={storybookTheme.color.onContent} />
          </Pressable>
          {/* position:fixed로 뷰포트 우측에 고정해 스크롤과 무관하게 보이게 하고, 열고 닫는 건
              translateX 트랜지션으로만 표현한다. */}
          <View
            style={[styles.sidebar, !sidebarOpen && styles.sidebarClosed]}
            nativeID="app-nav-sidebar"
          >
            {items.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                aria-selected={item.active}
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
      {/* position:fixed로 뷰포트 바닥에 붙여 스크롤과 무관하게 항상 보이게 한다. narrowMain의
          paddingBottom이 이 높이만큼 콘텐츠를 밀어줘서 마지막 줄이 하단바에 가려지지 않는다. */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBarFixed}>
        <View style={styles.bottomBar}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              aria-selected={item.active}
              onPress={item.onPress}
              style={styles.bottomBarItem}
            >
              <Icon
                name={item.icon}
                size={20}
                color={item.active ? storybookTheme.color.primary : storybookTheme.color.onContentMuted}
              />
              <Text numberOfLines={1} style={[styles.bottomBarLabel, item.active && styles.bottomBarLabelActive]}>
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
  // root=라이트 배경, 사이드바(우측)는 다크. 상/하단 nav는 라이트 배경 + 다크 텍스트.
  root: { flex: 1, backgroundColor: storybookTheme.color.background },
  wideRow: { flex: 1, flexDirection: 'row' },
  wideMain: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
    // sidebar가 position:fixed라 flex 흐름 밖에 있으므로, 그 자리만큼 오른쪽 여백을 직접
    // 확보해 콘텐츠가 사이드바 밑에 깔리지 않게 한다. 닫히면 0으로 - 트랜지션을 sidebar의
    // translateX와 같은 시간으로 맞춰 같이 좁아지는(reflow) 느낌을 준다.
    paddingRight: SIDEBAR_WIDTH,
    ...transition('padding-right'),
  },
  wideMainCollapsed: { paddingRight: 0 },
  wideBackRow: { paddingHorizontal: 24, paddingTop: 16 },
  wideBackButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 18,
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
  },
  wideBackLabel: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  sidebarToggle: {
    position: 'fixed' as 'absolute',
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
    zIndex: storybookTheme.zIndex.overlay,
    ...transition('right'),
  },
  sidebar: {
    position: 'fixed' as 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: storybookTheme.color.sidebarBackground,
    borderLeftWidth: 1,
    borderLeftColor: storybookTheme.color.sidebarBorder,
    paddingVertical: 24,
    paddingHorizontal: 12,
    gap: 4,
    zIndex: storybookTheme.zIndex.sticky,
    transform: [{ translateX: 0 }],
    ...transition('transform'),
  },
  sidebarClosed: {
    transform: [{ translateX: SIDEBAR_WIDTH }],
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
    minHeight: BOTTOM_BAR_HEIGHT,
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
