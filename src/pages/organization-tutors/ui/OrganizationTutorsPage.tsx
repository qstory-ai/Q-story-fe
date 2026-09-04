import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Modal, Pill, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  createOrganizationTutorInvite,
  listOrganizationTutorInvites,
  listOrganizationTutors,
  unlinkOrganizationTutor,
  type OrganizationTutorInvite,
  type OrganizationTutorInviteSummary,
  type OrganizationTutorLink,
} from '@/entities/organization-tutor';
import { InviteCodeCard } from '@/features/invite-issue';

type TutorsLoad = { status: 'loading' } | { status: 'ready'; tutors: OrganizationTutorLink[] } | { status: 'error'; message: string };
type InvitesLoad = { status: 'loading' } | { status: 'ready'; invites: OrganizationTutorInviteSummary[] } | { status: 'error' };

/**
 * IA "기관 관리자 > 선생님 관리" 화면. 소속 선생님 목록 + 새 초대 발급(코드/링크) + 소속 해제.
 * 발급 즉시 InviteCodeCard로 코드/링크를 노출해 관리자가 그 자리에서 복사할 수 있게 한다 -
 * 원본 토큰은 이 응답 이후 다시 볼 수 없으므로 놓치면 새 초대를 발급해야 한다.
 */
export function OrganizationTutorsPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [tutors, setTutors] = useState<TutorsLoad>({ status: 'loading' });
  const [invites, setInvites] = useState<InvitesLoad>({ status: 'loading' });
  const [issuing, setIssuing] = useState(false);
  const [freshInvite, setFreshInvite] = useState<OrganizationTutorInvite | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<OrganizationTutorLink | null>(null);
  const [unlinkInFlight, setUnlinkInFlight] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  const canView = state.status === 'authenticated' && state.user.role === 'DIRECTOR' && Boolean(state.user.organizationId);
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !organizationId) return;
    let cancelled = false;
    Promise.all([
      listOrganizationTutors(state.token, organizationId),
      listOrganizationTutorInvites(state.token, organizationId).catch(() => [] as OrganizationTutorInviteSummary[]),
    ])
      .then(([linkedTutors, inviteSummaries]) => {
        if (cancelled) return;
        setTutors({ status: 'ready', tutors: linkedTutors });
        setInvites({ status: 'ready', invites: inviteSummaries });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = failure instanceof Error ? failure.message : '선생님 목록을 불러오지 못했어요.';
        setTutors({ status: 'error', message });
        setInvites({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [state, organizationId]);

  async function issueInvite() {
    if (state.status !== 'authenticated' || !organizationId) return;
    setIssueError(null);
    setIssuing(true);
    try {
      const invite = await createOrganizationTutorInvite(state.token, organizationId);
      setFreshInvite(invite);
      // 발급 이력 리스트도 방금 것 반영을 위해 재조회 - 실패해도 방금 발급된 카드는 그대로 보인다.
      listOrganizationTutorInvites(state.token, organizationId)
        .then((summaries) => setInvites({ status: 'ready', invites: summaries }))
        .catch(() => { /* 이미 있는 이력은 그대로 유지 */ });
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : '초대를 만들지 못했어요.';
      setIssueError(message);
    } finally {
      setIssuing(false);
    }
  }

  async function confirmUnlink() {
    if (!unlinkTarget || state.status !== 'authenticated' || !organizationId) return;
    setUnlinkInFlight(true);
    try {
      await unlinkOrganizationTutor(state.token, organizationId, unlinkTarget.tutorId);
      setTutors((prev) => prev.status === 'ready'
        ? { status: 'ready', tutors: prev.tutors.filter((tutor) => tutor.id !== unlinkTarget.id) }
        : prev);
      setUnlinkTarget(null);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : '해제하지 못했어요.';
      setIssueError(message);
    } finally {
      setUnlinkInFlight(false);
    }
  }

  if (!canView) return null;

  const originBase = typeof window !== 'undefined' ? window.location.origin : '';
  const activeInvites = invites.status === 'ready'
    ? invites.invites.filter((invite) => invite.usedAt === null && new Date(invite.expiresAt) > new Date())
    : [];

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">선생님 관리</Text>
        <Text style={styles.subtitle}>
          기관에 소속된 선생님을 초대하고 관리해요. 초대 코드나 링크를 선생님에게 전달하면 소속 신청이 완성돼요.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>새 선생님 초대</Text>
          <Text style={styles.body}>
            발급된 초대는 14일 동안 유효해요. 한 번 사용되면 다시 쓸 수 없어요.
          </Text>
          <ActionButton
            label={issuing ? '초대 만드는 중…' : '초대 코드·링크 발급'}
            onPress={issueInvite}
            disabled={issuing}
          />
          {issueError ? <StatusBanner variant="warning" label={issueError} /> : null}
          {freshInvite ? (
            <InviteCodeCard
              shortCode={freshInvite.shortCode}
              link={`${originBase}/org-invite/${freshInvite.token}`}
              expiresLabel={formatExpires(freshInvite.expiresAt)}
              onDismiss={() => setFreshInvite(null)}
            />
          ) : null}
        </View>

        {activeInvites.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>진행 중인 초대</Text>
            <Text style={styles.body}>
              아직 사용되지 않은 초대예요. 원본 링크는 발급 시점에만 노출되니, 잃어버렸다면 새로 발급해 주세요.
            </Text>
            {activeInvites.map((invite) => (
              <View key={invite.id} style={styles.inviteRow}>
                <View style={styles.inviteBody}>
                  <Text style={styles.inviteCode}>{invite.shortCode}</Text>
                  <Text style={styles.inviteMeta}>{formatExpires(invite.expiresAt)}까지</Text>
                </View>
                <Pill label="사용 대기" tone="onCard" />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>소속 선생님</Text>
          {tutors.status === 'loading' ? (
            <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
          ) : tutors.status === 'error' ? (
            <Text style={[styles.body, styles.errorText]}>{tutors.message}</Text>
          ) : tutors.tutors.length === 0 ? (
            <Text style={styles.body}>아직 소속된 선생님이 없어요. 위의 초대로 시작해 보세요.</Text>
          ) : (
            <View style={styles.list}>
              {tutors.tutors.map((tutor) => (
                <View key={tutor.id} style={styles.tutorRow}>
                  <View style={styles.tutorInfo}>
                    <Text style={styles.tutorName}>{tutor.tutorDisplayName}</Text>
                    {tutor.tutorEmail ? <Text style={styles.tutorMeta}>{tutor.tutorEmail}</Text> : null}
                    <Text style={styles.tutorMeta}>합류: {formatShortDate(tutor.joinedAt)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${tutor.tutorDisplayName} 소속 해제`}
                    onPress={() => setUnlinkTarget(tutor)}
                    style={({ pressed }) => [styles.unlinkButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.unlinkLabel}>해제</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={unlinkTarget !== null}
        title={unlinkTarget ? `${unlinkTarget.tutorDisplayName} 선생님의 소속을 해제할까요?` : '소속 해제'}
        accessibilityLabel="선생님 소속 해제 확인"
        positiveAction={{
          label: unlinkInFlight ? '해제 중…' : '해제',
          onPress: confirmUnlink,
          disabled: unlinkInFlight,
          loading: unlinkInFlight,
        }}
        negativeAction={{
          label: '취소',
          onPress: () => setUnlinkTarget(null),
          disabled: unlinkInFlight,
        }}
      >
        <Text style={styles.dialogBody}>
          해제하면 선생님은 이 기관 소속에서 빠지지만, 선생님 계정과 그 학생 데이터는 그대로 남아요.
        </Text>
      </Modal>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- helpers */

function formatExpires(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric' }).format(date);
}

function formatShortDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
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
    color: storybookTheme.color.onDark,
  },
  subtitle: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onDarkMuted,
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
  centerBox: { alignItems: 'center', paddingVertical: storybookTheme.spacing.ms },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  inviteBody: { flex: 1, gap: 2 },
  inviteCode: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
    letterSpacing: 1.5,
  },
  inviteMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  list: { gap: storybookTheme.spacing.sm },
  tutorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.ms,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  tutorInfo: { flex: 1, gap: 2 },
  tutorName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  tutorMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  unlinkButton: {
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.error,
  },
  pressed: { opacity: 0.8 },
  unlinkLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.error,
  },
  dialogBody: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
  errorText: { color: storybookTheme.color.error },
});
