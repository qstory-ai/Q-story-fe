import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from '@/shared/config';
import {
  BillingGuidanceCard,
  PaymentHistorySection,
  SubscriptionPageTitle,
  SubscriptionStatusCard,
  subscriptionPageStyles as styles,
} from '@/features/subscription-overview';

/**
 * 보호자 이용권. 기관 이용권(OrganizationSubscriptionPage)과 같은 구조(상태 카드 → 결제 안내 → 결제 내역)를
 * features/subscription-overview로 공유한다. 선생님·관리자는 결제하지 않으므로 상태와 베타 안내만 본다.
 */
export function MyPageSubscriptionPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status !== 'loading' && state.status !== 'authenticated') navigate('/', { replace: true });
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;
  const { user, token } = state;
  const isParent = user.role === 'PARENT';

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, pathname)} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <SubscriptionPageTitle />
        <SubscriptionStatusCard
          statusLabel={subscriptionStatusLabel(user.subscriptionStatus)}
          banner={user.grantsAccess
            ? { label: '지금 모든 이야기를 이용할 수 있어요.', variant: 'info' }
            : { label: '지금은 무료 이야기만 이용할 수 있어요.', variant: 'warning' }}
          expiresAt={user.subscriptionExpiresAt}
        >
          {isParent ? (
            <ActionButton label={user.grantsAccess ? '이용권 연장하기' : '이용권 결제하기'} onPress={() => navigate('/payment/checkout?target=PARENT')} />
          ) : (
            <Text style={styles.note}>{user.grantsAccess ? BETA_OPEN_ACCESS_NOTICE : '이용권은 관리자에게 문의해 주세요.'}</Text>
          )}
          {user.role === 'DIRECTOR' ? (
            <ActionButton variant="secondaryFull" label="기관 이용권 보기" onPress={() => navigate('/organization/subscription')} />
          ) : null}
        </SubscriptionStatusCard>
        {isParent ? (
          <>
            <BillingGuidanceCard onContactSupport={() => navigate('/mypage/support')} />
            <PaymentHistorySection token={token} emptyLabel="아직 결제한 이용권이 없어요." />
          </>
        ) : null}
      </View>
    </AppNavShell>
  );
}
