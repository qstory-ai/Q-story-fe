import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, Icon, LoadingState, Pill, RadioGroup, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useBackOr } from '@/shared/lib';
import {
  ORGANIZATION_PATHS,
  TUTOR_PATHS,
  assignClassHomeroom,
  dashboardNavItems,
  fetchClass,
  listClassHomeroomHistory,
  listClassStudents,
  previewClassByCode,
  reportDetailPath,
  useAuth,
  type ClassResponse,
  type ClassStudentResponse,
  type HomeroomHistoryEntry,
} from '@/entities/auth';
import { listOrganizationTutors, type OrganizationTutorLink } from '@/entities/organization-tutor';
import { listLessons, pickClassLessons, type Lesson } from '@/entities/lesson';
import { listStories } from '@/entities/story';
import {
  EXITED_BADGE_LABEL,
  isExitedSession,
  latestClassReports,
  listClassReports,
  summarizeStudentNames,
  type ClassReportItem,
} from '@/entities/story-completion';
import { LessonFormModal } from '@/features/lesson-form';
import { HomeroomInvitePanel, InviteCodeCard, classInviteLink, classInviteShareMessage } from '@/features/invite-issue';

type Viewer = 'TUTOR' | 'DIRECTOR';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | {
      requestKey: string;
      status: 'ready';
      classGroup: ClassResponse;
      organizationName: string | null;
      students: ClassStudentResponse[];
      tutors: OrganizationTutorLink[];
      history: HomeroomHistoryEntry[];
    }
  | { requestKey: string; status: 'error'; message: string };

/**
 * 반 상세 - 선생님(/tutor/classes/:id)과 관리자(/organization/classes/:id)가 같은 화면을 본다(Q-35에서 통합).
 * 반 초대 링크, 학생 명단(누르면 학생 상세), 보호자 연결 현황은 공통이고, 관리자에게만 담임 배정·변경과 담임
 * 이력, 담임 초대(선생님이 링크로 가입·수락하면 이 반 담임이 된다)가 붙는다. 담임을 바꿔도 지난 수업·리포트는 그때 선생님 것으로 남고, 이후 수업만 새 담임에게 간다.
 */
