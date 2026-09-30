import { apiBaseUrl } from '@/shared/config';
import { requestJson, type RequestOptions } from '@/shared/api';

export type PaymentTarget = 'PARENT' | 'ORGANIZATION';

export type PaymentOrder = {
  orderId: string;
  target: PaymentTarget;
  status: 'READY' | 'PAID' | 'FAILED';
  amount: number;
  orderName: string;
  accessExpiresAt: string | null;
};

/**
 * 기관 이용권 견적 - amount = studentCount x unitAmount. unitAmount가 0이면 아직 금액이 설정되지 않은 것이고,
 * currentSeats는 지금 결제돼 있는 인원(예전 정액 구독이면 null).
 */
export type OrganizationQuote = {
  /** 과금 대상 - 학부모가 연결된 학생 수. */
  studentCount: number;
  /** 반 명단 전체 학생 수(학부모 연결 대기 포함). */
  rosterStudentCount: number;
  unitAmount: number;
  amount: number;
  currentSeats: number | null;
  accessDays: number;
};

export class PaymentApiError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}) {
  return requestJson<T, PaymentApiError>(PaymentApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

export function createPaymentOrder(token: string, target: PaymentTarget, options?: RequestOptions): Promise<PaymentOrder> {
  return request<PaymentOrder>('/v1/payments/orders', { method: 'POST', body: JSON.stringify({ target }) }, token, options);
}

export function getOrganizationQuote(token: string, options?: RequestOptions): Promise<OrganizationQuote> {
  return request<OrganizationQuote>('/v1/payments/organization-quote', { method: 'GET' }, token, options);
}

export function confirmPayment(
  token: string,
  input: { paymentKey: string; orderId: string; amount: number },
  options?: RequestOptions,
): Promise<PaymentOrder> {
  return request<PaymentOrder>('/v1/payments/confirm', { method: 'POST', body: JSON.stringify(input) }, token, options);
}
