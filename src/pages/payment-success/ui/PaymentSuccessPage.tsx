import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, fetchCurrentUser, useAuth } from '@/entities/auth';
import { confirmPayment, type PaymentOrder } from '@/entities/payment';

type Result = { status: 'loading' } | { status: 'success'; order: PaymentOrder } | { status: 'error'; message: string };

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { state, updateUser } = useAuth();
  const [params] = useSearchParams();
  const [result, setResult] = useState<Result>({ status: 'loading' });
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = Number(params.get('amount'));

  useEffect(() => {
    if (state.status !== 'loading' && state.status !== 'authenticated') navigate('/login', { replace: true });
  }, [state.status, navigate]);

  // [state, ...]로 의존하면 성공 경로의 updateUser(updatedUser)가 (current-user.tsx의 setState가
  // 항상 새 객체를 만들어서) state의 identity를 바꿔 이 effect를 다시 돌게 만든다 - 같은
  // paymentKey/orderId로 confirmPayment를 두 번째 호출하게 되어, 백엔드가 재확인을 거부하면
  // 방금 성공한 화면이 바로 에러로 뒤집힌다. 실제로 쓰는 건 token 하나뿐이라 그걸로 좁힌다.
  const authToken = state.status === 'authenticated' ? state.token : null;
  useEffect(() => {
    if (!authToken) return;
    if (!paymentKey || !orderId || !Number.isSafeInteger(amount) || amount <= 0) {
      void Promise.resolve().then(() => setResult({ status: 'error', message: '결제 결과 정보가 올바르지 않아요.' }));
      return;
    }
    let cancelled = false;
    confirmPayment(authToken, { paymentKey, orderId, amount })
      .then(async (order) => {
        const updatedUser = await fetchCurrentUser(authToken);
        if (!cancelled) {
          updateUser(updatedUser);
          setResult({ status: 'success', order });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ status: 'error', message: messageForError(error, '결제를 확인하지 못했어요. 결제 내역을 확인한 뒤 다시 시도해 주세요.') });
      });
    return () => { cancelled = true; };
  }, [authToken, paymentKey, orderId, amount, updateUser]);

  if (state.status !== 'authenticated') return null;
  const backPath = result.status === 'success' && result.order.target === 'ORGANIZATION' ? '/organization/subscription' : '/mypage/subscription';

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">결제 결과</Text>
        {result.status === 'loading' ? <LoadingState label="결제를 확인하고 있어요." /> : null}
        {result.status === 'error' ? <ErrorState message={result.message} onRetry={() => window.location.reload()} /> : null}
        {result.status === 'success' ? (
          <View style={styles.card}>
            <Text style={styles.success}>결제가 완료되었어요.</Text>
            <StatusBanner label={`이용권은 ${formatDate(result.order.accessExpiresAt)}까지 활성화돼요.`} />
            <ActionButton label="이용권 관리로 이동" onPress={() => navigate(backPath)} />
          </View>
        ) : null}
      </View>
    </AppNavShell>
  );
}

function formatDate(value: string | null) {
  if (!value) return '지금';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingVertical: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  card: { borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder, padding: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  success: { fontSize: storybookTheme.type.lg, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onCardTitle },
});
