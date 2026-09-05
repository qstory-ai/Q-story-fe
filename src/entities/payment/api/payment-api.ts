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

export function confirmPayment(
  token: string,
  input: { paymentKey: string; orderId: string; amount: number },
  options?: RequestOptions,
): Promise<PaymentOrder> {
  return request<PaymentOrder>('/v1/payments/confirm', { method: 'POST', body: JSON.stringify(input) }, token, options);
}
