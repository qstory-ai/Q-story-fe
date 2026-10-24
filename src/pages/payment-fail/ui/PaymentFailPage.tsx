import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, radius, semanticColors, shadow, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, subscriptionPathFor, useAuth } from '@/entities/auth';
import { useBackOr } from '@/shared/lib';

export function PaymentFailPage() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { state } = useAuth();
  const [params] = useSearchParams();
  const fallback = state.status === 'authenticated' ? subscriptionPathFor(state.user) : '/';
  const goBack = useBackOr(fallback);

  useEffect(() => {
    if (state.status === 'anonymous') navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }, [state.status, navigate, pathname, search]);

  if (state.status !== 'authenticated') return null;
  const message = params.get('message') || '결제가 완료되지 않았어요. 결제수단을 확인한 뒤 다시 시도해 주세요.';

  const retryTarget = state.user.role === 'DIRECTOR' ? 'ORGANIZATION' : 'PARENT';

  return (
    <AppNavShell tone="warm" items={dashboardNavItems(state.user, navigate, pathname)} onBack={goBack}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">결제가 완료되지 않았어요</Text>
        <View style={styles.card}>
          <StatusBanner variant="warning" label={message} />
          <ActionButton label="다시 결제하기" onPress={() => navigate(`/payment/checkout?target=${retryTarget}`)} />
          <ActionButton variant="secondaryFull" label="이용권으로 돌아가기" onPress={() => navigate(fallback)} />
        </View>
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: 20,
  },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  // 보호자 홈과 같은 흰 카드(radius 24, 옅은 테두리·그림자).
  card: {
    borderRadius: radius[24],
    backgroundColor: semanticColors.light.bg.primary,
    borderWidth: 1,
    borderColor: semanticColors.light.border.secondary,
    ...shadow(1),
    padding: storybookTheme.spacing.lg,
    gap: storybookTheme.spacing.md,
  },
});
