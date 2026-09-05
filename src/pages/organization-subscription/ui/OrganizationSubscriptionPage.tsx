import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, LoadingState, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, fetchEntitlement, useAuth, type EntitlementResponse } from '@/entities/auth';
import { messageForError } from '@/shared/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; entitlement: EntitlementResponse }
  | { status: 'error'; message: string };

const LABEL: Record<EntitlementResponse['subscriptionStatus'], string> = {
  NONE: '구독 없음', TRIALING: '체험 이용 중', ACTIVE: '구독 중', EXPIRED: '구독 만료',
};

export function OrganizationSubscriptionPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;
  const allowed = state.status === 'authenticated' && state.user.role === 'DIRECTOR' && Boolean(organizationId);

  useEffect(() => {
    if (state.status !== 'loading' && !allowed) navigate('/', { replace: true });
  }, [state.status, allowed, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !organizationId) return;
    let cancelled = false;
    fetchEntitlement(state.token, organizationId)
      .then((entitlement) => { if (!cancelled) setLoad({ status: 'ready', entitlement }); })
      .catch((error: unknown) => { if (!cancelled) setLoad({ status: 'error', message: messageForError(error, '이용권 정보를 불러오지 못했어요.') }); });
    return () => { cancelled = true; };
  }, [state, organizationId]);

  if (!allowed || state.status !== 'authenticated') return null;
  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">이용권 · 라이선스</Text>
        {load.status === 'loading' ? <LoadingState label="이용권 정보를 불러오는 중이에요." /> : null}
        {load.status === 'error' ? <StatusBanner variant="warning" label={load.message} /> : null}
        {load.status === 'ready' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>{LABEL[load.entitlement.subscriptionStatus]}</Text>
            <StatusBanner
              label={load.entitlement.grantsAccess ? '기관 구성원이 전체 이야기를 이용할 수 있어요.' : '지금은 무료 이야기만 이용할 수 있어요.'}
              variant={load.entitlement.grantsAccess ? 'info' : 'warning'}
            />
            {load.entitlement.subscriptionExpiresAt ? <Text style={styles.body}>이용권 만료일 · {formatDate(load.entitlement.subscriptionExpiresAt)}</Text> : null}
            <ActionButton label={load.entitlement.grantsAccess ? '기관 이용권 연장하기' : '기관 이용권 결제'} onPress={() => navigate('/payment/checkout?target=ORGANIZATION')} />
          </View>
        ) : null}
      </View>
    </AppNavShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingVertical: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  card: { borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder, padding: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  heading: { fontSize: storybookTheme.type.lg, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onCardTitle },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardBody },
});
