import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const { state } = useAuth();
  const [params] = useSearchParams();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const requestedTarget = params.get('target');
  const target: PaymentTarget | null = requestedTarget === 'PARENT' || requestedTarget === 'ORGANIZATION' ? requestedTarget : null;
  const session = state.status === 'authenticated' ? state : null;
  const setupIdRef = useRef(0);

  const allowed = state.status === 'authenticated'
    && target !== null
    && ((target === 'PARENT' && state.user.role === 'PARENT')
      || (target === 'ORGANIZATION' && state.user.role === 'DIRECTOR' && Boolean(state.user.organizationId)));

  useEffect(() => {
    if (state.status !== 'loading' && !allowed) navigate('/', { replace: true });
  }, [state.status, allowed, navigate]);

  useEffect(() => {
    if (!session || !target || !allowed) return;
    const token = session.token;
    const customerKey = `qstory-${session.user.id}`;
    const paymentTarget = target;
    if (!clientKey) {
      void Promise.resolve().then(() => setLoad({ status: 'error', message: '결제 화면 설정이 아직 준비되지 않았어요.' }));
      return;
    }
    const setupId = ++setupIdRef.current;
    let cancelled = false;
    async function setup() {
      try {
        const order = await createPaymentOrder(token, paymentTarget);
        const tossPayments = await loadTossPayments(clientKey!);
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
  }, [session, target, allowed]);

  if (!allowed || !session) return null;
  const user = session.user;
  const backPath = target === 'ORGANIZATION' ? '/organization/subscription' : '/mypage/subscription';

  async function requestPayment() {
    if (load.status !== 'ready') return;
    try {
      await load.widgets.requestPayment({
        orderId: load.order.orderId,
        orderName: load.order.orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email,
        customerName: user.displayName,
      });
    } catch (error) {
      setLoad({ status: 'error', message: messageForError(error, '결제 요청을 시작하지 못했어요. 선택한 결제수단을 다시 확인해 주세요.') });
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate(backPath)}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">결제하기</Text>
        {load.status === 'error' ? <ErrorState message={load.message} onRetry={() => window.location.reload()} /> : null}
        {/* #qstory-payment-method/#qstory-payment-agreement는 status가 'ready'가 되기 전, setup()
            안에서 widgets.renderPaymentMethods/renderAgreement가 이미 그 자리에 mount를 시도한다
            (그 성공 자체가 'ready' 전환의 조건이라 - 순서를 바꿀 수 없다). 그래서 이 카드를 status로
            숨기면 mount 시점에 셀렉터가 DOM에 없어서 매번 실패했다 - 카드/두 div는 항상 렌더링하고,
            안의 내용(주문 정보/로딩 문구/버튼)만 status로 바꾼다. */}
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
