import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, Card, ErrorState, Icon, LoadingState, Pill, SafeAreaView, storybookTheme } from '@/shared/ui';
import { fetchStoryEntry, type StoryCatalogEntry } from '@/entities/story';
import { messageForError } from '@/shared/api';
import { withParticle } from '@/shared/lib';
import { useAuth } from '@/entities/auth';
import { useBookmarks } from '@/entities/bookmark';
import { useChildren } from '@/entities/child';
import { ChildPickerModal } from '@/features/child-picker';
import { ClassLessonStartModal } from '@/features/class-lesson-start';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; story: StoryCatalogEntry }
  | { requestKey: string; status: 'error'; message: string };

// 이 폭부터 표지+정보 카드를 나란히 배치한다 - 사이드바 셸 없이 뷰포트 전체 폭을 받으므로
// AppNavShell의 WIDE_BREAKPOINT(860)와는 별개 값.
const WIDE_BREAKPOINT = 760;

/**
 * 서재와 플레이어 사이의 이야기 상세. GET /v1/stories/{storyId}가 익명 접근을 지원하므로 로그인을
 * 강제하지 않는 공개 카탈로그 뷰다.
 */
export function StoryDetailPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const bookmarks = useBookmarks();
  const { children } = useChildren();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${storyId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [childPickerOpen, setChildPickerOpen] = useState(false);
  const [classPickerOpen, setClassPickerOpen] = useState(false);

  const isAuthenticated = state.status === 'authenticated';
  const isTutor = isAuthenticated && state.user.role === 'TUTOR';
  const isParent = isAuthenticated && state.user.role === 'PARENT';
  const tutorToken = isTutor ? state.token : null;
  const tutorId = isTutor ? state.user.id : null;

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
      const message = messageForError(failure, '저장 상태를 바꾸지 못했어요.');
      setBookmarkError(message);
    } finally {
      setBookmarkPending(false);
    }
  }, [storyId, isAuthenticated, bookmarks, navigate]);

  /**
   * "이야기 시작하기"를 눌렀을 때 다중 프로필 상황이면 명시적으로 고르게 인터럽트한다 -
   * 홈에서 selectedChild를 바꾸지 않고 시작해 다른 아이 세션으로 잘못 기록되는 걸 막는다.
   *
   * 부모: 아이 2+명이면 picker, 0명이면 picker의 등록 CTA, 1명이면 곧바로.
   * 선생님: 언제나 반을 고르게 한다 - 고른 반으로 수업을 만들고 그 수업으로 시작한다
   *   (선생님은 반 단위로만 일한다. 반이 하나여도 새 수업 기록이 생기므로 확인을 받는다).
   */
  const startPlay = useCallback((targetStoryId: string) => {
    if (isParent && children.length !== 1) {
      setChildPickerOpen(true);
      return;
    }
    if (isTutor) {
      setClassPickerOpen(true);
      return;
    }
    navigate(`/stories/${targetStoryId}/play`);
  }, [isParent, isTutor, children.length, navigate]);

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

      {effectiveLoad.status === 'loading' && <LoadingState label="이야기를 불러오는 중이에요…" />}

      {effectiveLoad.status === 'error' && (
        <ErrorState message={effectiveLoad.message} onRetry={retry} />
      )}

      {effectiveLoad.status === 'ready' && (
        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={isWide ? styles.coverFrameWide : styles.coverFrame}>
            {effectiveLoad.story.coverImageUrl ? (
              <Image
                source={{ uri: effectiveLoad.story.coverImageUrl }}
                resizeMode="cover"
                style={styles.cover}
                accessibilityLabel={`${effectiveLoad.story.title} 표지 그림`}
              />
            ) : (
              <View style={styles.coverFallback}>
                <Icon name="book" size={36} color={storybookTheme.color.onContentMuted} />
              </View>
            )}
          </View>
          <Card variant="surface" padding="lg" style={[styles.infoCard, isWide && styles.infoCardWide]}>
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
            </View>
            {bookmarkError ? <Text style={styles.actionError}>{bookmarkError}</Text> : null}
          </Card>
        </View>
      )}

      {effectiveLoad.status === 'ready' && isParent ? (
        <ChildPickerModal
          visible={childPickerOpen}
          subtitle={`${withParticle(effectiveLoad.story.title, '을/를')} 어떤 아이와 함께 볼까요?`}
          onClose={() => setChildPickerOpen(false)}
          onSelected={() => {
            setChildPickerOpen(false);
            // selectChild는 ChildPickerModal 내부에서 이미 호출됐다 - 여기선 플레이어로 이동만.
            navigate(`/stories/${effectiveLoad.story.storyId}/play`);
          }}
        />
      ) : null}

      {effectiveLoad.status === 'ready' && tutorToken && tutorId ? (
        <ClassLessonStartModal
          visible={classPickerOpen}
          token={tutorToken}
          tutorId={tutorId}
          storyId={effectiveLoad.story.storyId}
          storyTitle={effectiveLoad.story.title}
          onClose={() => setClassPickerOpen(false)}
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
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
  },
  content: {
    flex: 1,
    width: '100%',
    // 진입점(/library, 홈 히어로)과 비슷한 폭을 유지한다.
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
  },
  // WIDE_BREAKPOINT 이상에서는 표지+카드를 나란히 둔다(좁은 화면 구성을 넓히면 4:3 표지가 너무
  // 커진다). stretch로 표지 높이를 옆 카드 높이에 맞춘다(coverFrameWide 참고).
  contentWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: storybookTheme.spacing.lg,
    paddingTop: storybookTheme.spacing.xl,
    paddingHorizontal: storybookTheme.spacing.ml,
  },
  coverFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: storybookTheme.color.coverFallback,
  },
  // aspectRatio 없이 폭만 고정해 부모(contentWide)의 stretch로 높이가 정해지게 한다.
  coverFrameWide: {
    width: 320,
    flexShrink: 0,
    alignSelf: 'stretch',
    borderRadius: storybookTheme.radius.card,
    overflow: 'hidden',
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
  // 커버 이미지 위로 살짝 겹치는 negative margin과 강조 elevation만 오버라이드한다.
  infoCard: {
    // Card 기본값 width:'100%'에 좌우 margin이 더해지면 화면보다 넓어져 가로 스크롤이 생긴다 -
    // auto로 두고 부모 폭에서 margin을 뺀 만큼만 차지하게 한다.
    width: 'auto',
    marginTop: -28,
    marginHorizontal: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.ms,
    ...storybookTheme.elevation.high,
  },
  // 넓은 화면은 표지와 나란히 두므로 겹침을 지우고 남은 폭을 채운다.
  infoCardWide: {
    flex: 1,
    marginTop: 0,
    marginHorizontal: 0,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  description: {
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.light,
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
});
