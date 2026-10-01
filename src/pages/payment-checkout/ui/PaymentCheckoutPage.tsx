import { webOrigin } from '@/shared/config';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';

import { ActionButton, AppNavShell, ErrorState, LoadingState, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { createPaymentOrder, type PaymentOrder, type PaymentTarget } from '@/entities/payment';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; order: PaymentOrder; widgets: TossPaymentsWidgets }
  | { status: 'error'; message: string };

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;

export function PaymentCheckoutPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [params] = useSearchParams();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const requestedTarget = params.get('target');
  const target: PaymentTarget | null = requestedTarget === 'PARENT' || requestedTarget === 'ORGANIZATION' ? requestedTarget : null;
  const token = state.status === 'authenticated' ? state.token : null;
  const userId = state.status === 'authenticated' ? state.user.id : null;
  const setupIdRef = useRef(0);

  const allowed = state.status === 'authenticated'
    && target !== null
    && ((target === 'PARENT' && state.user.role === 'PARENT')
      || (target === 'ORGANIZATION' && state.user.role === 'DIRECTOR' && Boolean(state.user.organizationId)));

  useEffect(() => {
    if (state.status !== 'loading' && !allowed) navigate('/', { replace: true });
  }, [state.status, allowed, navigate]);

  // state 객체 전체가 아니라 token/userId로 좁힌다 - updateUser 등으로 state identity만 바뀌어도
  // 주문을 새로 만들고 위젯을 다시 그리지 않도록.
  useEffect(() => {
    if (!token || !userId || !target || !allowed) return;
    const authToken = token;
    const customerKey = `qstory-${userId}`;
    const paymentTarget = target;
    if (!clientKey) {
      void Promise.resolve().then(() => setLoad({ status: 'error', message: '결제 화면 설정이 아직 준비되지 않았어요.' }));
      return;
    }
    const tossClientKey = clientKey;
    const setupId = ++setupIdRef.current;
    let cancelled = false;
    async function setup() {
      try {
        const order = await createPaymentOrder(authToken, paymentTarget);
        const tossPayments = await loadTossPayments(tossClientKey);
        const widgets = tossPayments.widgets({ customerKey });
        await widgets.setAmount({ currency: 'KRW', value: order.amount });
        if (cancelled || setupId !== setupIdRef.current) return;
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#qstory-payment-method', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#qstory-payment-agreement', variantKey: 'AGREEMENT' }),
        ]);
        if (!cancelled && setupId === setupIdRef.current) setLoad({ status: 'ready', order, widgets });
      } catch (error: unknown) {
        if (!cancelled && setupId === setupIdRef.current) {
          setLoad({ status: 'error', message: messageForError(error, '결제 화면을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.') });
        }
      }
    }
    void setup();
    return () => { cancelled = true; };
  }, [token, userId, target, allowed]);

  if (!allowed) return null;
  const user = state.user;
  const backPath = target === 'ORGANIZATION' ? '/organization/subscription' : '/mypage/subscription';

  async function requestPayment() {
    if (load.status !== 'ready') return;
    try {
      await load.widgets.requestPayment({
        orderId: load.order.orderId,
        orderName: load.order.orderName,
        successUrl: `${webOrigin()}/payment/success`,
        failUrl: `${webOrigin()}/payment/fail`,
        customerEmail: user.email,
        customerName: user.displayName,
      });
    } catch (error) {
      setLoad({ status: 'error', message: messageForError(error, '결제 요청을 시작하지 못했어요. 선택한 결제수단을 다시 확인해 주세요.') });
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, pathname)} onBack={() => navigate(backPath)}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">결제하기</Text>
        {load.status === 'error' ? <ErrorState message={load.message} onRetry={() => window.location.reload()} /> : null}
        {/* 위젯은 'ready' 전환 전에 setup() 안에서 두 div에 mount된다(그 성공이 'ready'의 조건).
            그래서 카드와 두 div는 status와 무관하게 항상 렌더링하고 안의 내용만 바꾼다. */}
        <View style={styles.card}>
          {load.status === 'ready' ? (
            <>
              <Text style={styles.orderName}>{load.order.orderName}</Text>
              <Text style={styles.amount}>{load.order.amount.toLocaleString('ko-KR')}원</Text>
            </>
          ) : load.status === 'loading' ? (
            <LoadingState label="안전한 결제 화면을 준비하고 있어요." />
          ) : null}
          <div id="qstory-payment-method" />
          <div id="qstory-payment-agreement" />
          {load.status === 'ready' ? (
            <ActionButton label="결제 요청" onPress={() => { void requestPayment(); }} />
          ) : null}
        </View>
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%', maxWidth: storybookTheme.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: storybookTheme.spacing.ml, paddingVertical: storybookTheme.spacing.lg, gap: storybookTheme.spacing.md },
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  card: { borderRadius: storybookTheme.radius.card, backgroundColor: storybookTheme.color.surfaceCard, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder, padding: storybookTheme.spacing.ml, gap: storybookTheme.spacing.sm },
  orderName: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  amount: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.primary },
});
