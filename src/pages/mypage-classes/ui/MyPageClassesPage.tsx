import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Modal, Pill, RadioGroup, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { normalizeInviteCode, isValidInviteCode } from '@/shared/lib';
import {
  dashboardNavItems,
  joinExistingClass,
  leaveClass,
  listClassMemberships,
  useAuth,
  type ClassMembershipResponse,
} from '@/entities/auth';
import { useChildren } from '@/entities/child';
import { listParentTutorReports, type TutorReportSummary } from '@/entities/tutor';
import { RosterStudentPicker, rosterSelectionBlocksSubmit, type RosterSelection } from '@/features/class-roster-pick';

type Load<T> = { status: 'loading' } | { status: 'ready'; items: T[] } | { status: 'error'; message: string };

/**
 * 마이페이지 > 수업 연결. 세 가지를 한 화면에 담는다.
 *
 *  1. 아이가 들어가 있는 반 - 반 코드로 아이를 반 학생 명단에 올리고(아이마다 한 번씩), 반에서 뺄 수 있다.
 *  2. 선생님 초대 - 코드나 링크를 넣으면 /tutor-invite/...로 이동해 연결·동의로 이어진다.
 *  3. 연결된 선생님 - 최근 선생님 리포트에서 뽑은 (선생님, 학생) 목록.
 */
