import { initializePropertyPaystack, verifyPropertyPaystackTransaction, settlePropertyPaystack } from './paystack-payments';
import { initializePropertyFlutterwave, verifyPropertyFlutterwaveTransaction, settlePropertyFlutterwave, normalizeFlutterwaveTransaction } from './flutterwave-payments';
import type { OnlineProviderId, OnlinePaymentSource } from './online-provider';

export type PaymentProvider = OnlineProviderId;

type InitializeInput = {
  propertyId: string;
  invoiceId?: string | null;
  reservationId?: string | null;
  email: string;
  amountMinorUnits: number;
  currency: string;
  source: OnlinePaymentSource;
  callbackUrl: string;
  idempotencyKey?: string;
};

export async function initializePayment(provider: PaymentProvider, input: InitializeInput, fetcher: typeof fetch = fetch) {
  if (provider === 'flutterwave') return initializePropertyFlutterwave(input, fetcher);
  return initializePropertyPaystack(input, fetcher);
}

export async function verifyPayment(
  provider: PaymentProvider,
  propertyId: string,
  input: { reference?: string; transactionId?: string | number | null; txRef?: string | null },
  fetcher: typeof fetch = fetch,
) {
  if (provider === 'flutterwave') {
    return verifyPropertyFlutterwaveTransaction(propertyId, { transactionId: input.transactionId, txRef: input.txRef || input.reference }, fetcher);
  }
  if (!input.reference) throw new Error('VERIFICATION_FAILED');
  return verifyPropertyPaystackTransaction(propertyId, input.reference, fetcher);
}

export async function settleVerifiedPayment(provider: PaymentProvider, attemptId: string, verified: any) {
  if (provider === 'flutterwave') return settlePropertyFlutterwave(attemptId, verified);
  return settlePropertyPaystack(attemptId, verified);
}

export function normalizeTransaction(provider: PaymentProvider, verified: any) {
  if (provider === 'flutterwave') return normalizeFlutterwaveTransaction(verified);
  return {
    id: verified?.id != null ? String(verified.id) : null,
    txRef: verified?.reference,
    status: verified?.status,
    amountMinorUnits: verified?.amount,
    currency: verified?.currency,
  };
}
