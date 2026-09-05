import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';

export function PaymentFailPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [params] = useSearchParams();
  if (state.status !== 'authenticated') return null;
  const message = params.get('message') || '결제가 완료되지 않았어요. 결제수단을 확인한 뒤 다시 시도해 주세요.';

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">결제가 완료되지 않았어요</Text>
        <StatusBanner variant="warning" label={message} />
        <ActionButton label="이용권 관리로 돌아가기" onPress={() => navigate(state.user.role === 'DIRECTOR' ? '/organization/subscription' : '/mypage/subscription')} />
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingVertical: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
});
