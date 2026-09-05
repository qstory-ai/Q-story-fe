import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, Card, ErrorState, Icon, LoadingState, Pill, SafeAreaView, storybookTheme } from '@/shared/ui';
import { fetchStoryEntry, type StoryCatalogEntry } from '@/entities/story';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import { useBookmarks } from '@/entities/bookmark';
import { useChildren } from '@/entities/child';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';
import { ChildPickerModal } from '@/features/child-picker';
import { LessonPlanPickerModal } from '@/features/lesson-plan-picker';
import { TutorStudentPickerModal } from '@/features/tutor-student-picker';

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
  const [tutorStudentPickerOpen, setTutorStudentPickerOpen] = useState(false);
  // 튜터가 페이지에 들어오는 순간 학생 목록을 미리 fetch해 두면 "이야기 시작하기" 눌렀을 때
  // 학생 수를 즉시 판단할 수 있다. null=아직 로드 안 됨(그 사이 클릭하면 그냥 picker 열어 로드
  // 상태를 사용자가 봄), 배열=로드됨.
  const [tutorStudents, setTutorStudents] = useState<TutorStudent[] | null>(null);

  const isAuthenticated = state.status === 'authenticated';
  const isTutor = isAuthenticated && state.user.role === 'TUTOR';
  const isParent = isAuthenticated && state.user.role === 'PARENT';
  const tutorToken = isTutor ? state.token : null;

  useEffect(() => {
    if (!tutorToken) return;
    let cancelled = false;
    listTutorStudents(tutorToken)
      .then((list) => {
        if (!cancelled) setTutorStudents(list);
      })
      .catch(() => {
        if (!cancelled) setTutorStudents([]); // 실패 시엔 빈 목록으로 취급 - picker 안에서 오류가 다시 뜬다.
      });
    return () => {
      cancelled = true;
    };
  }, [tutorToken]);

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
   * "이야기 시작하기"를 눌렀을 때 다중 프로필/학생 상황이면 명시적으로 고르게 인터럽트한다 -
   * 홈에서 selectedChild를 바꾸지 않고 시작해 다른 아이 세션으로 잘못 기록되는 걸 막는다.
   *
   * 부모: 아이 2+명이면 picker, 0명이면 picker의 등록 CTA, 1명이면 곧바로.
   * 선생님: 학생 2+명이면 picker, 0명이면 picker의 등록 CTA, 1명이면 그 학생 id를 붙여
   *   곧바로 시작. 반 선생님도 "새싹반" 같은 이름의 학생 하나로 등록하면 이 흐름으로 커버된다.
   */
  const startPlay = useCallback((targetStoryId: string) => {
    if (isParent && children.length !== 1) {
      setChildPickerOpen(true);
      return;
    }
    if (isTutor) {
      // 아직 학생 목록이 안 왔거나 2+명이거나 0명이면 picker를 띄운다. 1명일 때만 곧장 이동.
      if (tutorStudents !== null && tutorStudents.length === 1) {
        navigate(`/stories/${targetStoryId}/play?tutorStudentId=${tutorStudents[0].id}`);
        return;
      }
      setTutorStudentPickerOpen(true);
      return;
    }
    navigate(`/stories/${targetStoryId}/play`);
  }, [isParent, isTutor, children.length, tutorStudents, navigate]);

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
                <Icon name="book" size={36} color={storybookTheme.color.onContentMuted} />
              </View>
            )}
          </View>
          <Card variant="surface" padding="lg" style={styles.infoCard}>
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
          </Card>
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

      {effectiveLoad.status === 'ready' && isTutor && tutorToken ? (
        <TutorStudentPickerModal
          visible={tutorStudentPickerOpen}
          token={tutorToken}
          subtitle={`${effectiveLoad.story.title}을(를) 어떤 학생과 시작할까요?`}
          onClose={() => setTutorStudentPickerOpen(false)}
          onSelected={(student) => {
            setTutorStudentPickerOpen(false);
            navigate(`/stories/${effectiveLoad.story.storyId}/play?tutorStudentId=${student.id}`);
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
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
  },
  content: {
    flex: 1,
    width: '100%',
    // contentMaxWidth(420, 로그인/가입 폼 전용 폭)였는데, 이 페이지로 들어오는 진입점(/library,
    // 홈 히어로)은 훨씬 넓은 폭(wideMaxWidth 1040 / dashboardCardWideMaxWidth 760)을 쓰고 있어서
    // 넓은 화면에서 카드가 갑자기 좁아지며 뚝 끊기는 느낌이 났다.
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
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
  // Card 프리미티브가 배경/테두리/라운드/패딩/elevation을 담당. 여기선 커버 이미지 위로
  // 살짝 겹치는 negative margin과 좌우 여백, 자식 gap, 강조 elevation만 오버라이드한다.
  infoCard: {
    marginTop: -28,
    marginHorizontal: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.ms,
    ...storybookTheme.elevation.high,
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
  actionInfo: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.primary,
    textAlign: 'center',
    fontWeight: storybookTheme.type.weight.bold,
  },
});
