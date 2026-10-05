import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, Card, Icon, SafeAreaView, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { NotificationBell } from '@/features/notification-center';
import {
  createOrganization,
  dashboardNavItems,
  fetchEntitlement,
  useAuth,
  type EntitlementResponse,
  type UserSummary,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';
import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from '@/shared/config';

/**
 * DIRECTOR 홈("/organization"). 기관이 없으면 기관 등록, 있으면 대시보드를 보여 준다 - 한 방향으로만
 * 진행하는 두 단계라 라우트를 나누지 않았다. 비로그인 방문자는 /signup?role=organization으로 보낸다.
 */
export function OrganizationSignupPage() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.centered}>
          <ActivityIndicator color={storybookTheme.color.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (state.status === 'authenticated' && state.user.role === 'DIRECTOR') {
    return state.user.organizationId ? (
      <ClassManagementStep token={state.token} organizationId={state.user.organizationId} user={state.user} />
    ) : (
      <CreateOrganizationStep token={state.token} user={state.user} />
    );
  }
  if (state.status === 'authenticated') {
    return <Redirect to="/" />;
  }
  return <Redirect to="/signup?role=organization" />;
}

function Redirect({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

function CreateOrganizationStep({ token, user }: { token: string; user: UserSummary }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setSession } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await createOrganization(token, { name: name.trim() });
      setSession(response.token, response.user);
    } catch (failure) {
      setError(messageForError(failure, '기관을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [token, name, setSession]);

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, pathname)}>
      <View style={styles.scroll}>
        <Card variant="surface" padding="lg" style={styles.greetingCard}>
          <Text style={styles.title} accessibilityRole="header">기관 등록</Text>
          <Text style={styles.body}>거의 다 됐어요. 기관 이름을 알려주세요.</Text>
          <TextField label="기관 이름" value={name} onChangeText={setName} errorText={error ?? undefined} />
          <ActionButton
            label="등록하기"
            loading={submitting}
            onPress={onSubmit}
            disabled={!name.trim()}
          />
        </Card>
      </View>
    </AppNavShell>
  );
}

/** 기관 등록 이후의 대시보드 - IA "기관 관리자"의 각 화면으로 가는 진입점 카드만 모은다. */
function ClassManagementStep({
  token,
  organizationId,
  user,
}: {
  token: string;
  organizationId: string;
  user: UserSummary;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  // fetchEntitlement가 조용히 실패해도 대시보드가 살아 있어야 하지만, 로딩 중임을 표시는 해야
  // "구독 상태가 없는 건지, 아직 안 온 건지" 사용자가 혼동하지 않는다. done=true는 성공/실패 무관.
  const [entitlementDone, setEntitlementDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEntitlement(token, organizationId)
      .then((response) => {
        if (!cancelled) setEntitlement(response);
      })
      .catch(() => {
        // 구독 상태는 부가 정보라 조회 실패해도 대시보드 자체는 그대로 쓸 수 있어야 한다.
      })
      .finally(() => {
        if (!cancelled) setEntitlementDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, organizationId]);

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, pathname)}>
      <View style={styles.scroll}>
        {/* Parent/Tutor 홈과 시각 일관성을 위해 우측 정렬 벨 하나만 두는 얇은 상단 행.
            Director는 브랜드가 AppNavShell 사이드바에 이미 있어 좌측 브랜드는 생략. */}
        <View style={styles.bellRow}>
          <NotificationBell token={token} />
        </View>
        <Card variant="surface" padding="lg" style={styles.greetingCard}>
          <Text style={styles.title} accessibilityRole="header">관리자 대시보드</Text>
          <Text style={styles.body}>
            반과 학생, 소속 선생님, 이용 현황을 이곳에서 한눈에 관리해요.
          </Text>
          {/* grantsAccess=false여도 requiresEntitlement=false인 무료 데모는 계속 열린다
              (EntitlementService.assertAccessible) - 그래서 "구독 후 전체 이야기"라고만 안내한다. */}
          {entitlement ? (
            <StatusBanner
              variant={entitlement.grantsAccess || user.grantsAccess ? 'info' : 'warning'}
              label={subscriptionStatusLabel(entitlement.subscriptionStatus)}
              body={
                entitlement.grantsAccess
                  ? undefined
                  : user.grantsAccess
                  ? BETA_OPEN_ACCESS_NOTICE
                  : '이용권 없이도 무료 데모 한 편은 계속 이용할 수 있어요. 전체 이야기는 이용권이 있으면 열려요.'
              }
            />
          ) : !entitlementDone ? (
            <View style={styles.entitlementLoader}>
              <ActivityIndicator color={storybookTheme.color.primary} />
              <Text style={styles.entitlementLoaderText}>이용권 상태를 확인 중이에요…</Text>
            </View>
          ) : null}
        </Card>

        <View style={styles.dashboardGrid}>
          {/* 가장 자주 쓰는 반/학생 관리만 primary로 강조한다. */}
          <DashboardCard
            title="반/학생 관리"
            body="반을 만들고 담임 선생님을 배정하고 학생 명단을 확인해요."
            onPress={() => navigate('/organization/classes')}
            primary
          />
          <DashboardCard
            title="선생님 관리"
            body="소속 선생님을 초대하고 관리해요."
            onPress={() => navigate('/organization/tutors')}
          />
          <DashboardCard
            title="리포트"
            body="이용 현황과 반별 활동을 보고, 수업 기록은 개별 리포트로 열어 봐요."
            onPress={() => navigate('/organization/reports')}
          />
          <DashboardCard
            title="이용권"
            body="기관 이용권 상태와 활성 이용 범위를 확인해요."
            onPress={() => navigate('/organization/subscription')}
          />
        </View>
      </View>
    </AppNavShell>
  );
}

function DashboardCard({
  title,
  body,
  onPress,
  primary = false,
}: {
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dashboardCard,
        primary && styles.dashboardCardPrimary,
        pressed && styles.dashboardCardPressed,
      ]}
    >
      <View style={styles.dashboardCardText}>
        <Text style={styles.dashboardCardTitle}>{title}</Text>
        <Text style={styles.dashboardCardBody}>{body}</Text>
      </View>
      <Icon
        name="chevronRight"
        size={16}
        color={primary ? storybookTheme.color.primary : storybookTheme.color.onCardMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: storybookTheme.color.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.md,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
  },
  bellRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // Card 프리미티브(padding='lg')가 배경/테두리/라운드/패딩을 담당. 자식 gap만 오버라이드.
  greetingCard: {
    alignItems: 'stretch',
    gap: storybookTheme.spacing.ms,
  },
  title: { fontSize: storybookTheme.type.lg, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onCardTitle },
  body: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onCardBody },
  entitlementLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
  },
  entitlementLoaderText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  dashboardGrid: {
    gap: storybookTheme.spacing.sm,
  },
  dashboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.ms,
    // spacing.md(16)와 ml(20) 사이 - 대시보드 카드는 좁은 폭에서 여백을 조금 더 둠.
    padding: 18,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
  },
  // 가장 자주 쓰는 카드 하나만 primary 테두리로 먼저 읽히게 한다(골드는 경고 배너처럼 보여서 쓰지 않는다).
  dashboardCardPrimary: {
    borderColor: storybookTheme.color.primary,
    borderWidth: 2,
    padding: 17, // border 2 → padding 17로 인접 카드와 실제 콘텐츠 offset 유지
  },
  dashboardCardPressed: { opacity: 0.85 },
  dashboardCardText: { flex: 1, gap: storybookTheme.spacing.xs },
  dashboardCardTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  dashboardCardBody: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
  },
});
