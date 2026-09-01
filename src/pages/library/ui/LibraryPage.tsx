import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { StoryLibraryGrid } from '@/features/story-library';

type Tab = 'all' | 'in-progress' | 'read' | 'saved';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'in-progress', label: '읽는 중' },
  { key: 'read', label: '읽은 작품' },
  { key: 'saved', label: '저장한 작품' },
];

/**
 * 부모용 서재 탭 ("/library") - 예전 부모 홈에 임베드돼 있던 StoryLibraryGrid를 여기로
 * 옮겼다. 홈은 "오늘의 큐레이션"에 집중하고, 이 화면은 "전체 카탈로그 탐색"을 담당한다.
 * 상단 세그먼트(전체/읽는 중/읽은 작품/저장한 작품)는 IA에 있는 네 개를 모두 두되, 이번
 * 세션에선 "전체"만 실동작한다 - 나머지 세 개는 UI만 먼저 만들고 진행률/열람 기록/북마크
 * 백엔드가 준비되면 그때 연결한다.
 */
export function LibraryPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'library')}>
      <View style={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">서재</Text>

        <View style={styles.tabRow}>
          {TABS.map((entry) => {
            const active = entry.key === tab;
            return (
              <Pressable
                key={entry.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(entry.key)}
                style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'all' ? (
          <StoryLibraryGrid />
        ) : (
          <View style={styles.stubPanel}>
            <Text style={styles.stubTitle}>곧 준비돼요</Text>
            <Text style={styles.stubBody}>
              {tab === 'in-progress' && '읽는 중인 이야기가 여기에 모여요.'}
              {tab === 'read' && '끝까지 읽은 이야기가 여기에 모여요.'}
              {tab === 'saved' && '저장해 둔 이야기가 여기에 모여요.'}
            </Text>
          </View>
        )}
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: storybookTheme.color.gold,
    borderColor: storybookTheme.color.gold,
  },
  pressed: { opacity: 0.85 },
  tabLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDarkMuted,
  },
  tabLabelActive: { color: storybookTheme.color.background },
  stubPanel: {
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 6,
  },
  stubTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
  },
  stubBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onDarkMuted,
  },
});
