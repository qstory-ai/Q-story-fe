import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Modal, RadioGroup, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { normalizeInviteCode, isValidInviteCode, withParticle, teacherTitle } from '@/shared/lib';
import { betaErrorCode, trackBetaEvent } from '@/entities/analytics';
import {
  dashboardNavItems,
  joinExistingClass,
  leaveClass,
  listClassMemberships,
  useAuth,
  type ClassMembershipResponse,
} from '@/entities/auth';
import { useChildren } from '@/entities/child';
import { RosterStudentPicker, rosterSelectionBlocksSubmit, type RosterSelection } from '@/features/class-roster-pick';

type Load<T> = { status: 'loading' } | { status: 'ready'; items: T[] } | { status: 'error'; message: string };

/**
 * 마이페이지 > 수업 연결. 아이가 들어가 있는 반을 보고, 반 코드로 아이를 반 학생 명단에 올리거나
 * (아이마다 한 번씩) 반에서 뺀다.
 *
 * <p>선생님은 반 단위로만 일한다(1:1 과외도 아이 한 명짜리 반) - 선생님과의 연결은 언제나 반 코드로
 * 이뤄지므로 학생별 선생님 초대 코드 입력란은 두지 않는다. 담임 선생님 이름은 반 목록에 함께 보인다.
 */
