import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  createTutorInvite,
  getTutorStudent,
  updateTutorStudent,
  type TutorInvite,
  type TutorStudent,
} from '@/entities/tutor';
import { InviteCodeCard } from '@/features/invite-issue';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; student: TutorStudent }
  | { requestKey: string; status: 'error'; message: string };

/**
 * IA "[3] 수업 상세 > 학생 상세" 화면. 기본 정보(이름/연령대/수업 형태) + 메모 편집 +
 * 보호자 연결 상태 뱃지(연결됨 녹색 / 대기 빨간색) + 부모 초대 코드 발급 링크.
 *
 * <p>학생 이름/연령대는 정체성이라 편집을 지원하지 않는다 - BE UpdateTutorStudentRequest도
 * 그렇게 정해져 있다. 필요해지면 별도 필드로 열어 준다.
 */
export function TutorStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const requestKey = studentId ?? '';
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [classType, setClassType] = useState('');
  const [prepNote, setPrepNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlag, setSavedFlag] = useState(false);
  const [issuedInvite, setIssuedInvite] = useState<TutorInvite | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !studentId) return;
    let cancelled = false;
    getTutorStudent(state.token, studentId)
      .then((student) => {
        if (cancelled) return;
        setLoad({ requestKey, status: 'ready', student });
        setClassType(student.classType ?? '');
        setPrepNote(student.prepNote ?? '');
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = failure instanceof Error ? failure.message : '학생을 불러오지 못했어요.';
        setLoad({ requestKey, status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [state, studentId, requestKey]);

  const handleSave = useCallback(async () => {
    if (state.status !== 'authenticated' || !studentId) return;
    setSaving(true);
    setSaveError(null);
    setSavedFlag(false);
    try {
      const updated = await updateTutorStudent(state.token, studentId, {
        classType: classType.trim(),
        prepNote: prepNote.trim(),
      });
      setLoad({ requestKey, status: 'ready', student: updated });
      setSavedFlag(true);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : '메모를 저장하지 못했어요.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [state, studentId, requestKey, classType, prepNote]);

  const handleIssueInvite = useCallback(async () => {
    if (state.status !== 'authenticated' || !studentId) return;
    setIssuing(true);
    setIssueError(null);
    try {
      const invite = await createTutorInvite(state.token, studentId, { method: 'LINK' });
      setIssuedInvite(invite);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : '초대를 만들지 못했어요.';
      setIssueError(message);
    } finally {
      setIssuing(false);
    }
  }, [state, studentId]);

  if (state.status !== 'authenticated') return null;

  const effective = load.requestKey === requestKey ? load : { requestKey, status: 'loading' as const };
  const originBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'classes')} onBack={() => navigate('/tutor/students')}>
      <View style={styles.content}>
        {effective.status === 'loading' && (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
        )}

        {effective.status === 'error' && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{effective.message}</Text>
            <ActionButton variant="secondary" label="학생 목록으로" onPress={() => navigate('/tutor/students')} />
          </View>
        )}

        {effective.status === 'ready' && (
          <>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.headerText}>
                  <Text style={styles.title} accessibilityRole="header">{effective.student.name}</Text>
                  <Text style={styles.subtitle}>{effective.student.ageBand}</Text>
                </View>
                <ParentConnectionBadge status={effective.student.status} />
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>등록일</Text>
                <Text style={styles.metaValue}>{formatDate(effective.student.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>메모 · 특이사항</Text>
              <TextField
                label="수업 형태"
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
              <ActionButton label={saving ? '저장 중…' : '메모 저장'} onPress={handleSave} loading={saving} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>보호자 연결</Text>
              {effective.student.status === 'CONFIRMED' ? (
                <Text style={styles.body}>
                  보호자와 연결이 완료됐어요. 이 학생과 진행한 수업 리포트는 보호자 앱에 자동으로 전달돼요.
                </Text>
              ) : (
                <>
                  <Text style={styles.body}>
                    아직 보호자 연결이 되지 않았어요. 초대 코드나 링크를 발급해 보호자에게 전달해 주세요.
                  </Text>
                  <ActionButton
                    label={issuing ? '초대 만드는 중…' : '부모 초대 코드 발급'}
                    onPress={handleIssueInvite}
                    disabled={issuing}
                  />
                  {issueError ? <StatusBanner variant="warning" label={issueError} /> : null}
                  {issuedInvite ? (
                    <InviteCodeCard
                      shortCode={issuedInvite.shortCode}
                      link={`${originBase}/tutor-invite/${issuedInvite.token}`}
                      expiresLabel={formatDate(issuedInvite.expiresAt)}
                      onDismiss={() => setIssuedInvite(null)}
                    />
                  ) : null}
                </>
              )}
            </View>
          </>
        )}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- helpers */

function ParentConnectionBadge({ status }: { status: TutorStudent['status'] }) {
  const label = status === 'CONFIRMED' ? '연결됨' : '연결 안 됨';
  return (
    <View style={[styles.badge, status === 'CONFIRMED' ? styles.badgeConfirmed : styles.badgePending]}>
      <Text style={[styles.badgeText, status === 'CONFIRMED' ? styles.badgeTextConfirmed : styles.badgeTextPending]}>
        {label}
      </Text>
    </View>
  );
}
function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
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
});
