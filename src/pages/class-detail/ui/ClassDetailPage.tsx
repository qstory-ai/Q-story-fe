import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Pill, RadioGroup, StatusBanner, storybookTheme } from '@/shared/ui';
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
  useAuth,
  type ClassResponse,
  type ClassStudentResponse,
  type HomeroomHistoryEntry,
} from '@/entities/auth';
import { listOrganizationTutors, type OrganizationTutorLink } from '@/entities/organization-tutor';
import { InviteCodeCard, classInviteLink, classInviteShareMessage } from '@/features/invite-issue';

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
 * 이력이 붙는다. 담임을 바꿔도 지난 수업·리포트는 그때 선생님 것으로 남고, 이후 수업만 새 담임에게 간다.
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
        // 선생님: 반 응답에 기관 이름이 없어 보호자가 보는 미리보기에서 가져온다.
        // 관리자: 선생님 목록(담임 이름·배정 폼)과 담임 이력 - 부가 정보라 실패해도 반 화면은 보여 준다.
        const [organizationName, tutors, history] = await Promise.all([
          viewer === 'TUTOR'
            ? previewClassByCode(classGroup.joinCode).then((preview) => preview.organizationName).catch(() => null)
            : Promise.resolve(null),
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
              <Text style={styles.eyebrow}>{effective.organizationName ?? '반'}</Text>
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
                    아직 담임이 없어요. 배정하면 지금까지 명단에 올라온 학생이 그 선생님의 학생이 되고, 이후 수업과 리포트는 선생님 계정에서 이어져요.
                  </Text>
                )}

                {!effective.classGroup.tutorId || changing ? (
                  effective.tutors.length === 0 ? (
                    <Text style={styles.body}>기관에 소속된 선생님이 없어요. 선생님 메뉴에서 초대해 주세요.</Text>
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
    </AppNavShell>
  );
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
