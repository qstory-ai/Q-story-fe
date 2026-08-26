import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listStories, StoryApiError, type StoryCatalogEntry } from '@/entities/story';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; stories: StoryCatalogEntry[] }
  | { status: 'error'; message: string };

/**
 * STAFF의 랜딩 화면 - 저작할 이야기를 고른다. 예전엔 AccountLinkRow + 라이트 셸을 혼자 쓰고
 * 있었는데, PARENT/CLASS_ACCOUNT/TUTOR 홈은 모두 AppNavShell(다크 스토리북 팔레트)로
 * 옮겨간 뒤였다 - 역할마다 헤더가 다르게 보이던 걸 여기서도 같은 셸로 맞춘다.
 */
export function StaffHomePage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'STAFF') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || state.user.role !== 'STAFF') return;
    listStories()
      .then((stories) => setLoad({ status: 'ready', stories }))
      .catch((failure: unknown) =>
        setLoad({ status: 'error', message: failure instanceof StoryApiError ? failure.message : '이야기 목록을 불러오지 못했어요.' }),
      );
  }, [state]);

  if (state.status !== 'authenticated' || state.user.role !== 'STAFF') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')}>
      <View style={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>콘텐츠 운영자</Text>
          <Text style={styles.title} accessibilityRole="header">{state.user.displayName}님</Text>
          <Text style={styles.body}>편집할 이야기를 골라주세요.</Text>
        </View>

        {load.status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator color={storybookTheme.color.gold} />
          </View>
        )}
        {load.status === 'error' && <Text style={styles.errorText}>{load.message}</Text>}
        {load.status === 'ready' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>이야기 목록</Text>
            {load.stories.map((story) => (
              <Pressable
                key={story.storyId}
                onPress={() => navigate(`/staff/${story.storyId}`)}
                accessibilityRole="link"
                style={({ pressed }) => [styles.storyRow, pressed && styles.pressed]}
              >
                <Text style={styles.storyTitle}>{story.title}</Text>
                <Text style={styles.storyMeta}>
                  {story.storyId} · v{story.contentVersion}
                </Text>
              </Pressable>
            ))}
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
    maxWidth: 640,
    alignSelf: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    alignItems: 'stretch',
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
  },
  eyebrow: { fontSize: storybookTheme.type.xs, fontWeight: '700', color: storybookTheme.color.error, letterSpacing: 0.4 },
  title: { fontSize: storybookTheme.type.lg, fontWeight: '900', color: storybookTheme.color.onCardTitle },
  body: { fontSize: storybookTheme.type.sm, lineHeight: 21, color: storybookTheme.color.onCardBody },
  centered: { alignItems: 'center', paddingVertical: 24 },
  errorText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error, textAlign: 'center' },
  panel: {
    width: '100%',
    gap: 4,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  panelTitle: { fontSize: storybookTheme.type.md, fontWeight: '900', color: storybookTheme.color.onDark, marginBottom: 6 },
  storyRow: {
    gap: 2,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.panelOnDarkBorder,
  },
  pressed: { opacity: 0.85 },
  storyTitle: { fontSize: storybookTheme.type.sm, fontWeight: '700', color: storybookTheme.color.onDark },
  storyMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onDarkMuted },
});
