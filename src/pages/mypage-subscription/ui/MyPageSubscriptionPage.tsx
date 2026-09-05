import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Pill, SectionHeader, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth, type UserSummary } from '@/entities/auth';

const STATUS_LABEL: Record<UserSummary['subscriptionStatus'], string> = {
  NONE: '구독 없음',
  TRIALING: '체험 중',
  ACTIVE: '구독 중',
  EXPIRED: '만료됨',
};

export function MyPageSubscriptionPage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status !== 'loading' && state.status !== 'authenticated') navigate('/', { replace: true });
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const isParent = user.role === 'PARENT';

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <SectionHeader title="나의 구독" />
        <View style={styles.card}>
          <Pill label={STATUS_LABEL[user.subscriptionStatus]} />
          <StatusBanner
            label={user.grantsAccess ? '지금 전체 이야기를 이용할 수 있어요.' : '지금은 무료 이야기만 이용할 수 있어요.'}
            variant={user.grantsAccess ? 'info' : 'warning'}
          />
          {user.subscriptionExpiresAt ? <Text style={styles.expiry}>이용권 만료일 · {formatDate(user.subscriptionExpiresAt)}</Text> : null}
          {isParent ? <ActionButton label={user.grantsAccess ? '이용권 연장하기' : '보호자 이용권 결제'} onPress={() => navigate('/payment/checkout?target=PARENT')} /> : null}
          {!isParent ? <Text style={styles.note}>보호자 이용권 결제는 보호자 계정에서만 할 수 있어요.</Text> : null}
        </View>
      </View>
    </AppNavShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingTop: storybookTheme.spacing.lg, paddingBottom: storybookTheme.spacing.xl, gap: storybookTheme.spacing.md },
  card: { borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder, padding: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md, ...storybookTheme.elevation.high },
  expiry: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  note: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
});
