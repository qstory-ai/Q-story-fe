import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

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

const SUBSCRIPTION_LABEL: Record<EntitlementResponse['subscriptionStatus'], string> = {
  NONE: '구독 전',
  TRIALING: '체험판 이용 중',
  ACTIVE: '구독 중',
  EXPIRED: '구독이 만료됐어요',
};

/**
 * 인증 상태에 따라 구동되는 두 단계(organization -> classes)임 - 두 개의 라우트가 아닌 이유는,
 * 원장은 항상 이 고정된 순서로 진행하며 한 단계를 지나면 이전 단계로 돌아갈 필요가 없기 때문.
 * 가입 자체는 이제 통합된 /signup 화면에 있으며, 여기서 인증되지 않은 방문자는 그곳으로
 * 리다이렉트된다.
 *
 * 두 단계 모두 DIRECTOR의 실제 홈("/organization")이라 PARENT/CLASS_ACCOUNT/TUTOR 홈과 같은
 * AppNavShell을 쓴다 - 예전엔 AccountLinkRow + 라이트 셸을 혼자 쓰고 있어서 역할 홈마다
 * 헤더가 다르게 보였다.
 */
export function OrganizationSignupPage() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.centered}>
          <ActivityIndicator color={storybookTheme.color.gold} />
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
      setError(messageForError(failure, '기관 및 단체를 등록하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [token, name, setSession]);

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'home')}>
      <View style={styles.scroll}>
        <Card variant="surface" padding="lg" style={styles.greetingCard}>
          <Text style={styles.title} accessibilityRole="header">기관 및 단체 등록</Text>
          <Text style={styles.body}>거의 다 됐어요. 기관 및 단체 이름을 알려주세요.</Text>
          <TextField label="기관 및 단체 이름" value={name} onChangeText={setName} errorText={error ?? undefined} />
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

/**
 * DIRECTOR가 조직을 만든 이후의 홈("/organization")은 IA "기관 관리자"가 요구하는 네 축(반/학생,
 * 선생님, 이용 현황, 결제/라이선스)의 진입점 카드를 모아 놓은 대시보드다. 이전엔 이 화면 안에
 * '반 관리'가 인라인으로 있었지만, 소속 선생님·이용 현황 등이 더해지면서 각 축을 별도 페이지로
 * 옮기고 여기선 링크만 제공한다.
 */
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
    <AppNavShell items={dashboardNavItems(user, navigate, 'home')}>
      <View style={styles.scroll}>
        {/* Parent/Tutor 홈과 시각 일관성을 위해 우측 정렬 벨 하나만 두는 얇은 상단 행.
            Director는 브랜드가 AppNavShell 사이드바에 이미 있어 좌측 브랜드는 생략. */}
        <View style={styles.bellRow}>
          <NotificationBell token={token} />
        </View>
        <Card variant="surface" padding="lg" style={styles.greetingCard}>
          <Text style={styles.title} accessibilityRole="header">기관 관리자 대시보드</Text>
          <Text style={styles.body}>
            반과 학생, 소속 선생님, 이용 현황을 이곳에서 한눈에 관리해요.
          </Text>
          {/*
            entitlement.grantsAccess=false는 requiresEntitlement=true인 작품만 막는다
            (EntitlementService.assertAccessible) - 지금 카탈로그의 유일한 작품(HG)은
            requiresEntitlement=false라서 구독 여부와 무관하게 무료 데모로 계속 열려 있다.
            "이야기를 아예 시작할 수 없다"는 예전 문구는 사실이 아니었다 - 구독은 데모 이후의
            전체 작품에만 걸리는 것이라고 정확히 말해야 한다.
          */}
          {entitlement ? (
            <StatusBanner
              variant={entitlement.grantsAccess ? 'info' : 'warning'}
              label={SUBSCRIPTION_LABEL[entitlement.subscriptionStatus]}
              body={
                entitlement.grantsAccess
                  ? undefined
                  : '구독 없이도 무료 데모 한 편은 계속 이용할 수 있어요. 전체 이야기는 구독 후 열려요.'
              }
            />
          ) : !entitlementDone ? (
            <View style={styles.entitlementLoader}>
              <ActivityIndicator color={storybookTheme.color.gold} />
              <Text style={styles.entitlementLoaderText}>구독 상태를 확인 중이에요…</Text>
            </View>
          ) : null}
        </Card>

        <View style={styles.dashboardGrid}>
          {/* 반/학생 관리는 가장 자주 쓰는 액션이라 primary emphasis (금색 액센트 + eyebrow)로
              시각적 우선순위를 준다. 나머지 셋은 동일한 outlined variant. */}
          <DashboardCard
            title="반/학생 관리"
            body="반을 만들고 반에 참여한 부모(학생) 목록을 확인해요."
            onPress={() => navigate('/organization/classes')}
            primary
          />
          <DashboardCard
            title="선생님 관리"
            body="소속 선생님을 초대하고 관리해요."
            onPress={() => navigate('/organization/tutors')}
          />
          <DashboardCard
            title="이용 현황"
            body="기관 전체의 최근 완주 활동과 요약 지표를 확인해요."
            onPress={() => navigate('/organization/usage')}
          />
          <DashboardCard
            title="이용권 · 라이선스"
            body="기관 구독 상태와 활성 이용 범위를 확인해요."
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
        {primary ? <Text style={styles.dashboardCardEyebrow}>자주 쓰는 곳</Text> : null}
        <Text style={styles.dashboardCardTitle}>{title}</Text>
        <Text style={styles.dashboardCardBody}>{body}</Text>
      </View>
      <Icon
        name="chevronRight"
        size={16}
        color={primary ? storybookTheme.color.gold : storybookTheme.color.onCardMuted}
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
  // 대시보드에서 가장 자주 쓰이는 액션에 gold border + tint로 시각 우선순위를 준다.
  // 다른 셋은 모두 동일한 톤이라 이 하나만 눈에 먼저 들어오도록.
  dashboardCardPrimary: {
    borderColor: storybookTheme.color.gold,
    borderWidth: 2,
    padding: 17, // border 2 → padding 17로 인접 카드와 실제 콘텐츠 offset 유지
  },
  dashboardCardPressed: { opacity: 0.85 },
  dashboardCardText: { flex: 1, gap: storybookTheme.spacing.xs },
  dashboardCardEyebrow: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
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
