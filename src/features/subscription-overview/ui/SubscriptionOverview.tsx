import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState, Icon, LoadingState, Pill, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { getPaymentHistory, type PaymentHistoryItem } from '@/entities/payment';

import { billingGuidance, formatLongDate, formatWon, paymentStatusLabel, receiptLink } from '../lib/billing-text';

/**
 * 보호자 이용권(/mypage/subscription)과 기관 이용권(/organization/subscription)이 같은 구조로 쓰는 블록들:
 * 상태 카드 → 결제 안내 → 결제 내역. 화면마다 다른 건 상태 카드 안의 내용(견적·버튼)뿐이다.
 */

export function SubscriptionPageTitle() {
  return <Text style={styles.title} accessibilityRole="header">이용권</Text>;
}

export function SubscriptionStatusCard({
  statusLabel,
  banner,
  expiresAt,
  children,
}: {
  statusLabel: string;
  banner: { label: string; variant: 'info' | 'warning' };
  expiresAt: string | null;
  /** 상태 아래에 붙는 화면별 내용(견적, 결제·연장 버튼, 안내 문구). */
  children?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pill label={statusLabel} tone="onLight" />
      <StatusBanner label={banner.label} variant={banner.variant} />
      {expiresAt ? (
        <View style={styles.expiryBlock}>
          <Text style={styles.muted}>이용권 만료일</Text>
          <Text style={styles.expiry}>{formatLongDate(expiresAt)}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** 해지 기능 대신 보여 주는 결제 방식 안내 - 자동 결제가 없어서 해지할 것이 없다. */
export function BillingGuidanceCard({ accessDays, onContactSupport }: { accessDays?: number; onContactSupport: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>결제 안내</Text>
      {billingGuidance(accessDays).map((line) => (
        <Text key={line} style={styles.body}>{line}</Text>
      ))}
      <Pressable
        accessibilityRole="link"
        onPress={onContactSupport}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Text style={styles.linkLabel}>고객지원</Text>
        <Icon name="chevronRight" size={14} color={storybookTheme.color.primary} />
      </Pressable>
    </View>
  );
}

type HistoryState =
  | { status: 'loading' }
  | { status: 'ready'; items: PaymentHistoryItem[] }
  | { status: 'error'; message: string };

/** 결제 내역 - 보호자는 본인 결제, 관리자는 기관 결제(BE가 역할로 범위를 정한다). */
export function PaymentHistorySection({ token, emptyLabel }: { token: string; emptyLabel: string }) {
  const [load, setLoad] = useState<HistoryState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPaymentHistory(token)
      .then((items) => { if (!cancelled) setLoad({ status: 'ready', items }); })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: messageForError(error, '결제 내역을 불러오지 못했어요.') });
      });
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>결제 내역</Text>
      {load.status === 'loading' ? <LoadingState compact label="결제 내역을 불러오는 중이에요…" /> : null}
      {load.status === 'error' ? (
        <ErrorState
          message={load.message}
          onRetry={() => {
            setLoad({ status: 'loading' });
            setReloadKey((n) => n + 1);
          }}
        />
      ) : null}
      {load.status === 'ready' && load.items.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
      {load.status === 'ready' && load.items.length > 0 ? (
        <View>
          {load.items.map((item, index) => (
            <View key={item.orderId}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <PaymentRow item={item} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PaymentRow({ item }: { item: PaymentHistoryItem }) {
  const receipt = receiptLink(item);
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle} numberOfLines={2}>{item.orderName}</Text>
        <Text style={styles.rowAmount}>{formatWon(item.amount)}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.muted}>
          {item.paidAt ? formatLongDate(item.paidAt) : '날짜 없음'} · {paymentStatusLabel(item.status)}
        </Text>
        {receipt ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${item.orderName} 영수증 보기`}
            onPress={() => { void Linking.openURL(receipt).catch(() => undefined); }}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.linkLabel}>영수증</Text>
            <Icon name="chevronRight" size={14} color={storybookTheme.color.primary} />
          </Pressable>
        ) : null}
      </View>
      {item.accessExpiresAt ? <Text style={styles.muted}>이용 기간 · {formatLongDate(item.accessExpiresAt)}까지</Text> : null}
    </View>
  );
}

export const subscriptionPageStyles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardBody },
  note: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
});

const styles = StyleSheet.create({
  title: { fontSize: storybookTheme.type.xl, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onContent },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.lg,
    gap: storybookTheme.spacing.md,
    ...storybookTheme.elevation.high,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  muted: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardMuted },
  expiryBlock: { gap: storybookTheme.spacing.xs },
  expiry: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 32 },
  linkLabel: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.primary },
  pressed: { opacity: 0.7 },
  divider: { height: 1, backgroundColor: storybookTheme.color.pillBorder, marginVertical: storybookTheme.spacing.sm },
  row: { gap: storybookTheme.spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: storybookTheme.spacing.sm },
  rowTitle: { flex: 1, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.semibold, color: storybookTheme.color.onCardTitle },
  rowAmount: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: storybookTheme.spacing.sm },
});
