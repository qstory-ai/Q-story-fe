import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, AppNavShell, Icon, Modal, StatusBanner, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  createTutorInvite,
  deleteTutorStudent,
  getTutorStudent,
  listStudentLessonPlans,
  removeTutorLessonPlan,
  updateTutorStudent,
  type TutorInvite,
  type TutorLessonPlan,
  type TutorStudent,
} from '@/entities/tutor';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { InviteCodeCard } from '@/features/invite-issue';

type PlansLoad =
  | { status: 'loading' }
  | { status: 'ready'; plans: TutorLessonPlan[]; storyById: Record<string, StoryCatalogEntry> }
  | { status: 'error'; message: string };

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
  const [plansLoad, setPlansLoad] = useState<PlansLoad>({ status: 'loading' });
  const [removingPlanId, setRemovingPlanId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        const message = messageForError(failure, '학생을 불러오지 못했어요.');
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
      const message = messageForError(failure, '메모를 저장하지 못했어요.');
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [state, studentId, requestKey, classType, prepNote]);

  // 이 학생을 위해 담아둔 이야기(TutorLessonPlan) 목록 + 카탈로그를 병렬로 fetch. plan은 storyId만
  // 갖고 있어 카탈로그와 join해야 제목/커버를 표시할 수 있다.
  useEffect(() => {
    if (state.status !== 'authenticated' || !studentId) return;
    let cancelled = false;
    Promise.all([listStudentLessonPlans(state.token, studentId), listStories()])
      .then(([plans, stories]) => {
        if (cancelled) return;
        const storyById = Object.fromEntries(stories.map((s) => [s.storyId, s]));
        setPlansLoad({ status: 'ready', plans, storyById });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setPlansLoad({
          status: 'error',
          message: messageForError(failure, '담아둔 이야기를 불러오지 못했어요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state, studentId]);

  const handleRemovePlan = useCallback(async (planId: string) => {
    if (state.status !== 'authenticated') return;
    // 낙관적 제거 - 목록에서 즉시 빼고, 실패해도 그대로 둔다(다음 방문 시 재조회로 원복 가능).
    setRemovingPlanId(planId);
    setPlansLoad((prev) => {
      if (prev.status !== 'ready') return prev;
      return { ...prev, plans: prev.plans.filter((p) => p.id !== planId) };
    });
    try {
      await removeTutorLessonPlan(state.token, planId);
    } catch {
      // 무시 - 사용자는 성공한 것처럼 보이고, 실제 실패는 다음 조회에서 드러난다.
    } finally {
      setRemovingPlanId(null);
    }
  }, [state]);

  const handleDeleteStudent = useCallback(async () => {
    if (state.status !== 'authenticated' || !studentId) return;
    setDeleteInFlight(true);
    setDeleteError(null);
    try {
      await deleteTutorStudent(state.token, studentId);
      // 성공 - 학생 목록으로 replace 이동 (뒤로가기로 삭제된 학생 상세로 돌아가지 못하게).
      navigate('/tutor/students', { replace: true });
    } catch (failure: unknown) {
      setDeleteError(messageForError(failure, '학생을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setDeleteInFlight(false);
      // 실패해도 모달은 열어두어 사용자가 재시도하거나 취소할 수 있게 한다.
    }
  }, [state, studentId, navigate]);

  const handleIssueInvite = useCallback(async () => {
    if (state.status !== 'authenticated' || !studentId) return;
    setIssuing(true);
    setIssueError(null);
    try {
      const invite = await createTutorInvite(state.token, studentId, { method: 'LINK' });
      setIssuedInvite(invite);
    } catch (failure: unknown) {
      const message = messageForError(failure, '초대를 만들지 못했어요.');
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

            <View style={styles.card}>
              <View style={styles.planHeaderRow}>
                <Text style={styles.sectionTitle}>이 학생을 위한 이야기</Text>
                <ActionButton
                  variant="secondary"
                  label="이야기 담기"
                  onPress={() => navigate('/tutor/library')}
                />
              </View>
              {plansLoad.status === 'loading' ? (
                <Text style={styles.body}>담아둔 이야기를 불러오는 중이에요…</Text>
              ) : plansLoad.status === 'error' ? (
                <StatusBanner variant="warning" label={plansLoad.message} />
              ) : plansLoad.plans.length === 0 ? (
                <Text style={styles.body}>
                  아직 담아둔 이야기가 없어요. 서재에서 마음에 드는 작품을 골라 “수업에 사용하기”로 담아 보세요.
                </Text>
              ) : (
                <View style={styles.planList}>
                  {plansLoad.plans.map((plan) => {
                    const story = plansLoad.storyById[plan.storyId];
                    return (
                      <View key={plan.id} style={styles.planRow}>
                        <View style={styles.planBody}>
                          <Text style={styles.planTitle} numberOfLines={1}>
                            {story?.title ?? '삭제됐거나 회수된 이야기'}
                          </Text>
                          {story?.category ? (
                            <Text style={styles.planMeta}>{story.category}</Text>
                          ) : null}
                        </View>
                        <View style={styles.planActions}>
                          {story ? (
                            <ActionButton
                              variant="secondary"
                              label="이야기 시작"
                              onPress={() =>
                                navigate(`/stories/${plan.storyId}/play?tutorStudentId=${effective.student.id}`)
                              }
                            />
                          ) : null}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${story?.title ?? '이야기'} 목록에서 빼기`}
                            onPress={() => handleRemovePlan(plan.id)}
                            disabled={removingPlanId === plan.id}
                            style={({ pressed }) => [styles.planRemove, pressed && styles.planRemovePressed]}
                          >
                            <Icon name="close" size={14} color={storybookTheme.color.onCardMuted} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
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
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
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
  // 이 학생을 위한 이야기 섹션
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    flexWrap: 'wrap',
  },
  planList: { gap: storybookTheme.spacing.sm },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  planBody: { flex: 1, gap: 2 },
  planTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  planMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  planActions: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.xs },
  planRemove: {
    width: 28,
    height: 28,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.pillBackground,
  },
  planRemovePressed: { opacity: 0.7 },
  // 학생 삭제 링크 - 파괴적 액션이라 카드 밖 얇은 하단 링크. 확인 모달이 실제 방어막.
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
