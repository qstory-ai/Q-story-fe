import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Pill, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listParentTutorReports, type TutorReportSummary } from '@/entities/tutor';

type ReportLoad = { status: 'loading' } | { status: 'ready'; reports: TutorReportSummary[] } | { status: 'error'; message: string };

/**
 * IA "[4] 마이페이지 > 수업 연결" 화면. 세 가지 항목을 한 화면에 담는다.
 *
 *  1. 이미 연결된 것들 - user.classGroupId(기관)와 최근 튜터 리포트에서 뽑은 튜터 목록.
 *  2. 선생님 초대 링크 붙여넣기 - 링크나 토큰만 남기면 /tutor-invite/{token}으로 이동해
 *     기존 ParentLinkAcceptPage 흐름을 재사용한다.
 *  3. 반 코드 안내 - 반 코드는 지금 회원가입 흐름(joinClass)에서만 받을 수 있어, 이미 로그인된
 *     학부모가 반에 참여하는 별도 엔드포인트는 다음 세션의 BE 작업으로 미룬다.
 */
export function MyPageClassesPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [reports, setReports] = useState<ReportLoad>({ status: 'loading' });
  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    listParentTutorReports(state.token)
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
  }, [state]);

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

  function goToCode() {
    setCodeError(null);
    const normalized = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(normalized)) {
      setCodeError('영문·숫자 4-16자리 코드를 입력해 주세요.');
      return;
    }
    navigate(`/tutor-invite/code/${encodeURIComponent(normalized)}`);
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
            </>
          ) : (
            <>
              <Text style={styles.body}>아직 참여 중인 기관이 없어요.</Text>
              <StatusBanner
                variant="warning"
                label={'반 코드는 회원가입할 때만 사용할 수 있어요. 이미 계정이 있다면 관리자에게 초대 링크를 요청해 주세요.'}
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>선생님 연결</Text>
          <Text style={styles.body}>선생님에게 받은 코드를 입력하거나, 초대 링크를 붙여넣어 주세요.</Text>
          <TextField
            label="초대 코드"
            value={codeInput}
            onChangeText={(value) => {
              setCodeInput(value);
              if (codeError) setCodeError(null);
            }}
            placeholder="예: 42QRKM3P"
            autoCapitalize="characters"
            errorText={codeError ?? undefined}
          />
          <ActionButton label="코드로 확인하기" onPress={goToCode} disabled={codeInput.trim().length === 0} />
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
            <Text style={styles.body}>불러오는 중이에요…</Text>
          ) : reports.status === 'error' ? (
            <Text style={[styles.body, styles.errorText]}>{reports.message}</Text>
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
  errorText: {
    color: storybookTheme.color.error,
  },
});