export function MyPageClassesPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, setSession, refresh } = useAuth();
  const [memberships, setMemberships] = useState<Load<ClassMembershipResponse>>({ status: 'loading' });
  const [classCodeInput, setClassCodeInput] = useState('');
  const { children, selectedChild: globalSelectedChild, load: childrenLoad, reload: reloadChildren } = useChildren();
  // 반에 올릴 아이 - 이름·출생연도를 다시 적지 않고 등록한 아이 프로필 중에서 고른다. 고르기 전엔 홈·리포트와
  // 같은 전역 선택 아이가 기본값이다.
  const [pickedChildId, setPickedChildId] = useState<string | null>(null);
  const selectedChild = children.find((child) => child.id === pickedChildId) ?? globalSelectedChild;
  const [classCodeError, setClassCodeError] = useState<string | null>(null);
  const [rosterSelection, setRosterSelection] = useState<RosterSelection>({ kind: 'not-needed' });
  const [classJoinSuccess, setClassJoinSuccess] = useState(false);
  const [joiningClass, setJoiningClass] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<ClassMembershipResponse | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  // 토큰 문자열로 좁혀서 실제로 인증이 바뀔 때만 다시 불러온다(state 객체 identity가 바뀌어도 재조회하지 않는다).
  const authToken = state.status === 'authenticated' ? state.token : null;
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    listClassMemberships(authToken)
      .then((items) => {
        if (!cancelled) setMemberships({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        if (!cancelled) setMemberships({ status: 'error', message: messageForError(error, '아이가 들어간 반을 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, reloadKey]);

  async function addChildToClass() {
    if (state.status !== 'authenticated') return;
    setClassCodeError(null);
    setClassJoinSuccess(false);
    const classCode = normalizeInviteCode(classCodeInput);
    if (!isValidInviteCode(classCode)) {
      setClassCodeError('영문·숫자 4-16자리 반 코드를 입력해 주세요.');
      return;
    }
    if (!selectedChild) {
      setClassCodeError('반에 올릴 아이를 골라 주세요.');
      return;
    }
    setJoiningClass(true);
    void trackBetaEvent('class_join', { step: 'attempt', via: 'mypage' });
    try {
      // 아이가 기관 반에 들어가면 기관 이용권이 적용될 수 있어 응답의 사용자 정보(grantsAccess)로 세션을 갱신한다.
      const response = await joinExistingClass(state.token, {
        classCode,
        childId: selectedChild.id,
        rosterStudentId: rosterSelection.kind === 'student' ? rosterSelection.id : undefined,
      });
      setSession(response.token, response.user);
      void trackBetaEvent('class_join', { step: 'success', via: 'mypage' });
      setClassCodeInput('');
      setPickedChildId(null);
      setClassJoinSuccess(true);
      setReloadKey((n) => n + 1);
    } catch (error: unknown) {
      void trackBetaEvent('class_join', { step: 'error', via: 'mypage', error_code: betaErrorCode(error) });
      setClassCodeError(messageForError(error, '반에 연결하지 못했어요. 반 코드를 다시 확인해 주세요.'));
    } finally {
      setJoiningClass(false);
    }
  }

  async function leaveSelectedClass() {
    if (state.status !== 'authenticated' || !leaveTarget) return;
    setLeaveError(null);
    setLeaving(true);
    try {
      await leaveClass(state.token, leaveTarget.studentId);
      // 반에서 빠지면 기관 이용권이 사라질 수 있다 - 서버의 grantsAccess를 다시 읽는다.
      await refresh();
      setLeaveTarget(null);
      setReloadKey((n) => n + 1);
    } catch (error: unknown) {
      setLeaveError(messageForError(error, '반에서 빼지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setLeaving(false);
    }
  }

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">수업 연결</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>우리 아이가 들어간 반</Text>
          {memberships.status === 'loading' ? (
            <LoadingState compact label="반 목록을 불러오는 중이에요…" />
          ) : memberships.status === 'error' ? (
            <ErrorState message={memberships.message} onRetry={() => setReloadKey((n) => n + 1)} />
          ) : memberships.items.length === 0 ? (
            <Text style={styles.body}>아직 들어간 반이 없어요. 기관이나 선생님께 받은 반 코드로 아이를 올려 주세요.</Text>
          ) : (
            <View style={styles.list}>
              {memberships.items.map((membership) => (
                <View key={membership.studentId} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{membership.studentName} · {membership.className}</Text>
                    <Text style={styles.rowSub}>
                      {[membership.organizationName, membership.tutorDisplayName ? `${teacherTitle(membership.tutorDisplayName)}` : '담임 선생님 배정 전']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <ActionButton label="빼기" variant="outline" size="sm" onPress={() => setLeaveTarget(membership)} />
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />
          <Text style={styles.body}>반 코드를 넣고 등록한 아이 중 반에 올릴 아이를 골라 주세요. 아이가 여러 명이면 아이마다 한 번씩 올려 주세요.</Text>
          <TextField
            label="반 코드"
            value={classCodeInput}
            onChangeText={(value) => {
              setClassCodeInput(value);
              if (classCodeError) setClassCodeError(null);
              if (classJoinSuccess) setClassJoinSuccess(false);
            }}
            placeholder="예: 7P3KMQ8D"
            autoCapitalize="characters"
            errorText={classCodeError ?? undefined}
          />
          {childrenLoad.status === 'loading' ? (
            <LoadingState compact label="아이 목록을 불러오는 중이에요…" />
          ) : childrenLoad.status === 'error' ? (
            <ErrorState message="아이 목록을 불러오지 못했어요." onRetry={() => void reloadChildren()} />
          ) : children.length === 0 ? (
            <View style={styles.list}>
              <Text style={styles.body}>반에 올릴 아이 프로필이 아직 없어요. 아이를 먼저 등록해 주세요.</Text>
              <ActionButton label="아이 등록하러 가기" variant="outline" size="sm" onPress={() => navigate('/mypage/children')} />
            </View>
          ) : (
            <RadioGroup
              accessibilityLabel="반에 올릴 아이"
              value={selectedChild?.id ?? null}
              onChange={setPickedChildId}
              options={children.map((child) => ({
                value: child.id,
                label: child.name,
                description: child.birthYear ? `${child.birthYear}년생` : undefined,
              }))}
            />
          )}
          <RosterStudentPicker
            classCode={normalizeInviteCode(classCodeInput)}
            childName={selectedChild?.name ?? ''}
            onChange={setRosterSelection}
          />
          <ActionButton
            label="반에 올리기"
            onPress={addChildToClass}
            loading={joiningClass}
            disabled={
              classCodeInput.trim().length === 0 || !selectedChild || rosterSelectionBlocksSubmit(rosterSelection) || joiningClass
            }
          />
          {classJoinSuccess ? <StatusBanner label="반에 올렸어요." /> : null}
        </View>
      </View>
      <Modal
        visible={leaveTarget !== null}
        accessibilityLabel="반에서 빼기 확인"
        eyebrow="반 연결"
        title={leaveTarget ? `${withParticle(leaveTarget.studentName, '을/를')} ${leaveTarget.className}에서 뺄까요?` : ''}
        positiveAction={{ label: '반에서 빼기', onPress: leaveSelectedClass, loading: leaving }}
        negativeAction={{ label: '취소', onPress: () => setLeaveTarget(null), disabled: leaving }}
      >
        <Text style={styles.modalBody}>지난 수업 리포트는 계속 볼 수 있어요. 반 소속으로 받던 이용권은 끊기고, 담임 선생님은 다시 초대하거나 명단에서 지울 수 있어요.</Text>
        {leaveError ? <StatusBanner variant="warning" label={leaveError} /> : null}
      </Modal>
    </AppNavShell>
  );
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
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  modalBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  divider: {
    height: 1,
    marginVertical: 8,
    backgroundColor: storybookTheme.color.pillBorder,
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  rowSub: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
});
