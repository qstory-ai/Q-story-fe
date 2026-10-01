import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, Pill, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from '@/shared/config';

export function MyPageSubscriptionPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status !== 'loading' && state.status !== 'authenticated') navigate('/', { replace: true });
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const isParent = user.role === 'PARENT';

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, pathname)} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">이용권</Text>
        <View style={styles.card}>
          <Pill label={subscriptionStatusLabel(user.subscriptionStatus)} tone="onLight" />
          <StatusBanner
            label={user.grantsAccess ? '지금 모든 이야기를 이용할 수 있어요.' : '지금은 무료 이야기만 이용할 수 있어요.'}
            variant={user.grantsAccess ? 'info' : 'warning'}
          />
          {user.subscriptionExpiresAt ? (
            <View style={styles.expiryBlock}>
              <Text style={styles.expiryLabel}>이용권 만료일</Text>
              <Text style={styles.expiry}>{formatDate(user.subscriptionExpiresAt)}</Text>
            </View>
          ) : null}
          {isParent ? (
            <ActionButton label={user.grantsAccess ? '이용권 연장하기' : '이용권 결제하기'} onPress={() => navigate('/payment/checkout?target=PARENT')} />
          ) : (
            <Text style={styles.note}>{user.grantsAccess ? BETA_OPEN_ACCESS_NOTICE : '이용권은 관리자에게 문의해 주세요.'}</Text>
          )}
          {user.role === 'DIRECTOR' ? (
            <ActionButton variant="secondaryFull" label="기관 이용권 보기" onPress={() => navigate('/organization/subscription')} />
          ) : null}
        </View>
      </View>
    </AppNavShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingTop: storybookTheme.spacing.lg, paddingBottom: storybookTheme.spacing.xl, gap: storybookTheme.spacing.md },
  card: { borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder, padding: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md, ...storybookTheme.elevation.high },
  expiryBlock: { gap: storybookTheme.spacing.xs },
  expiryLabel: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  expiry: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  note: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
});