export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const role = state.status === 'authenticated' ? state.user.role : null;
  const viewer: Viewer | null = role === 'TUTOR' || role === 'DIRECTOR' ? role : null;
  const listPath = viewer === 'DIRECTOR' ? ORGANIZATION_PATHS.classes : TUTOR_PATHS.classes;
  const goBack = useBackOr(listPath);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${classId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [changing, setChanging] = useState(false);
  const [pickedTutorId, setPickedTutorId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [inviteOtherOpen, setInviteOtherOpen] = useState(false);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonsReload, setLessonsReload] = useState(0);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!viewer) navigate('/', { replace: true });
  }, [state.status, viewer, navigate]);

  const token = state.status === 'authenticated' ? state.token : null;
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;

  useEffect(() => {
    if (!token || !classId || !viewer) return;
    let cancelled = false;
    Promise.all([fetchClass(token, classId), listClassStudents(token, classId)])
      .then(async ([classGroup, students]) => {
        // 기관 이름: 반 응답에 없어 보호자가 보는 미리보기에서 가져온다(머리말용, 실패해도 무방).
        // 관리자: 선생님 목록(담임 이름·배정 폼)과 담임 이력 - 부가 정보라 실패해도 반 화면은 보여 준다.
        const [organizationName, tutors, history] = await Promise.all([
          previewClassByCode(classGroup.joinCode).then((preview) => preview.organizationName).catch(() => null),
          viewer === 'DIRECTOR' && organizationId
            ? listOrganizationTutors(token, organizationId).catch(() => [] as OrganizationTutorLink[])
            : Promise.resolve([] as OrganizationTutorLink[]),
          viewer === 'DIRECTOR'
            ? listClassHomeroomHistory(token, classId).catch(() => [] as HomeroomHistoryEntry[])
            : Promise.resolve([] as HomeroomHistoryEntry[]),
        ]);
        if (!cancelled) {
          setLoad({ requestKey, status: 'ready', classGroup, organizationName, students, tutors, history });
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoad({ requestKey, status: 'error', message: messageForError(failure, '반 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, viewer, organizationId, requestKey]);

  const onAssign = useCallback(async () => {
    if (!token || !classId || !pickedTutorId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await assignClassHomeroom(token, classId, pickedTutorId);
      setPickedTutorId(null);
      setChanging(false);
      setAttempt((n) => n + 1);
    } catch (failure: unknown) {
      setAssignError(messageForError(failure, '담임 선생님을 정하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setAssigning(false);
    }
  }, [token, classId, pickedTutorId]);

  if (state.status !== 'authenticated' || !viewer) return null;
  const effective: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };

  const openStudent = (studentId: string) => {
    if (!classId) return;
    navigate(viewer === 'DIRECTOR' ? ORGANIZATION_PATHS.student(classId, studentId) : TUTOR_PATHS.student(studentId));
  };

  const loadedClass = effective.status === 'ready' ? effective.classGroup : null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={goBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {effective.status === 'loading' && <LoadingState label="반 정보를 불러오는 중이에요…" />}
        {effective.status === 'error' && (
          <ErrorState message={effective.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {effective.status === 'ready' && (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>{effective.organizationName ?? (viewer === 'DIRECTOR' ? '우리 기관' : '반')}</Text>
              <Text style={styles.title} accessibilityRole="header">{effective.classGroup.name}</Text>
              <Text style={styles.body}>
                보호자 연결 {effective.students.filter((student) => student.status === 'CONFIRMED').length} /{' '}
                {effective.students.length}명
              </Text>
            </View>

            <InviteCodeCard
              reusable
              shortCode={effective.classGroup.joinCode}
              link={classInviteLink(effective.classGroup.joinCode)}
              shareMessage={classInviteShareMessage(effective.classGroup.name, effective.organizationName)}
            />

            {viewer === 'DIRECTOR' && !effective.classGroup.tutorId ? (
              <HomeroomInvitePanel
                token={state.token}
                classId={effective.classGroup.id}
                className={effective.classGroup.name}
                organizationName={effective.organizationName}
                replacesHomeroom={false}
              />
            ) : null}

            {viewer === 'DIRECTOR' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>담임 선생님</Text>
                {effective.classGroup.tutorId ? (
                  <View style={styles.homeroomRow}>
                    <Text style={[styles.body, styles.flex]}>
                      {tutorName(effective.classGroup.tutorId, effective.tutors, effective.history)}
                    </Text>
                    {!changing && effective.tutors.some((link) => link.tutorId !== effective.classGroup.tutorId) ? (
                      <ActionButton variant="secondary" size="sm" label="담임 바꾸기" onPress={() => setChanging(true)} />
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.body}>
                    아직 담임이 없어요. 위 담임 초대를 선생님께 보내거나, 이미 기관에 소속된 선생님을 바로 담임으로 정할 수 있어요. 담임이 정해지면 지금까지 명단에 올라온 학생이 그 선생님의 학생이 되고, 이후 수업과 리포트는 선생님 계정에서 이어져요.
                  </Text>
                )}

                {!effective.classGroup.tutorId || changing ? (
                  effective.tutors.length === 0 ? (
                    effective.classGroup.tutorId ? (
                      <Text style={styles.body}>기관에 소속된 다른 선생님이 없어요. 아래 담임 초대로 새 선생님을 초대해 주세요.</Text>
                    ) : null
                  ) : (
                    <>
                      {changing ? (
                        <Text style={styles.body}>
                          지난 수업과 리포트는 그때 진행한 선생님 것으로 남아요. 학생 명단과 아직 시작하지 않은 수업은 새 담임에게 넘어가요. 관리자는 두 선생님의 기록을 모두 볼 수 있어요.
                        </Text>
                      ) : null}
                      <RadioGroup
                        accessibilityLabel="담임으로 정할 선생님"
                        value={pickedTutorId}
                        onChange={setPickedTutorId}
                        options={effective.tutors
                          .filter((link) => link.tutorId !== effective.classGroup.tutorId)
                          .map((link) => ({ value: link.tutorId, label: link.tutorDisplayName }))}
                      />
                      {assignError ? <StatusBanner variant="warning" label={assignError} /> : null}
                      <View style={styles.actions}>
                        <ActionButton
                          label={assigning ? '저장 중…' : changing ? '이 선생님으로 바꾸기' : '담임으로 배정'}
                          onPress={onAssign}
                          disabled={!pickedTutorId || assigning}
                        />
                        {changing ? (
                          <ActionButton
                            variant="secondary"
                            label="취소"
                            onPress={() => {
                              setChanging(false);
                              setPickedTutorId(null);
                              setAssignError(null);
                            }}
                          />
                        ) : null}
                      </View>
                    </>
                  )
                ) : null}

                {effective.classGroup.tutorId ? (
                  <View style={styles.inviteOther}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: inviteOtherOpen }}
                      onPress={() => setInviteOtherOpen((open) => !open)}
                      style={({ pressed }) => [styles.inviteOtherToggle, pressed && styles.pressed]}
                    >
                      <Text style={styles.inviteOtherLabel}>다른 선생님을 담임으로 초대</Text>
                      <View style={inviteOtherOpen ? styles.flipped : undefined}>
                        <Icon name="chevronDown" size={16} color={storybookTheme.color.primary} />
                      </View>
                    </Pressable>
                    {inviteOtherOpen ? (
                      <HomeroomInvitePanel
                        token={state.token}
                        classId={effective.classGroup.id}
                        className={effective.classGroup.name}
                        organizationName={effective.organizationName}
                        replacesHomeroom
                      />
                    ) : null}
                  </View>
                ) : null}

                {effective.history.length > 1 ? (
                  <View style={styles.history}>
                    <Text style={styles.historyTitle}>담임 이력</Text>
                    {[...effective.history].reverse().map((entry) => (
                      <Text key={`${entry.tutorId}:${entry.startedAt}`} style={styles.rowMeta}>
                        {entry.tutorDisplayName} · {formatDate(entry.startedAt)} ~ {entry.endedAt ? formatDate(entry.endedAt) : '지금'}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {viewer === 'TUTOR' ? (
              <ClassLessonsSection
                token={state.token}
                classId={effective.classGroup.id}
                reloadKey={lessonsReload}
                onCreate={() => setLessonFormOpen(true)}
                onOpen={(lessonId) => navigate(TUTOR_PATHS.lesson(lessonId))}
              />
            ) : null}

            <ClassReportsSection
              token={state.token}
              classId={effective.classGroup.id}
              onOpen={(completionId) => navigate(reportDetailPath(completionId))}
            />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>학생 {effective.students.length}명</Text>
              {effective.students.length === 0 ? (
                <Text style={styles.body}>
                  아직 들어온 아이가 없어요. 위 반 초대 링크를 보내면 보호자가 아이를 연결할 때 명단에 자동으로 올라가요. 수업은 명단이 비어 있어도 먼저 만들 수 있어요.
                </Text>
              ) : (
                effective.students.map((student) => (
                  <Pressable
                    key={student.id}
                    accessibilityRole="link"
                    accessibilityLabel={`${student.name} 학생 상세 열기`}
                    onPress={() => openStudent(student.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>
                        {student.name} · {student.ageBand}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {student.parentDisplayName
                          ? `보호자 ${student.parentDisplayName}${viewer === 'DIRECTOR' && student.parentEmail ? ` · ${student.parentEmail}` : ''}`
                          : '아직 보호자가 들어오지 않았어요'}
                      </Text>
                    </View>
                    <Pill
                      label={student.status === 'CONFIRMED' ? '연결됨' : '보호자 연결 대기'}
                      tone={student.status === 'CONFIRMED' ? 'accent' : 'onCard'}
                    />
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
      {viewer === 'TUTOR' && loadedClass ? (
        <LessonFormModal
          key={lessonFormOpen ? 'open' : 'closed'}
          visible={lessonFormOpen}
          initialClass={{ id: loadedClass.id, name: loadedClass.name }}
          onClose={() => setLessonFormOpen(false)}
          onCreated={() => setLessonsReload((n) => n + 1)}
        />
      ) : null}
    </AppNavShell>
  );
}

type SectionLoad<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

/** 이 반의 수업(선생님만) - 곧 할 수업과 최근 끝난 수업. 반 화면의 나머지와 따로 불러와 실패해도 화면은 남는다. */
function ClassLessonsSection({
  token,
  classId,
  reloadKey,
  onCreate,
  onOpen,
}: {
  token: string;
  classId: string;
  reloadKey: number;
  onCreate: () => void;
  onOpen: (lessonId: string) => void;
}) {
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<{ key: string; value: SectionLoad<Lesson[]> }>({ key: '', value: { status: 'loading' } });
  const key = `${classId}:${reloadKey}:${retry}`;

  useEffect(() => {
    let cancelled = false;
    listLessons(token)
      .then((lessons) => {
        if (!cancelled) setLoad({ key, value: { status: 'ready', data: pickClassLessons(lessons, classId) } });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoad({ key, value: { status: 'error', message: messageForError(failure, '수업을 불러오지 못했어요.') } });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, key]);

  const value: SectionLoad<Lesson[]> = load.key === key ? load.value : { status: 'loading' };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>수업</Text>
      {value.status === 'loading' ? <LoadingState compact label="수업을 불러오는 중이에요…" /> : null}
      {value.status === 'error' ? <ErrorState message={value.message} onRetry={() => setRetry((n) => n + 1)} /> : null}
      {value.status === 'ready' && value.data.length === 0 ? (
        <Text style={styles.body}>아직 이 반의 수업이 없어요. 수업을 만들면 여기에 모여요.</Text>
      ) : null}
      {value.status === 'ready'
        ? value.data.map((lesson) => (
            <Pressable
              key={lesson.id}
              accessibilityRole="link"
              accessibilityLabel={`${lesson.name} 수업 열기`}
              onPress={() => onOpen(lesson.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{lesson.name}</Text>
                <Text style={styles.rowMeta}>{lesson.scheduledAt ? formatDateTime(lesson.scheduledAt) : '일정 미정'}</Text>
              </View>
              <Pill label={LESSON_STATUS_LABEL[lesson.status]} tone="onCard" />
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        : null}
      <ActionButton variant="secondary" label="수업 만들기" onPress={onCreate} />
    </View>
  );
}

type ReportsData = { items: ClassReportItem[]; titles: Record<string, string> };

/** 이 반의 최근 리포트(최신 10개) - 선생님은 자기가 진행한 회차, 관리자는 전부(서버가 걸러 준다). */
function ClassReportsSection({
  token,
  classId,
  onOpen,
}: {
  token: string;
  classId: string;
  onOpen: (completionId: string) => void;
}) {
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<{ key: string; value: SectionLoad<ReportsData> }>({
    key: '',
    value: { status: 'loading' },
  });
  const key = `${classId}:${retry}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listClassReports(token, classId, 10), listStories().catch(() => [])])
      .then(([items, stories]) => {
        if (cancelled) return;
        setLoad({
          key,
          value: {
            status: 'ready',
            data: {
              items: latestClassReports(items, 10),
              titles: Object.fromEntries(stories.map((story) => [story.storyId, story.title])),
            },
          },
        });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoad({ key, value: { status: 'error', message: messageForError(failure, '리포트를 불러오지 못했어요.') } });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, key]);

  const value: SectionLoad<ReportsData> = load.key === key ? load.value : { status: 'loading' };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>최근 리포트</Text>
      {value.status === 'loading' ? <LoadingState compact label="리포트를 불러오는 중이에요…" /> : null}
      {value.status === 'error' ? <ErrorState message={value.message} onRetry={() => setRetry((n) => n + 1)} /> : null}
      {value.status === 'ready' && value.data.items.length === 0 ? (
        <Text style={styles.body}>아직 이 반의 리포트가 없어요. 수업에서 이야기를 읽으면 여기에 쌓여요.</Text>
      ) : null}
      {value.status === 'ready'
        ? value.data.items.map((report) => {
            const title = value.data.titles[report.storyId] ?? report.storyId;
            const students = summarizeStudentNames(report.studentNames);
            return (
              <Pressable
                key={report.id}
                accessibilityRole="link"
                accessibilityLabel={`${title} 리포트 열기`}
                onPress={() => onOpen(report.id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text style={styles.rowMeta}>
                    {formatDateTime(report.completedAt)}
                    {report.tutorName ? ` · ${report.tutorName}` : ''}
                  </Text>
                  {students ? <Text style={styles.rowMeta}>{students}</Text> : null}
                </View>
                {isExitedSession(report) ? <Pill label={EXITED_BADGE_LABEL} tone="onLight" /> : null}
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const LESSON_STATUS_LABEL: Record<Lesson['status'], string> = {
  SCHEDULED: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function tutorName(tutorId: string, tutors: OrganizationTutorLink[], history: HomeroomHistoryEntry[]) {
  return (
    tutors.find((link) => link.tutorId === tutorId)?.tutorDisplayName
    ?? history.find((entry) => entry.tutorId === tutorId)?.tutorDisplayName
    ?? '배정된 선생님'
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  header: { gap: storybookTheme.spacing.xs },
  eyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  flex: { flex: 1, gap: 2 },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  homeroomRow: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.sm },
  inviteOther: {
    gap: storybookTheme.spacing.sm,
    paddingTop: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  inviteOtherToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  flipped: { transform: [{ rotate: '180deg' }] },
  inviteOtherLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.sm },
  history: {
    gap: 4,
    paddingTop: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  historyTitle: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  pressed: { opacity: 0.85 },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  rowMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  chevron: { fontSize: storybookTheme.type.lg, color: storybookTheme.color.onCardMuted, paddingHorizontal: 4 },
});
