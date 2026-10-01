import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, StatusBanner, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, fetchEntitlement, useDirectorSession, type EntitlementResponse } from '@/entities/auth';
import { getOrganizationQuote, type OrganizationQuote } from '@/entities/payment';
import { messageForError } from '@/shared/api';
import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from '@/shared/config';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; entitlement: EntitlementResponse; quote: OrganizationQuote }
  | { status: 'error'; message: string };

export function OrganizationSubscriptionPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const director = useDirectorSession(navigate);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const token = director?.token ?? null;
  const organizationId = director?.organizationId ?? null;

  useEffect(() => {
    if (!token || !organizationId) return;
    let cancelled = false;
    Promise.all([fetchEntitlement(token, organizationId), getOrganizationQuote(token)])
      .then(([entitlement, quote]) => { if (!cancelled) setLoad({ status: 'ready', entitlement, quote }); })
      .catch((error: unknown) => { if (!cancelled) setLoad({ status: 'error', message: messageForError(error, '이용권 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }); });
    return () => { cancelled = true; };
  }, [token, organizationId]);

  if (!director) return null;
  return (
    <AppNavShell items={dashboardNavItems(director.user, navigate, pathname)} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">이용권</Text>
        {load.status === 'loading' ? <LoadingState label="이용권 정보를 불러오는 중이에요." /> : null}
        {load.status === 'error' ? <ErrorState message={load.message} onRetry={() => window.location.reload()} /> : null}
        {load.status === 'ready' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>{subscriptionStatusLabel(load.entitlement.subscriptionStatus)}</Text>
            {load.entitlement.grantsAccess ? (
              <StatusBanner label="기관 구성원이 전체 이야기를 이용할 수 있어요." variant="info" />
            ) : director.user.grantsAccess ? (
              <StatusBanner label={BETA_OPEN_ACCESS_NOTICE} variant="info" />
            ) : (
              <StatusBanner label="지금은 무료 이야기만 이용할 수 있어요." variant="warning" />
            )}
            {load.entitlement.subscriptionExpiresAt ? <Text style={styles.body}>이용권 만료일 · {formatDate(load.entitlement.subscriptionExpiresAt)}</Text> : null}
            <QuoteSection quote={load.quote} />
            <ActionButton
              label={load.entitlement.grantsAccess ? '기관 이용권 연장하기' : '기관 이용권 결제하기'}
              onPress={() => navigate('/payment/checkout?target=ORGANIZATION')}
              disabled={!canPay(load.quote)}
            />
          </View>
        ) : null}
      </View>
    </AppNavShell>
  );
}

function canPay(quote: OrganizationQuote) {
  return quote.unitAmount > 0 && quote.studentCount > 0;
}

/** 학생 수 x 학생당 금액 = 결제 금액, 그리고 지금 결제된 인원 대비 학생 수. */
function QuoteSection({ quote }: { quote: OrganizationQuote }) {
  if (quote.unitAmount <= 0) {
    return <StatusBanner variant="warning" label="결제 금액이 아직 설정되지 않아 지금은 결제할 수 없어요." />;
  }
  if (quote.studentCount === 0) {
    return <StatusBanner variant="warning" label="보호자가 연결된 학생이 생긴 뒤에 결제할 수 있어요." />;
  }
  const overSeats = quote.currentSeats !== null && quote.studentCount > quote.currentSeats;
  return (
    <>
      <Text style={styles.body}>
        보호자가 연결된 학생 {quote.studentCount}명 × {quote.unitAmount.toLocaleString('ko-KR')}원 = {quote.amount.toLocaleString('ko-KR')}원 ({quote.accessDays}일)
      </Text>
      {quote.rosterStudentCount > quote.studentCount ? (
        <Text style={styles.body}>
          명단의 {quote.rosterStudentCount - quote.studentCount}명은 아직 보호자가 연결되지 않아 결제 대상에서 빠졌어요.
        </Text>
      ) : null}
      {quote.currentSeats !== null ? <Text style={styles.body}>지금 결제된 인원 · {quote.currentSeats}명</Text> : null}
      {overSeats ? (
        <StatusBanner
          variant="warning"
          label={`보호자가 연결된 학생이 결제된 인원보다 ${quote.studentCount - (quote.currentSeats ?? 0)}명 많아요. 나중에 연결된 학생의 보호자는 이용권이 적용되지 않아요. 다시 결제하면 현재 인원으로 맞춰져요.`}
        />
      ) : null}
      <Text style={styles.body}>선생님은 인원과 관계없이 기관 이용권으로 전체 이야기를 이용할 수 있어요.</Text>
    </>
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
