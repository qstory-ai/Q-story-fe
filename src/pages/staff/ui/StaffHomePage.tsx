import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AccountLinkRow, SafeAreaView, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import { listStories, StoryApiError, type StoryCatalogEntry } from '@/entities/story';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; stories: StoryCatalogEntry[] }
  | { status: 'error'; message: string };

/** STAFF의 랜딩 화면 - 저작할 이야기를 고른다. role로 접근을 막는데, OrganizationSignupPage 자체의 인증 상태 가드와 같은 형태다. */
export function StaffHomePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <AccountLinkRow onMyPage={() => navigate('/mypage')} onLogout={logout} />

        <Text style={styles.title} accessibilityRole="header">콘텐츠 저작</Text>
        <Text style={styles.body}>편집할 이야기를 골라주세요.</Text>

        {load.status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        )}
        {load.status === 'error' && <Text style={styles.error}>{load.message}</Text>}
        {load.status === 'ready' &&
          load.stories.map((story) => (
            <Pressable
              key={story.storyId}
              onPress={() => navigate(`/staff/${story.storyId}`)}
              accessibilityRole="button"
              style={styles.storyCard}
            >
              <Text style={styles.storyCardTitle}>{story.title}</Text>
              <Text style={styles.storyCardMeta}>
                {story.storyId} · v{story.contentVersion}
              </Text>
            </Pressable>
          ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.shellBackground,
  },
  content: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onLightHeading,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onLightBody,
    marginBottom: 8,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  error: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
  },
  storyCard: {
    gap: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: storybookTheme.color.surfaceWhite,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  storyCardTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  storyCardMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onLightMuted,
  },
});
