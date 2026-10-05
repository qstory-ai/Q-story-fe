import type { PaymentHistoryItem } from '@/entities/payment';

/**
 * 이용권 화면 공용 문구·포맷. 결제 모델(BE PaymentService.confirm): 한 번 결제하면 정해진 일수만큼
 * 이용 기간이 생기는 단건 결제이고, 유효 기간 중에 다시 결제하면 남은 기간 뒤에 이어 붙는다.
 * 자동 결제(정기 결제)는 없다 - 그래서 해지 기능 대신 이 안내를 보여 준다.
 */
export function billingGuidance(accessDays?: number): string[] {
  const period = accessDays && accessDays > 0 ? `결제한 날부터 ${accessDays}일 동안` : '결제한 기간 동안';
  return [
    `이용권은 ${period} 쓸 수 있어요. 기간이 끝나도 자동으로 다시 결제되지 않아서 따로 해지할 필요가 없어요.`,
    '기간이 남아 있을 때 연장하면 남은 기간 뒤에 이어서 늘어나요.',
    '결제 취소나 환불이 필요하면 고객지원으로 문의해 주세요.',
  ];
}

const PAYMENT_STATUS_LABEL: Record<PaymentHistoryItem['status'], string> = {
  PAID: '결제 완료',
  READY: '결제 대기',
  FAILED: '결제 안 됨',
};

export function paymentStatusLabel(status: PaymentHistoryItem['status']): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** 영수증 링크는 https일 때만 연다(BE도 https만 저장하지만 화면에서 한 번 더 막는다). */
export function receiptLink(item: Pick<PaymentHistoryItem, 'receiptUrl'>): string | null {
  const url = item.receiptUrl?.trim();
  return url && url.startsWith('https://') ? url : null;
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}
