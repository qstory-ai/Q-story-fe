import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, AppNavShell, Modal, Pill, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  completeLesson,
  deleteLesson,
  getLesson,
  startLesson,
  type Lesson,
} from '@/entities/lesson';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { DEFAULT_BETA_STORY_ID } from '@/entities/story';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; lesson: Lesson; storyById: Record<string, StoryCatalogEntry> }
  | { requestKey: string; status: 'error'; message: string };

/**
 * IA "[3] 수업 상세" 화면. 기본 정보(이름/목표/일정) + 참여 학생 + 사용 이야기 + 상태 전환
 * 액션(시작/완료) + 삭제. 이야기 카드는 카탈로그와 join해 제목을 표시하고, 각 학생별로 "이야기
 * 시작하기" 버튼이 학생을 선택해 스토리 플레이어로 넘기게 한다(기존 tutor-invite 파라미터 재사용).
 */
export function TutorLessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const requestKey = lessonId ?? '';
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !lessonId) return;
    let cancelled = false;
    Promise.all([getLesson(state.token, lessonId), listStories().catch(() => [])])
      .then(([lesson, stories]) => {
        if (cancelled) return;
        const storyById = Object.fromEntries(stories.map((story) => [story.storyId, story]));
        setLoad({ requestKey, status: 'ready', lesson, storyById });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = failure instanceof Error ? failure.message : '수업을 불러오지 못했어요.';
        setLoad({ requestKey, status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [state, lessonId, requestKey]);

  const doStart = useCallback(async () => {
    if (state.status !== 'authenticated' || !lessonId) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const updated = await startLesson(state.token, lessonId);
      setLoad((prev) => prev.status === 'ready' && prev.requestKey === requestKey
        ? { ...prev, lesson: updated }
        : prev);
    } catch (failure: unknown) {
      setTransitionError(failure instanceof Error ? failure.message : '수업을 시작하지 못했어요.');
    } finally {
      setTransitioning(false);
    }
  }, [state, lessonId, requestKey]);

  const doComplete = useCallback(async () => {
    if (state.status !== 'authenticated' || !lessonId) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const updated = await completeLesson(state.token, lessonId);
      setLoad((prev) => prev.status === 'ready' && prev.requestKey === requestKey
        ? { ...prev, lesson: updated }
        : prev);
    } catch (failure: unknown) {
      setTransitionError(failure instanceof Error ? failure.message : '수업을 완료 처리하지 못했어요.');
    } finally {
      setTransitioning(false);
    }
  }, [state, lessonId, requestKey]);

  const doDelete = useCallback(async () => {
    if (state.status !== 'authenticated' || !lessonId) return;
    setDeleteInFlight(true);
    try {
      await deleteLesson(state.token, lessonId);
      navigate('/tutor/classes', { replace: true });
    } catch (failure: unknown) {
      setTransitionError(failure instanceof Error ? failure.message : '수업을 삭제하지 못했어요.');
    } finally {
      setDeleteInFlight(false);
      setDeleteOpen(false);
    }
  }, [state, lessonId, navigate]);

  if (state.status !== 'authenticated') return null;

  const effective = load.requestKey === requestKey ? load : { requestKey, status: 'loading' as const };

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'classes')} onBack={() => navigate('/tutor/classes')}>
      <View style={styles.content}>
        {effective.status === 'loading' && (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
        )}

        {effective.status === 'error' && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{effective.message}</Text>
            <ActionButton variant="secondary" label="수업 목록으로" onPress={() => navigate('/tutor/classes')} />
          </View>
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
                      label={student.status === 'CONFIRMED' ? '부모 연결됨' : '부모 연결 대기'}
                      tone="onCard"
                    />
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>사용 이야기 {effective.lesson.storyIds.length}편</Text>
              {effective.lesson.storyIds.length === 0 ? (
                <Text style={styles.helper}>담긴 이야기가 없어요.</Text>
              ) : (
                effective.lesson.storyIds.map((storyId) => {
                  const story = effective.storyById[storyId];
                  return (
                    <View key={storyId} style={styles.storyRow}>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{story?.title ?? storyId}</Text>
                        {story?.category ? <Text style={styles.studentMeta}>{story.category}</Text> : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${story?.title ?? storyId} 시작하기`}
                        onPress={() => {
                          // 시작 시 첫 번째 담긴 학생이 있으면 tutorStudentId 파라미터를 붙여
                          // story_completion이 그 학생과 연결되게 한다 - StoryPlayerRoute의
                          // ?tutorStudentId= 관례.
                          const firstStudent = effective.lesson.students[0];
                          const suffix = firstStudent ? `?tutorStudentId=${firstStudent.id}` : '';
                          const targetId = story?.storyId ?? storyId;
                          navigate(
                            targetId === DEFAULT_BETA_STORY_ID
                              ? `/demo${firstStudent ? `?tutorStudentId=${firstStudent.id}` : ''}`
                              : `/stories/${targetId}/play${suffix}`,
                          );
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

            {transitionError ? <StatusBanner variant="warning" label={transitionError} /> : null}

            <View style={styles.actionCard}>
              {effective.lesson.status !== 'COMPLETED' ? (
                <ActionButton
                  label={
                    effective.lesson.status === 'IN_PROGRESS'
                      ? transitioning ? '완료 처리 중…' : '수업 완료'
                      : transitioning ? '시작 중…' : effective.lesson.status === 'SCHEDULED' ? '수업 시작' : '이어서 진행'
                  }
                  onPress={effective.lesson.status === 'IN_PROGRESS' ? doComplete : doStart}
                  loading={transitioning}
                  disabled={transitioning}
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
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- helpers */

const STATUS_LABEL: Record<Lesson['status'], string> = {
  SCHEDULED: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.tabletMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.ms,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingVertical: storybookTheme.spacing.lg,
  },
  centerBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorText: { color: storybookTheme.color.error, fontSize: storybookTheme.type.sm, textAlign: 'center' },
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
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
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
    color: storybookTheme.color.onDark,
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
