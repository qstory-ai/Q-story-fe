import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Modal, Pill, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { TUTOR_PATHS, dashboardNavItems, useAuth } from '@/entities/auth';
import {
  completeLesson,
  deleteLesson,
  getLesson,
  listLessonCompletions,
  startLesson,
  type Lesson,
} from '@/entities/lesson';
import type { StoryCompletionSummary } from '@/entities/story-completion';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { LessonPlaySettingPicker, type PlaySetting } from '@/entities/play-session';
import { LessonFormModal } from '@/features/lesson-form';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | {
      requestKey: string;
      status: 'ready';
      lesson: Lesson;
      storyById: Record<string, StoryCatalogEntry>;
      completions: StoryCompletionSummary[];
    }
  | { requestKey: string; status: 'error'; message: string };

/**
 * IA "[3] 수업 상세" 화면. 기본 정보(이름/목표/일정) + 참여 학생 + 사용 이야기 + 상태 전환
 * 액션(시작/완료) + 삭제. 이야기 행은 카탈로그와 join해 제목을 표시하고, "시작"은 lessonId를
 * 붙여 스토리 플레이어로 넘긴다.
 */
export function TutorLessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${lessonId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // 수업 진행 형태(Q-40) - 기본은 전체 반.
  const [playSetting, setPlaySetting] = useState<PlaySetting>('WHOLE_CLASS');

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (!token || !lessonId) return;
    let cancelled = false;
    Promise.all([
      getLesson(token, lessonId),
      listStories().catch(() => []),
      listLessonCompletions(token, lessonId).catch(() => [] as StoryCompletionSummary[]),
    ])
      .then(([lesson, stories, completions]) => {
        if (cancelled) return;
        const storyById = Object.fromEntries(stories.map((story) => [story.storyId, story]));
        setLoad({ requestKey, status: 'ready', lesson, storyById, completions });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = messageForError(failure, '수업을 불러오지 못했어요.');
        setLoad({ requestKey, status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, lessonId, requestKey]);

  const transition = useCallback(
    async (action: (authToken: string, id: string) => Promise<Lesson>, fallbackMessage: string) => {
      if (!token || !lessonId) return;
      setTransitioning(true);
      setTransitionError(null);
      try {
        const updated = await action(token, lessonId);
        setLoad((prev) => prev.status === 'ready' && prev.requestKey === requestKey
          ? { ...prev, lesson: updated }
          : prev);
      } catch (failure: unknown) {
        setTransitionError(messageForError(failure, fallbackMessage));
      } finally {
        setTransitioning(false);
      }
    },
    [token, lessonId, requestKey],
  );
  const doStart = useCallback(() => transition(startLesson, '수업을 시작하지 못했어요.'), [transition]);
  const doComplete = useCallback(() => transition(completeLesson, '수업을 완료 처리하지 못했어요.'), [transition]);

  const doDelete = useCallback(async () => {
    if (!token || !lessonId) return;
    setDeleteInFlight(true);
    try {
      await deleteLesson(token, lessonId);
      navigate(TUTOR_PATHS.lessons, { replace: true });
    } catch (failure: unknown) {
      setTransitionError(messageForError(failure, '수업을 삭제하지 못했어요.'));
    } finally {
      setDeleteInFlight(false);
      setDeleteOpen(false);
    }
  }, [token, lessonId, navigate]);

  if (state.status !== 'authenticated') return null;

  const effective = load.requestKey === requestKey ? load : { requestKey, status: 'loading' as const };

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={() => navigate(TUTOR_PATHS.lessons)}>
      <View style={styles.content}>
        {effective.status === 'loading' && <LoadingState label="수업 정보를 불러오는 중이에요…" />}

        {effective.status === 'error' && (
          <ErrorState message={effective.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}

        {effective.status === 'ready' && (
          <>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.title} accessibilityRole="header">{effective.lesson.name}</Text>
                <Pill label={STATUS_LABEL[effective.lesson.status]} tone="onCard" />
              </View>
              {effective.lesson.goal ? <Text style={styles.body}>{effective.lesson.goal}</Text> : null}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>수업 일정</Text>
                <Text style={styles.metaValue}>
                  {effective.lesson.scheduledAt ? formatDateTime(effective.lesson.scheduledAt) : '미정'}
                </Text>
              </View>
              {effective.lesson.startedAt ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>시작</Text>
                  <Text style={styles.metaValue}>{formatDateTime(effective.lesson.startedAt)}</Text>
                </View>
              ) : null}
              {effective.lesson.completedAt ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>완료</Text>
                  <Text style={styles.metaValue}>{formatDateTime(effective.lesson.completedAt)}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>참여 학생 {effective.lesson.students.length}명</Text>
              {effective.lesson.students.length === 0 ? (
                <Text style={styles.helper}>담긴 학생이 없어요. 수업 편집에서 학생을 추가해 주세요.</Text>
              ) : (
                effective.lesson.students.map((student) => (
                  <View key={student.id} style={styles.studentRow}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentMeta}>{student.ageBand}</Text>
                    </View>
                    <Pill
                      label={student.status === 'CONFIRMED' ? '보호자 연결됨' : '보호자 연결 대기'}
                      tone="onCard"
                    />
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>사용 이야기 {effective.lesson.storyIds.length}편</Text>
              {effective.lesson.storyIds.length > 0 && (
                <LessonPlaySettingPicker value={playSetting} onChange={setPlaySetting} align="start" />
              )}
              {effective.lesson.storyIds.length === 0 ? (
                <Text style={styles.helper}>담긴 이야기가 없어요.</Text>
              ) : (
                effective.lesson.storyIds.map((storyId) => {
                  const story = effective.storyById[storyId];
                  return (
                    <View key={storyId} style={styles.studentRow}>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{story?.title ?? storyId}</Text>
                        {story?.category ? <Text style={styles.studentMeta}>{story.category}</Text> : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${story?.title ?? storyId} 시작하기`}
                        onPress={() => {
                          // lessonId를 붙여 서버가 참여 학생 전원을 한 기록으로 묶게 한다(반 수업이면 반 수업 리포트).
                          // 개별 수업은 tutorStudentId의 학생 기록이 된다.
                          const firstStudent = effective.lesson.students[0];
                          const params = new URLSearchParams({ lessonId: effective.lesson.id, setting: playSetting });
                          if (firstStudent) params.set('tutorStudentId', firstStudent.id);
                          navigate(`/stories/${storyId}/play?${params.toString()}`);
                        }}
                        style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.startLabel}>시작</Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>리포트 {effective.completions.length}건</Text>
              {effective.completions.length === 0 ? (
                <Text style={styles.helper}>아직 이 수업에서 끝까지 들은 이야기가 없어요. 위 "시작"으로 진행하면 기록이 남고, 연결된 부모님께 리포트가 전달돼요.</Text>
              ) : (
                effective.completions.map((completion) => {
                  const student = effective.lesson.students.find((candidate) => candidate.id === completion.tutorStudentId);
                  const story = effective.storyById[completion.storyId];
                  const who =
                    completion.sessionKind === 'CLASS'
                      ? `반 수업 · ${completion.participantCount}명 참여`
                      : (student?.name ?? '학생 미지정');
                  return (
                    <Pressable
                      key={completion.id}
                      accessibilityRole="link"
                      onPress={() => navigate(`/reports/${completion.id}`)}
                      style={({ pressed }) => [styles.studentRow, pressed && styles.pressed]}
                    >
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{who}</Text>
                        <Text style={styles.studentMeta}>
                          {story?.title ?? completion.storyId} · {formatDateTime(completion.completedAt)}
                        </Text>
                      </View>
                      <Pill label="완주" tone="onCard" />
                    </Pressable>
                  );
                })
              )}
            </View>

            {transitionError ? <StatusBanner variant="warning" label={transitionError} /> : null}

            {effective.lesson.classGroupId ? (
              // 반 수업은 학생을 따로 넣지 않아도 된다 - 반 초대 링크로 들어온 아이가 수업에 함께 기록된다.
              <ActionButton
                variant="secondaryFull"
                label="반 초대 링크·명단 보기"
                onPress={() => navigate(TUTOR_PATHS.classDetail(effective.lesson.classGroupId ?? ''))}
              />
            ) : null}

            <View style={styles.actionCard}>
              {effective.lesson.status !== 'COMPLETED' ? (
                <ActionButton
                  label={
                    effective.lesson.status === 'IN_PROGRESS'
                      ? transitioning ? '완료 처리 중…' : '수업 완료'
                      : transitioning ? '시작 중…' : '수업 시작'
                  }
                  onPress={effective.lesson.status === 'IN_PROGRESS' ? doComplete : doStart}
                  loading={transitioning}
                  disabled={transitioning}
                />
              ) : null}
              {/* 편집은 아직 시작하지 않은 수업(SCHEDULED)에만 노출 - 이미 진행/완료된 세션의
                  참여 학생/이야기를 바꾸면 저장된 리포트와 어긋난다. 상태 전환 후엔 삭제만 남긴다. */}
              {effective.lesson.status === 'SCHEDULED' ? (
                <ActionButton
                  variant="secondaryFull"
                  label="수업 편집"
                  onPress={() => setEditOpen(true)}
                />
              ) : null}
              {effective.lesson.status === 'COMPLETED' ? (
                <ActionButton
                  variant="secondaryFull"
                  label="리포트 확인"
                  onPress={() => navigate('/tutor/reports')}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => setDeleteOpen(true)}
                style={styles.deleteLink}
              >
                <Text style={styles.deleteLinkText}>수업 삭제</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <Modal
        visible={deleteOpen}
        title="이 수업을 삭제할까요?"
        accessibilityLabel="수업 삭제 확인"
        positiveAction={{
          label: deleteInFlight ? '삭제 중…' : '삭제',
          onPress: doDelete,
          disabled: deleteInFlight,
          loading: deleteInFlight,
        }}
        negativeAction={{
          label: '취소',
          onPress: () => setDeleteOpen(false),
          disabled: deleteInFlight,
        }}
      >
        <Text style={styles.dialogBody}>
          수업이 사라져도 이미 진행돼 저장된 세션 리포트는 그대로 남아요.
        </Text>
      </Modal>

      {/* key로 lesson.id + updatedAt + editOpen을 걸어, 값이 갱신되거나 다시 열 때 폼을 최신 초기값으로 remount한다. */}
      <LessonFormModal
        key={effective.status === 'ready' ? `${effective.lesson.id}:${effective.lesson.updatedAt}:${editOpen ? 'open' : 'closed'}` : 'no-lesson'}
        visible={editOpen}
        editing={effective.status === 'ready' ? effective.lesson : null}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setLoad((prev) => (prev.status === 'ready' && prev.requestKey === requestKey
            ? { ...prev, lesson: updated }
            : prev));
        }}
      />
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- helpers */

const STATUS_LABEL: Record<Lesson['status'], string> = {
  SCHEDULED: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function formatDateTime(iso: string) {
  return DATE_TIME_FORMAT.format(new Date(iso));
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.tabletMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.ms,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 20,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  metaLabel: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  metaValue: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardBody, fontWeight: storybookTheme.type.weight.semibold },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  helper: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  studentInfo: { flex: 1, gap: 2 },
  studentName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  studentMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  startButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.primary,
  },
  pressed: { opacity: 0.85 },
  startLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  actionCard: {
    gap: 8,
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  deleteLinkText: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.error,
    textDecorationLine: 'underline',
  },
  dialogBody: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
});
