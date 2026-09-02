import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, Icon, Pill, SafeAreaView, storybookTheme } from '@/shared/ui';
import { fetchStoryEntry, type StoryCatalogEntry } from '@/entities/story';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import { useBookmarks } from '@/entities/bookmark';
import { useChildren } from '@/entities/child';
import { ChildPickerModal } from '@/features/child-picker';
import { LessonPlanPickerModal } from '@/features/lesson-plan-picker';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; story: StoryCatalogEntry }
  | { requestKey: string; status: 'error'; message: string };

/**
 * 홈 서재(라이브러리)와 플레이어 사이에 위치한다 - GET /v1/stories/{storyId}는 이미 익명 접근을
 * 지원하므로(StoryCatalogService.get의 callerOrNull 참고), 이 페이지는 HomePage처럼 로그인을
 * 강제하지 않는다; 이 페이지가 호출하는 백엔드 엔드포인트와 마찬가지로 공개 카탈로그 뷰다.
 */
export function StoryDetailPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const bookmarks = useBookmarks();
  const { children } = useChildren();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${storyId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [lessonPickerOpen, setLessonPickerOpen] = useState(false);
  const [lessonToast, setLessonToast] = useState<string | null>(null);
  const [childPickerOpen, setChildPickerOpen] = useState(false);

  const isAuthenticated = state.status === 'authenticated';
  const isTutor = isAuthenticated && state.user.role === 'TUTOR';
  const isParent = isAuthenticated && state.user.role === 'PARENT';

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    fetchStoryEntry(storyId)
      .then((story) => {
        if (!cancelled) setLoad({ requestKey, status: 'ready', story });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          requestKey,
          status: 'error',
          message: messageForError(failure, '이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [storyId, requestKey]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const toggleBookmark = useCallback(async () => {
    if (!storyId) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setBookmarkPending(true);
    setBookmarkError(null);
    try {
      await bookmarks.toggle(storyId);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : '저장 상태를 바꾸지 못했어요.';
      setBookmarkError(message);
    } finally {
      setBookmarkPending(false);
    }
  }, [storyId, isAuthenticated, bookmarks, navigate]);

  /**
   * "이야기 시작하기"를 눌렀을 때 부모가 여러 아이를 등록해 뒀다면, 어느 아이와 함께 볼지
   * 명시적으로 고르게 한 번 인터럽트한다 - 홈에서 selectedChild를 바꾸지 않고 시작해 다른
   * 아이의 세션으로 잘못 기록되는 걸 막는다. 아이가 0명(=아직 등록 안 함)이거나 1명(=명확)
   * 인 경우, 그리고 부모가 아닌 역할은 그대로 곧바로 시작한다. 아이 0명인 부모는 픽커가
   * 열려서 등록 CTA를 보게 된다.
   */
  const startPlay = useCallback((targetStoryId: string) => {
    if (isParent && children.length >= 2) {
      setChildPickerOpen(true);
      return;
    }
    if (isParent && children.length === 0) {
      setChildPickerOpen(true);
      return;
    }
    navigate(`/stories/${targetStoryId}/play`);
  }, [isParent, children.length, navigate]);

  // 마지막으로 커밋된 로드 이후 storyId/attempt가 바뀌었다 - setState-in-effect 없이
  // 로딩 중인 것처럼 렌더링한다 (react-hooks/set-state-in-effect 참고).
  const effectiveLoad: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Pressable
        onPress={() => navigate('/')}
        accessibilityRole="link"
        hitSlop={8}
        style={styles.backLink}
      >
        <Text style={styles.backLinkText}>← 처음으로</Text>
      </Pressable>

      {effectiveLoad.status === 'loading' && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={storybookTheme.color.gold} />
        </View>
      )}

      {effectiveLoad.status === 'error' && (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{effectiveLoad.message}</Text>
          <ActionButton variant="secondary" label="다시 시도" onPress={retry} />
        </View>
      )}

      {effectiveLoad.status === 'ready' && (
        <View style={styles.content}>
          <View style={styles.coverFrame}>
            {effectiveLoad.story.coverImageUrl ? (
              <Image
                source={{ uri: effectiveLoad.story.coverImageUrl }}
                resizeMode="cover"
                style={styles.cover}
                accessibilityLabel={`${effectiveLoad.story.title} 표지 그림`}
              />
            ) : (
              <View style={styles.coverFallback}>
                <Icon name="book" size={36} color={storybookTheme.color.onDarkMuted} />
              </View>
            )}
          </View>
          <View style={styles.card}>
            {effectiveLoad.story.category ? <Pill label={effectiveLoad.story.category} /> : null}
            <Text style={styles.title} accessibilityRole="header">{effectiveLoad.story.title}</Text>
            {effectiveLoad.story.description ? (
              <Text style={styles.description}>{effectiveLoad.story.description}</Text>
            ) : null}
            <ActionButton
              label="이야기 시작하기"
              onPress={() => startPlay(effectiveLoad.story.storyId)}
            />
            <View style={styles.secondaryActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={bookmarks.isBookmarked(effectiveLoad.story.storyId) ? '저장 해제' : '저장하기'}
                onPress={toggleBookmark}
                disabled={bookmarkPending}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Icon
                  name={bookmarks.isBookmarked(effectiveLoad.story.storyId) ? 'check' : 'plus'}
                  size={16}
                  color={storybookTheme.color.primary}
                />
                <Text style={styles.secondaryLabel}>
                  {bookmarks.isBookmarked(effectiveLoad.story.storyId) ? '저장됨' : '저장하기'}
                </Text>
              </Pressable>
              {isTutor ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="수업에 사용하기"
                  onPress={() => setLessonPickerOpen(true)}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Icon name="graduationCap" size={16} color={storybookTheme.color.primary} />
                  <Text style={styles.secondaryLabel}>수업에 사용하기</Text>
                </Pressable>
              ) : null}
            </View>
            {bookmarkError ? <Text style={styles.actionError}>{bookmarkError}</Text> : null}
            {lessonToast ? <Text style={styles.actionInfo}>{lessonToast}</Text> : null}
          </View>
        </View>
      )}

      {effectiveLoad.status === 'ready' && isTutor ? (
        <LessonPlanPickerModal
          visible={lessonPickerOpen}
          storyId={effectiveLoad.story.storyId}
          storyTitle={effectiveLoad.story.title}
          onClose={() => setLessonPickerOpen(false)}
          onSuccess={(studentName) => setLessonToast(`${studentName} 수업에 담았어요.`)}
        />
      ) : null}

      {effectiveLoad.status === 'ready' && isParent ? (
        <ChildPickerModal
          visible={childPickerOpen}
          subtitle={`${effectiveLoad.story.title}을(를) 어떤 아이와 함께 볼까요?`}
          onClose={() => setChildPickerOpen(false)}
          onSelected={(child) => {
            setChildPickerOpen(false);
            // 완주 저장 시점의 useChildren().selectedChild가 이 값을 참조하도록 selectChild는
            // ChildPickerModal 내부에서 이미 호출됐다 - 여기선 곧바로 플레이어로 이동만.
            void child;
            navigate(`/stories/${effectiveLoad.story.storyId}/play`);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
  },
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backLinkText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  errorText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
  },
  coverFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: storybookTheme.color.coverFallback,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginTop: -28,
    marginHorizontal: 20,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 24,
    gap: 12,
    ...storybookTheme.elevation.high,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: '600',
    color: storybookTheme.color.onCardTitle,
  },
  description: {
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: '300',
    color: storybookTheme.color.onCardBody,
  },
  secondaryActions: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.primary,
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.7 },
  secondaryLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
  actionError: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
  actionInfo: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.primary,
    textAlign: 'center',
    fontWeight: storybookTheme.type.weight.bold,
  },
});