export function MyPageClassesPage() {
  const navigate = useNavigate();
  const { state, setSession, refresh } = useAuth();
  const [memberships, setMemberships] = useState<Load<ClassMembershipResponse>>({ status: 'loading' });
  const [reports, setReports] = useState<Load<TutorReportSummary>>({ status: 'loading' });
  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [tutorCodeInput, setTutorCodeInput] = useState('');
  const [tutorCodeError, setTutorCodeError] = useState<string | null>(null);
  const [classCodeInput, setClassCodeInput] = useState('');
  const { children, load: childrenLoad, reload: reloadChildren } = useChildren();
  // 반에 올릴 아이 - 이름·출생연도를 다시 적지 않고 등록한 아이 프로필 중에서 고른다. 한 명뿐이면 그 아이.
  const [pickedChildId, setPickedChildId] = useState<string | null>(null);
  const selectedChild = children.find((child) => child.id === pickedChildId) ?? (children.length === 1 ? children[0] : null);
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
    listParentTutorReports(authToken)
      .then((items) => {
        if (!cancelled) setReports({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        if (!cancelled) setReports({ status: 'error', message: messageForError(error, '연결된 선생님을 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, reloadKey]);

  // 한 선생님이 여러 세션을 진행했어도 (선생님, 학생) 쌍은 한 번만 보여 준다.
  const tutors = useMemo(() => {
    if (reports.status !== 'ready') return [] as { key: string; tutor: string; student: string }[];
    const seen = new Set<string>();
    const unique: { key: string; tutor: string; student: string }[] = [];
    for (const report of reports.items) {
      const key = `${report.tutorDisplayName} ${report.studentName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ key, tutor: report.tutorDisplayName, student: report.studentName });
    }
    return unique;
  }, [reports]);

  function acceptInvite() {
    setInviteError(null);
    const token = extractInviteToken(inviteInput);
    if (!token) {
      setInviteError('초대 링크 또는 토큰을 확인해 주세요.');
      return;
    }
    navigate(`/tutor-invite/${encodeURIComponent(token)}`);
  }

  function goToTutorCode() {
    setTutorCodeError(null);
    const normalized = normalizeInviteCode(tutorCodeInput);
    if (!isValidInviteCode(normalized)) {
      setTutorCodeError('영문·숫자 4-16자리 코드를 입력해 주세요.');
      return;
    }
    navigate(`/tutor-invite/code/${encodeURIComponent(normalized)}`);
  }

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
    try {
      // 아이가 기관 반에 들어가면 기관 이용권이 적용될 수 있어 응답의 사용자 정보(grantsAccess)로 세션을 갱신한다.
      const response = await joinExistingClass(state.token, {
        classCode,
        childId: selectedChild.id,
        rosterStudentId: rosterSelection.kind === 'student' ? rosterSelection.id : undefined,
      });
      setSession(response.token, response.user);
      setClassCodeInput('');
      setPickedChildId(null);
      setClassJoinSuccess(true);
      setReloadKey((n) => n + 1);
    } catch (error: unknown) {
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
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
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
                      {[membership.organizationName, membership.tutorDisplayName ? `${membership.tutorDisplayName} 선생님` : '담임 선생님 배정 전']
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>선생님 연결</Text>
          <Text style={styles.body}>선생님에게 받은 코드를 입력하거나, 초대 링크를 붙여넣어 주세요.</Text>
          <TextField
            label="선생님 초대 코드"
            value={tutorCodeInput}
            onChangeText={(value) => {
              setTutorCodeInput(value);
              if (tutorCodeError) setTutorCodeError(null);
            }}
            placeholder="예: 42QRKM3P"
            autoCapitalize="characters"
            errorText={tutorCodeError ?? undefined}
          />
          <ActionButton label="코드로 확인하기" onPress={goToTutorCode} disabled={tutorCodeInput.trim().length === 0} />
          <View style={styles.divider} />
          <TextField
            label="초대 링크"
            value={inviteInput}
            onChangeText={(value) => {
              setInviteInput(value);
              if (inviteError) setInviteError(null);
            }}
            placeholder="https://... 또는 토큰 문자열"
            errorText={inviteError ?? undefined}
          />
          <ActionButton
            label="링크로 확인하기"
            variant="secondaryFull"
            onPress={acceptInvite}
            disabled={inviteInput.trim().length === 0}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>연결된 수업</Text>
          {reports.status === 'loading' ? (
            <LoadingState compact label="연결된 선생님을 불러오는 중이에요…" />
          ) : reports.status === 'error' ? (
            <ErrorState message={reports.message} onRetry={() => setReloadKey((n) => n + 1)} />
          ) : tutors.length === 0 ? (
            <Text style={styles.body}>아직 선생님과 진행한 수업이 없어요.</Text>
          ) : (
            <View style={styles.list}>
              {tutors.map(({ key, tutor, student }) => (
                <View key={key} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{tutor} 선생님</Text>
                    <Text style={styles.rowSub}>{student}과 함께</Text>
                  </View>
                  <Pill label="연결됨" tone="onCard" />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      <Modal
        visible={leaveTarget !== null}
        accessibilityLabel="반에서 빼기 확인"
        eyebrow="반 연결"
        title={leaveTarget ? `${leaveTarget.studentName}을(를) ${leaveTarget.className}에서 뺄까요?` : ''}
        positiveAction={{ label: '반에서 빼기', onPress: leaveSelectedClass, loading: leaving }}
        negativeAction={{ label: '취소', onPress: () => setLeaveTarget(null), disabled: leaving }}
      >
        <Text style={styles.modalBody}>지난 수업 리포트는 계속 볼 수 있어요. 반 소속으로 받던 이용권은 끊기고, 담임 선생님은 다시 초대하거나 명단에서 지울 수 있어요.</Text>
        {leaveError ? <StatusBanner variant="warning" label={leaveError} /> : null}
      </Modal>
    </AppNavShell>
  );
}

/**
 * 붙여넣은 값에서 선생님 초대 토큰을 뽑는다. 순수 토큰 문자열, "https://.../tutor-invite/<token>"
 * URL, "/tutor-invite/<token>" 경로를 받는다.
 */
function extractInviteToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, 'https://placeholder.local');
    const match = url.pathname.match(/\/tutor-invite\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // URL 파싱 실패 - 아래 정규식으로.
  }
  const pathMatch = trimmed.match(/tutor-invite\/([^/?#\s]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  if (!/\s/.test(trimmed)) return trimmed;
  return null;
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
