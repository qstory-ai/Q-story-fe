import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, storybookTheme } from '@/shared/ui';
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
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={goBack}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">결제가 완료되지 않았어요</Text>
        <StatusBanner variant="warning" label={message} />
        <ActionButton label="다시 결제하기" onPress={() => navigate(`/payment/checkout?target=${retryTarget}`)} />
        <ActionButton variant="secondaryFull" label="이용권으로 돌아가기" onPress={() => navigate(fallback)} />
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingVertical: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
});
