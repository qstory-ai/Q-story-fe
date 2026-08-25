import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, BrandLockup, Icon, SafeAreaView, SectionHeader, StoryCard, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import { listStories, StoryApiError, type StoryCatalogEntry } from '@/entities/story';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; stories: StoryCatalogEntry[] }
  | { status: 'error'; message: string };

/**
 * 역할과 무관한 로그인 후 홈 화면 - PARENT와 CLASS_ACCOUNT 둘 다 도착하는 이야기 서재.
 * /parent와 /class는 (변경 없이) 여전히 직접 접근 가능하지만, 로그인 후 기본 목적지는
 * 더 이상 아님(LoginPage의 homePathFor와 SignupPage 참고) - 이유는 계획 문서 참고.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  const canView = state.status === 'authenticated' && (state.user.role === 'PARENT' || state.user.role === 'CLASS_ACCOUNT');

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    listStories()
      .then((stories) => {
        if (!cancelled) setLoad({ status: 'ready', stories });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = failure instanceof StoryApiError ? failure.message : '이야기 목록을 불러오지 못했어요.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const openStory = useCallback((storyId: string) => navigate(`/stories/${storyId}`), [navigate]);

  if (!canView) return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <BrandLockup size="compact" />
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigate('/mypage')}
              accessibilityRole="link"
              accessibilityLabel="마이페이지"
              hitSlop={8}
              style={styles.iconTarget}
            >
              <Icon name="user" size={18} color={storybookTheme.color.onDarkMuted} />
            </Pressable>
            <Pressable onPress={logout} accessibilityRole="button" hitSlop={8} style={styles.logoutTarget}>
              <Text style={styles.logout}>로그아웃</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.greeting}>안녕하세요, {state.user.displayName}님</Text>

        {state.user.role === 'CLASS_ACCOUNT' && (
          <Pressable
            onPress={() => navigate('/class')}
            accessibilityRole="link"
            hitSlop={8}
            style={styles.classLinkTarget}
          >
            <Text style={styles.classLink}>우리 반 코드 보기 →</Text>
          </Pressable>
        )}

        {state.user.role === 'PARENT' && (
          <Pressable
            onPress={() => navigate('/parent')}
            accessibilityRole="link"
            hitSlop={8}
            style={styles.classLinkTarget}
          >
            <Text style={styles.classLink}>부모 홈 화면 보기 →</Text>
          </Pressable>
        )}

        <View style={styles.section}>
          <SectionHeader title="이야기 서재" subtitle="표지를 골라 오늘 함께 읽을 이야기를 시작해요." />

          {load.status === 'loading' && (
            <View style={styles.centerBox}>
              <ActivityIndicator color={storybookTheme.color.gold} />
            </View>
          )}

          {load.status === 'error' && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{load.message}</Text>
              <ActionButton
                variant="secondary"
                label="다시 시도"
                onPress={() => {
                  setLoad({ status: 'loading' });
                  listStories()
                    .then((stories) => setLoad({ status: 'ready', stories }))
                    .catch(() => setLoad({ status: 'error', message: '이야기 목록을 불러오지 못했어요.' }));
                }}
              />
            </View>
          )}

          {load.status === 'ready' && load.stories.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>아직 준비된 이야기가 없어요. 곧 새 이야기로 찾아올게요.</Text>
            </View>
          )}

          {load.status === 'ready' && load.stories.length > 0 && (
            <View style={styles.grid}>
              {load.stories.map((story) => (
                <View key={story.storyId} style={styles.gridItem}>
                  <StoryCard
                    title={story.title}
                    coverImageUrl={story.coverImageUrl}
                    description={story.description}
                    category={story.category}
                    onPress={() => openStory(story.storyId)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inner: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconTarget: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTarget: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logout: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: storybookTheme.color.onDarkMuted,
  },
  greeting: {
    fontSize: storybookTheme.type.xl,
    fontWeight: '600',
    color: storybookTheme.color.onDark,
  },
  classLinkTarget: {
    minHeight: 44,
    justifyContent: 'center',
  },
  classLink: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '600',
    color: storybookTheme.color.gold,
  },
  section: {
    gap: 16,
    paddingBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: 280,
    maxWidth: 360,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  centerBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  errorText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    textAlign: 'center',
  },
  emptyText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    textAlign: 'center',
  },
});
