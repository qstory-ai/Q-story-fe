import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, RadioGroup, StatusBanner, storybookTheme } from '@/shared/ui';
import {
  assignClassHomeroom,
  dashboardNavItems,
  fetchClass,
  listClassStudents,
  useDirectorSession,
  type ClassResponse,
  type ClassStudentResponse,
} from '@/entities/auth';
import { InviteCodeCard, classInviteLink, classInviteShareMessage } from '@/features/invite-issue';
import { listOrganizationTutors, type OrganizationTutorLink } from '@/entities/organization-tutor';
import { messageForError } from '@/shared/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; classGroup: ClassResponse; students: ClassStudentResponse[]; tutors: OrganizationTutorLink[] }
  | { status: 'error'; message: string };

/**
 * 원장의 반 상세 - 반 코드, 담임 선생님(미정이면 배정), 학생 명단. 학부모는 반 코드로 자기 아이를
 * 이 명단에 올린다.
 */
export function OrganizationClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const director = useDirectorSession(navigate);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [pickedTutorId, setPickedTutorId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const token = director?.token ?? null;
  const organizationId = director?.organizationId ?? null;

  useEffect(() => {
    if (!token || !classId || !organizationId) return;
    let cancelled = false;
    Promise.all([
      fetchClass(token, classId),
      listClassStudents(token, classId),
      // 선생님 목록은 담임 이름·배정 폼에만 쓰인다 - 이것만 실패해도 반 코드와 명단은 보여 준다.
      listOrganizationTutors(token, organizationId).catch(() => []),
    ])
      .then(([classGroup, students, tutors]) => {
        if (!cancelled) setLoad({ status: 'ready', classGroup, students, tutors });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          status: 'error',
          message: messageForError(failure, '반 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, organizationId, reloadKey]);

  const onAssign = useCallback(async () => {
    if (!token || !classId || !pickedTutorId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await assignClassHomeroom(token, classId, pickedTutorId);
      setPickedTutorId(null);
      setReloadKey((n) => n + 1);
    } catch (failure: unknown) {
      setAssignError(messageForError(failure, '담임 선생님을 배정하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setAssigning(false);
    }
  }, [token, classId, pickedTutorId]);

  if (!director) return null;

  return (
    <AppNavShell items={dashboardNavItems(director.user, navigate, pathname)} onBack={() => navigate('/organization/classes')}>
      <View style={styles.content}>
        {load.status === 'loading' && <LoadingState label="반 정보를 불러오는 중이에요…" />}

        {load.status === 'error' && (
          <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
        )}

        {load.status === 'ready' && (
          <>
            <Text style={styles.title} accessibilityRole="header">{load.classGroup.name}</Text>

            <InviteCodeCard
              reusable
              shortCode={load.classGroup.joinCode}
              link={classInviteLink(load.classGroup.joinCode)}
              shareMessage={classInviteShareMessage(load.classGroup.name)}
            />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>담임 선생님</Text>
              {load.classGroup.tutorId ? (
                <Text style={styles.body}>
                  {load.tutors.find((link) => link.tutorId === load.classGroup.tutorId)?.tutorDisplayName ?? '배정된 선생님'}
                </Text>
              ) : (
                <>
                  <Text style={styles.body}>
                    아직 담임이 없어요. 배정하면 지금까지 명단에 올라온 학생이 그 선생님의 학생이 되고, 이후 수업과 리포트는 선생님 계정에서 이어져요.
                  </Text>
                  {load.tutors.length === 0 ? (
                    <Text style={styles.body}>기관에 소속된 선생님이 없어요. 선생님 메뉴에서 초대해 주세요.</Text>
                  ) : (
                    <>
                      <RadioGroup
                        accessibilityLabel="담임으로 배정할 선생님"
                        value={pickedTutorId}
                        onChange={setPickedTutorId}
                        options={load.tutors.map((link) => ({ value: link.tutorId, label: link.tutorDisplayName }))}
                      />
                      {assignError ? <StatusBanner variant="warning" label={assignError} /> : null}
                      <ActionButton
                        label={assigning ? '배정 중…' : '담임으로 배정'}
                        onPress={onAssign}
                        disabled={!pickedTutorId || assigning}
                      />
                    </>
                  )}
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>학생 {load.students.length}명</Text>
              {load.students.length === 0 ? (
                <Text style={styles.body}>아직 명단에 학생이 없어요. 보호자에게 반 코드를 전달해 보세요.</Text>
              ) : (
                <View style={styles.list}>
                  {load.students.map((student) => (
                    <View key={student.id} style={styles.studentRow}>
                      <View style={styles.studentBody}>
                        <Text style={styles.studentName}>{student.name} · {student.ageBand}</Text>
                        <Text style={styles.studentMeta}>
                          {student.parentDisplayName
                            ? `보호자 ${student.parentDisplayName}${student.parentEmail ? ` · ${student.parentEmail}` : ''}`
                            : '보호자 연결 대기'}
                        </Text>
                        <Text style={styles.studentMeta}>등록: {formatShortDate(student.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- helpers */

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
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
    gap: 14,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
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
  list: { gap: 8 },
  studentRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
    gap: 2,
  },
  studentBody: { gap: 2 },
  studentName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  studentMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
});
