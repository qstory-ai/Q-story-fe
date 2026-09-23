import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { AppNavShell, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  listOrganizationTutorLessons,
  listOrganizationTutorStudents,
  listOrganizationTutors,
  type OrganizationTutorLink,
} from '@/entities/organization-tutor';
import type { Lesson } from '@/entities/lesson';
import type { TutorStudent } from '@/entities/tutor';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; tutor: OrganizationTutorLink | null; students: TutorStudent[]; lessons: Lesson[] }
  | { status: 'error'; message: string };

const STUDENT_STATUS_LABEL: Record<TutorStudent['status'], string> = {
  PENDING_PARENT: '보호자 연결 대기',
  CONFIRMED: '보호자 연결됨',
};

const LESSON_STATUS_LABEL: Record<Lesson['status'], string> = {
  SCHEDULED: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

/**
 * 기관 관리자 > 선생님 관리 > 선생님 상세. 제품 결정대로 소속 선생님이 맡은 학생·수업을 "전부" 읽기
 * 전용으로 보여 준다(GET /v1/organizations/{org}/tutors/{tutor}/students, /lessons). 편집·시작은
 * 선생님 계정에서만 할 수 있다.
 */
export function OrganizationTutorDetailPage() {
  const { tutorId } = useParams<{ tutorId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  const canView = state.status === 'authenticated' && state.user.role === 'DIRECTOR' && Boolean(state.user.organizationId);
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) navigate('/', { replace: true });
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !organizationId || !tutorId) return;
    let cancelled = false;
    Promise.all([
      listOrganizationTutors(state.token, organizationId),
      listOrganizationTutorStudents(state.token, organizationId, tutorId),
      listOrganizationTutorLessons(state.token, organizationId, tutorId),
    ])
      .then(([tutors, students, lessons]) => {
        if (cancelled) return;
        setLoad({
          status: 'ready',
          tutor: tutors.find((link) => link.tutorId === tutorId) ?? null,
          students,
          lessons,
        });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: messageForError(failure, '선생님 정보를 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [state, organizationId, tutorId, reloadKey]);

  const upcomingLessons = useMemo(
    () => (load.status === 'ready' ? load.lessons.filter((lesson) => lesson.status !== 'COMPLETED') : []),
    [load],
  );
  const completedLessons = useMemo(
    () => (load.status === 'ready' ? load.lessons.filter((lesson) => lesson.status === 'COMPLETED') : []),
    [load],
  );

  if (!canView) return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization/tutors')}>
      <View style={styles.content}>
        {load.status === 'loading' ? (
          <LoadingState label="선생님 정보를 불러오는 중이에요…" />
        ) : load.status === 'error' ? (
          <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
        ) : (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {load.tutor ? `${load.tutor.tutorDisplayName} 선생님` : '선생님'}
            </Text>
            <Text style={styles.subtitle}>
              {load.tutor?.tutorEmail ? `${load.tutor.tutorEmail} · ` : ''}학생 {load.students.length}명 · 수업 {load.lessons.length}개
            </Text>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>맡고 있는 학생</Text>
              {load.students.length === 0 ? (
                <Text style={styles.body}>아직 등록한 학생이 없어요.</Text>
              ) : (
                load.students.map((student) => (
                  <View key={student.id} style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>
                        {student.name} · {student.ageBand}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {student.lessonType === 'CLASS'
                          ? `반 수업${student.classGroupName ? ` · ${student.classGroupName}` : ''}`
                          : '개인 레슨'}
                        {student.classType ? ` · ${student.classType}` : ''}
                      </Text>
                    </View>
                    <Pill label={STUDENT_STATUS_LABEL[student.status]} tone="onCard" />
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>예정·진행 중 수업</Text>
              {upcomingLessons.length === 0 ? (
                <Text style={styles.body}>예정된 수업이 없어요.</Text>
              ) : (
                upcomingLessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} />)
              )}
            </View>

            {completedLessons.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>완료한 수업</Text>
                {completedLessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} />)}
              </View>
            ) : null}
          </>
        )}
      </View>
    </AppNavShell>
  );
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{lesson.name}</Text>
        <Text style={styles.rowMeta}>
          {lesson.scheduledAt ? formatDateTime(lesson.scheduledAt) : '일정 미정'}
          {lesson.classGroupName ? ` · ${lesson.classGroupName}` : ''}
          {` · 학생 ${lesson.students.length}명`}
          {lesson.storyIds.length > 0 ? ` · 이야기 ${lesson.storyIds.length}편` : ''}
        </Text>
      </View>
      <Pill label={LESSON_STATUS_LABEL[lesson.status]} tone="onCard" />
    </View>
  );
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  rowMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
});
