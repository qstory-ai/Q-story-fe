import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Modal, StatusBanner, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { formatStudentAge } from '@/entities/child';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { deleteTutorStudent, getTutorStudent, updateTutorStudent, type TutorStudent } from '@/entities/tutor';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; student: TutorStudent }
  | { requestKey: string; status: 'error'; message: string };

/**
 * IA "[3] 수업 상세 > 학생 상세" 화면. 기본 정보(이름/연령대/반) + 메모 편집 +
 * 보호자 연결 상태 뱃지(연결됨 녹색 / 대기 빨간색).
 *
 * <p>선생님은 반 단위로만 일한다 - 학생은 부모님이 반 초대 링크로 아이를 연결할 때 명단에 올라오므로,
 * 여기서 반을 바꾸거나 학생별 부모 초대를 보내지 않는다. 메모만 편집한다.
 *
 * <p>학생 이름/연령대는 정체성이라 편집을 지원하지 않는다 - BE UpdateTutorStudentRequest도
 * 그렇게 정해져 있다. 필요해지면 별도 필드로 열어 준다.
 */
export function TutorStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${studentId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [classType, setClassType] = useState('');
  const [prepNote, setPrepNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlag, setSavedFlag] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (!token || !studentId) return;
    let cancelled = false;
    getTutorStudent(token, studentId)
      .then((student) => {
        if (cancelled) return;
        setLoad({ requestKey, status: 'ready', student });
        setClassType(student.classType ?? '');
        setPrepNote(student.prepNote ?? '');
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = messageForError(failure, '학생을 불러오지 못했어요.');
        setLoad({ requestKey, status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, studentId, requestKey]);

  const handleSave = useCallback(async () => {
    if (!token || !studentId) return;
    setSaving(true);
    setSaveError(null);
    setSavedFlag(false);
    try {
      // 메모만 보낸다 - 반 소속은 부모님이 반 초대 링크로 연결할 때 정해지고 여기서 바꾸지 않는다.
      const updated = await updateTutorStudent(token, studentId, {
        classType: classType.trim(),
        prepNote: prepNote.trim(),
      });
      setLoad({ requestKey, status: 'ready', student: updated });
      setSavedFlag(true);
    } catch (failure: unknown) {
      const message = messageForError(failure, '메모를 저장하지 못했어요.');
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [token, studentId, requestKey, classType, prepNote]);

  const handleDeleteStudent = useCallback(async () => {
    if (!token || !studentId) return;
    setDeleteInFlight(true);
    setDeleteError(null);
    try {
      await deleteTutorStudent(token, studentId);
      // 성공 - 학생 목록으로 replace 이동 (뒤로가기로 삭제된 학생 상세로 돌아가지 못하게).
      navigate('/tutor/students', { replace: true });
    } catch (failure: unknown) {
      setDeleteError(messageForError(failure, '학생을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setDeleteInFlight(false);
      // 실패해도 모달은 열어두어 사용자가 재시도하거나 취소할 수 있게 한다.
    }
  }, [token, studentId, navigate]);

  if (state.status !== 'authenticated') return null;

  const effective = load.requestKey === requestKey ? load : { requestKey, status: 'loading' as const };

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={() => navigate('/tutor/students')}>
      <View style={styles.content}>
        {effective.status === 'loading' && <LoadingState label="학생 정보를 불러오는 중이에요…" />}

        {effective.status === 'error' && (
          <ErrorState message={effective.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}

        {effective.status === 'ready' && (
          <>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.headerText}>
                  <Text style={styles.title} accessibilityRole="header">{effective.student.name}</Text>
                  <Text style={styles.subtitle}>{formatStudentAge(effective.student)}</Text>
                </View>
                <ParentConnectionBadge status={effective.student.status} />
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>반</Text>
                <Text style={styles.metaValue}>{effective.student.classGroupName ?? '반 없음'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>등록일</Text>
                <Text style={styles.metaValue}>{formatDate(effective.student.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>메모</Text>
              <TextField
                label="수업 방식 메모"
                value={classType}
                onChangeText={setClassType}
                placeholder="예: 1:1 방문 · 화요일 오후"
              />
              <TextareaField
                label="특이사항 메모"
                value={prepNote}
                onChangeText={setPrepNote}
                placeholder="예: 새 인물이 나오면 잠깐 이야기를 멈추고 아이 반응을 기다려 주세요."
              />
              {savedFlag ? <StatusBanner label="저장했어요." /> : null}
              {saveError ? <StatusBanner variant="warning" label={saveError} /> : null}
              <ActionButton label={saving ? '저장 중…' : '저장'} onPress={handleSave} loading={saving} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>보호자 연결</Text>
              {effective.student.status === 'CONFIRMED' ? (
                <Text style={styles.body}>
                  보호자와 연결이 완료됐어요. 이 학생과 진행한 수업 리포트는 보호자 앱에 자동으로 전달돼요.
                </Text>
              ) : (
                <Text style={styles.body}>
                  아직 보호자 연결이 되지 않았어요. 반 초대 링크로 부모님이 아이를 연결하면 자동으로 연결돼요.
                </Text>
              )}
            </View>

            {/* 학생 삭제 - 마이너 액션이라 카드 밖 얇은 링크로 둔다. 확인 모달이 방어막. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${effective.student.name} 학생 삭제`}
              onPress={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              style={styles.deleteLink}
            >
              <Text style={styles.deleteLinkText}>학생 삭제</Text>
            </Pressable>
          </>
        )}
      </View>

      <Modal
        visible={deleteOpen}
        accessibilityLabel="학생 삭제 확인"
        title={effective.status === 'ready' ? `${effective.student.name} 학생을 지울까요?` : '학생 삭제'}
        positiveAction={{
          label: deleteInFlight ? '삭제 중…' : '삭제',
          onPress: handleDeleteStudent,
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
          연결된 초대·일정·수업 계획도 함께 사라져요. 이미 저장된 리포트는 남지만
          "이 학생과 진행한 세션"이라는 표시는 잃어요.
        </Text>
        {deleteError ? <Text style={styles.dialogError}>{deleteError}</Text> : null}
      </Modal>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- helpers */

function ParentConnectionBadge({ status }: { status: TutorStudent['status'] }) {
  const label = status === 'CONFIRMED' ? '연결됨' : '보호자 연결 대기';
  return (
    <View style={[styles.badge, status === 'CONFIRMED' ? styles.badgeConfirmed : styles.badgePending]}>
      <Text style={[styles.badgeText, status === 'CONFIRMED' ? styles.badgeTextConfirmed : styles.badgeTextPending]}>
        {label}
      </Text>
    </View>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

function formatDate(iso: string) {
  return DATE_FORMAT.format(new Date(iso));
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
  headerText: { flex: 1, gap: 2 },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  metaLabel: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  metaValue: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardBody,
    fontWeight: storybookTheme.type.weight.semibold,
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
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
  },
  badgeConfirmed: {
    borderColor: storybookTheme.semantic.positive.border,
    backgroundColor: storybookTheme.semantic.positive.background,
  },
  badgePending: {
    borderColor: storybookTheme.semantic.danger.border,
    backgroundColor: storybookTheme.semantic.danger.background,
  },
  badgeText: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 0.3,
  },
  badgeTextConfirmed: { color: storybookTheme.semantic.positive.text },
  badgeTextPending: { color: storybookTheme.semantic.danger.text },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: storybookTheme.spacing.sm,
    paddingHorizontal: storybookTheme.spacing.md,
    marginTop: storybookTheme.spacing.sm,
  },
  deleteLinkText: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.error,
    textDecorationLine: 'underline',
  },
  dialogBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
  dialogError: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
    marginTop: storybookTheme.spacing.sm,
  },
});
