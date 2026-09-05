import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Modal, Pill, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { normalizeInviteCode, isValidInviteCode } from '@/shared/lib';
import { dashboardNavItems, joinExistingClass, leaveClassMembership, useAuth } from '@/entities/auth';
import { listParentTutorReports, type TutorReportSummary } from '@/entities/tutor';

type ReportLoad = { status: 'loading' } | { status: 'ready'; reports: TutorReportSummary[] } | { status: 'error'; message: string };

/**
 * IA "[4] 마이페이지 > 수업 연결" 화면. 세 가지 항목을 한 화면에 담는다.
 *
 *  1. 이미 연결된 것들 - user.classGroupId(기관)와 최근 튜터 리포트에서 뽑은 튜터 목록.
 *  2. 선생님 초대 링크 붙여넣기 - 링크나 토큰만 남기면 /tutor-invite/{token}으로 이동해
 *     기존 ParentLinkAcceptPage 흐름을 재사용한다.
 *  3. 기관 반 연결 - 독립 학부모도 반 코드를 입력하면 현재 계정을 그대로 연결한다. 새 계정을
 *     만들지 않고 JWT를 갱신하므로, 기존 아이·가정 이용 기록도 그대로 보존된다.
 */
export function MyPageClassesPage() {
  const navigate = useNavigate();
  const { state, setSession } = useAuth();
  const [reports, setReports] = useState<ReportLoad>({ status: 'loading' });
  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [tutorCodeInput, setTutorCodeInput] = useState('');
  const [tutorCodeError, setTutorCodeError] = useState<string | null>(null);
  const [classCodeInput, setClassCodeInput] = useState('');
  const [classCodeError, setClassCodeError] = useState<string | null>(null);
  const [classJoinSuccess, setClassJoinSuccess] = useState(false);
  const [joiningClass, setJoiningClass] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leavingClass, setLeavingClass] = useState(false);
  const [classLeaveSuccess, setClassLeaveSuccess] = useState(false);
  const [classLeaveError, setClassLeaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  // state.token만 있으면 충분한 요청인데 [state, reloadKey]로 의존하면, 이 화면 안에서
  // setSession()을 부르는 다른 액션(반 가입 등)이 state 객체 identity만 바꿔도 무관한 재조회가
  // 한 번 더 나갔다 - token 문자열로 좁혀서 실제로 인증이 바뀔 때만 다시 부른다.
  const authToken = state.status === 'authenticated' ? state.token : null;
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    listParentTutorReports(authToken)
      .then((next) => {
        if (!cancelled) setReports({ status: 'ready', reports: next });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = messageForError(error, '연결된 선생님을 불러오지 못했어요.');
        setReports({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, reloadKey]);

  // 튜터 리포트에서 (튜터명, 학생명) 페어를 뽑아 dedupe - 한 튜터가 여러 세션을 진행했어도
  // "연결된 선생님" 리스트에는 한 번만 보여야 한다. 학생 이름별로도 구분해 두 아이가 같은
  // 선생님에게 배우는 경우도 표현.
  const tutors = useMemo(() => {
    if (reports.status !== 'ready') return [] as { key: string; tutor: string; student: string }[];
    const seen = new Set<string>();
    const dedup: { key: string; tutor: string; student: string }[] = [];
    for (const report of reports.reports) {
      const key = `${report.tutorDisplayName} ${report.studentName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push({ key, tutor: report.tutorDisplayName, student: report.studentName });
    }
    return dedup;
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

  async function joinClassWithCode() {
    if (state.status !== 'authenticated') return;
    setClassCodeError(null);
    setClassJoinSuccess(false);
    const classCode = normalizeInviteCode(classCodeInput);
    if (!isValidInviteCode(classCode)) {
      setClassCodeError('기관에서 받은 영문·숫자 4-16자리 반 코드를 입력해 주세요.');
      return;
    }
    setJoiningClass(true);
    try {
      const response = await joinExistingClass(state.token, { classCode });
      setSession(response.token, response.user);
      setClassCodeInput('');
      setClassJoinSuccess(true);
    } catch (error: unknown) {
      setClassCodeError(messageForError(error, '기관 반에 연결하지 못했어요. 반 코드를 다시 확인해 주세요.'));
    } finally {
      setJoiningClass(false);
    }
  }

  async function leaveCurrentClass() {
    if (state.status !== 'authenticated') return;
    setClassLeaveError(null);
    setLeavingClass(true);
    try {
      const response = await leaveClassMembership(state.token);
      setSession(response.token, response.user);
      setLeaveModalOpen(false);
      setClassLeaveSuccess(true);
    } catch (error: unknown) {
      setClassLeaveError(messageForError(error, '기관 반 연결을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setLeavingClass(false);
    }
  }

  if (state.status !== 'authenticated') return null;

  const isInClass = Boolean(state.user.classId);

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">수업 연결</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>기관 연결</Text>
          {isInClass ? (
            <>
              <Text style={styles.body}>이미 기관 반에 참여 중이에요.</Text>
              <View style={styles.pillRow}>
                <Pill label="반 참여 중" />
              </View>
              {classLeaveError ? <StatusBanner variant="warning" label={classLeaveError} /> : null}
              <ActionButton label="기관 반 연결 해제" variant="outline" onPress={() => setLeaveModalOpen(true)} />
              <Text style={styles.hint}>해제한 뒤 새 반 코드를 입력하면 같은 계정으로 반을 변경할 수 있어요.</Text>
            </>
          ) : (
            <>
              {classLeaveSuccess ? <StatusBanner label="기관 반 연결이 해제되었어요. 새 반 코드로 다시 연결할 수 있어요." /> : null}
              <Text style={styles.body}>기관에서 받은 반 코드로 현재 계정을 연결할 수 있어요.</Text>
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
              <ActionButton
                label="기관 반에 연결하기"
                onPress={joinClassWithCode}
                loading={joiningClass}
                disabled={classCodeInput.trim().length === 0 || joiningClass}
              />
            </>
          )}
          {/* setSession()과 setClassJoinSuccess(true)가 같은 배치에서 함께 커밋되므로 이 시점엔
              항상 isInClass 분기가 렌더되지만, 그 순서 관계에 기대지 않도록 분기 밖에 한 번만 둔다. */}
          {classJoinSuccess ? <StatusBanner label="기관 반에 연결했어요." /> : null}
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
            <Text style={styles.body}>아직 연결된 선생님이 없어요. 위 초대 링크를 붙여넣어 시작해 보세요.</Text>
          ) : (
            <View style={styles.tutorList}>
              {tutors.map(({ key, tutor, student }) => (
                <View key={key} style={styles.tutorRow}>
                  <View style={styles.tutorInfo}>
                    <Text style={styles.tutorName}>{tutor} 선생님</Text>
                    <Text style={styles.tutorSub}>{student}과 함께</Text>
                  </View>
                  <Pill label="연결됨" tone="onCard" />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      <Modal
        visible={leaveModalOpen}
        accessibilityLabel="기관 반 연결 해제 확인"
        eyebrow="기관 반 연결"
        title="현재 반 연결을 해제할까요?"
        positiveAction={{ label: '연결 해제', onPress: leaveCurrentClass, loading: leavingClass }}
        negativeAction={{ label: '취소', onPress: () => setLeaveModalOpen(false), disabled: leavingClass }}
      >
        <Text style={styles.modalBody}>기관 수업 기록은 보존되지만, 이 계정은 더 이상 현재 기관의 이용권을 사용하지 않아요.</Text>
      </Modal>
    </AppNavShell>
  );
}

/**
 * 사용자가 붙여넣은 값에서 tutor invite 토큰을 뽑아낸다. 지원 형태:
 *  - 순수 토큰 문자열 (whitespace만 트림)
 *  - "https://.../tutor-invite/<token>" 형태의 절대/상대 URL
 *  - "/tutor-invite/<token>" 형태의 경로
 * URL 파싱은 URL 생성자에 기대는데, 실패해도 정규식 fallback으로 마지막 세그먼트를 뽑는다.
 */
function extractInviteToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // URL 형태면 마지막 세그먼트를 뽑는다.
  try {
    const url = new URL(trimmed, 'https://placeholder.local');
    const match = url.pathname.match(/\/tutor-invite\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // URL 파싱 실패 - 아래 정규식 fallback으로.
  }
  const pathMatch = trimmed.match(/tutor-invite\/([^/?#\s]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  // 순수 토큰 - 공백 없는 문자열이면 그대로 반환.
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
  hint: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  modalBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  divider: {
    height: 1,
    marginVertical: 8,
    backgroundColor: storybookTheme.color.pillBorder,
  },
  tutorList: { gap: 8 },
  tutorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  tutorInfo: { gap: 2 },
  tutorName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  tutorSub: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
});
